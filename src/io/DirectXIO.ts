/**
 * 🎮 DirectX I/O - Import .x files via conversion tools
 * 
 * This module provides import functionality for Microsoft DirectX .x files by:
 * 1. Detecting if Assimp or other converters are available
 * 2. Using Assimp to convert .x to .glb/.gltf
 * 3. Importing the resulting GLTF data using our existing GLTF pipeline
 * 
 * Requirements:
 * - Assimp with DirectX .x support (cross-platform)
 * - Alternative: Meshlab or other converters
 * 
 * DirectX .x Format Features:
 * - ✅ Animation Support - Basic keyframe animation
 * - ✅ Mesh Data - Geometry and materials
 * - ⚠️ Limited Modern Features - Legacy format
 * - 🎮 Game Development - Common in older DirectX applications
 */

import { Mesh } from '../core/Mesh';
import { Skeleton } from '../core/Skeleton';
import { AnimationClip } from '../core/Animation';
import { SkinWeights } from '../core/Skinning';
import { GltfIO, GltfImportResult } from './GltfIO';
import { execSync, spawn } from 'child_process';
import { existsSync, unlinkSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * DirectX converter detection result
 */
export interface DirectXConverterInfo {
  found: boolean;
  type?: 'assimp' | 'meshlab' | 'custom';
  version?: string;
  path?: string;
  hasAnimationSupport: boolean;
  hasDirectXSupport: boolean;
}

/**
 * Options for DirectX import
 */
export interface DirectXImportOptions {
  /** Converter executable path (auto-detected if not provided) */
  converterPath?: string;
  /** Preferred converter type */
  preferredConverter?: 'assimp' | 'meshlab' | 'auto';
  /** Whether to import animations */
  includeAnimations?: boolean;
  /** Whether to import skeletal data */
  includeSkeleton?: boolean;
  /** Whether to clean up temporary files */
  cleanup?: boolean;
  /** Converter specific options */
  converterOptions?: {
    /** Export binary GLB instead of text GLTF */
    binary?: boolean;
    /** Include materials */
    materials?: boolean;
    /** Include textures */
    textures?: boolean;
  };
}

/**
 * DirectX I/O class for importing .x files
 */
export class DirectXIO {
  private static converterPaths = {
    assimp: [
      'assimp',
      'assimp.exe',
      '/usr/bin/assimp',
      '/usr/local/bin/assimp',
      '/opt/assimp/bin/assimp'
    ],
    meshlab: [
      'meshlabserver',
      'meshlabserver.exe',
      '/usr/bin/meshlabserver',
      '/opt/meshlab/meshlabserver'
    ]
  };

  /**
   * Detect available DirectX converters
   */
  static async detectConverter(): Promise<DirectXConverterInfo> {
    // Try Assimp first (best support for DirectX .x)
    for (const converterPath of this.converterPaths.assimp) {
      try {
        const output = execSync(`"${converterPath}" version`, { 
          timeout: 10000, 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
        
        const version = this.parseAssimpVersion(output);
        const hasDirectXSupport = await this.checkAssimpDirectXSupport(converterPath);
        
        return {
          found: true,
          type: 'assimp',
          version,
          path: converterPath,
          hasAnimationSupport: true,
          hasDirectXSupport
        };
      } catch (error) {
        continue;
      }
    }

    // Try Meshlab as fallback (limited DirectX support)
    for (const converterPath of this.converterPaths.meshlab) {
      try {
        const output = execSync(`"${converterPath}" --help`, { 
          timeout: 10000, 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
        
        const version = this.parseMeshlabVersion(output);
        
        return {
          found: true,
          type: 'meshlab',
          version,
          path: converterPath,
          hasAnimationSupport: false, // Meshlab doesn't handle animations well
          hasDirectXSupport: true
        };
      } catch (error) {
        continue;
      }
    }
    
    return {
      found: false,
      hasAnimationSupport: false,
      hasDirectXSupport: false
    };
  }

  /**
   * Parse Assimp version from output
   */
  private static parseAssimpVersion(output: string): string {
    const match = output.match(/Assimp\s+v?(\d+\.\d+(?:\.\d+)?)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Parse Meshlab version from output
   */
  private static parseMeshlabVersion(output: string): string {
    const match = output.match(/MeshLab\s+v?(\d+\.\d+(?:\.\d+)?)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Check if Assimp supports DirectX .x format
   */
  private static async checkAssimpDirectXSupport(converterPath: string): Promise<boolean> {
    try {
      const output = execSync(`"${converterPath}" listext`, { 
        timeout: 5000, 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      
      // Check if .x extension is listed in supported formats
      return output.toLowerCase().includes('.x') || output.toLowerCase().includes('directx');
    } catch (error) {
      // If we can't check, assume it's supported (most Assimp builds include DirectX)
      return true;
    }
  }

  /**
   * Import mesh from .x file
   */
  static async importMesh(
    xFilePath: string, 
    options: DirectXImportOptions = {}
  ): Promise<Mesh> {
    const result = await this.importComplete(xFilePath, options);
    return result.mesh;
  }

  /**
   * Import complete model (mesh + skeleton + animations) from .x file
   */
  static async importComplete(
    xFilePath: string,
    options: DirectXImportOptions = {}
  ): Promise<GltfImportResult> {
    // Check if file exists
    if (!existsSync(xFilePath)) {
      throw new Error(`DirectX .x file not found: ${xFilePath}`);
    }

    // Detect converter
    const converterInfo = await this.detectConverter();
    if (!converterInfo.found) {
      throw new Error(
        'No DirectX converter found. Please install Assimp or Meshlab.\n' +
        'Assimp: https://assimp.org/\n' +
        'Meshlab: https://www.meshlab.net/'
      );
    }

    if (!converterInfo.hasDirectXSupport) {
      throw new Error(`Converter ${converterInfo.type} does not support DirectX .x format`);
    }

    const converterPath = options.converterPath || converterInfo.path!;
    
    // Create temporary directory for conversion
    const tempDir = mkdtempSync(join(tmpdir(), 'directx-import-'));
    const tempGlbPath = join(tempDir, 'converted.glb');

    try {
      // Convert .x to .glb
      if (converterInfo.type === 'assimp' || converterInfo.type === 'meshlab') {
        await this.convertDirectXToGltf(
          converterInfo.type, 
          converterPath, 
          xFilePath, 
          tempGlbPath, 
          options
        );
      } else {
        throw new Error(`Unsupported converter type: ${converterInfo.type}`);
      }
      
      // Import the resulting GLTF
      const gltfResult = await GltfIO.importComplete(tempGlbPath);
      
      return gltfResult;
    } finally {
      // Cleanup temporary files
      if (options.cleanup !== false) {
        try {
          if (existsSync(tempGlbPath)) {
            unlinkSync(tempGlbPath);
          }
        } catch (error) {
          console.warn('Failed to cleanup temporary files:', error);
        }
      }
    }
  }

  /**
   * Convert DirectX .x file to GLTF using available converter
   */
  private static async convertDirectXToGltf(
    converterType: 'assimp' | 'meshlab',
    converterPath: string,
    xFilePath: string,
    outputPath: string,
    options: DirectXImportOptions
  ): Promise<void> {
    if (converterType === 'assimp') {
      return this.convertWithAssimp(converterPath, xFilePath, outputPath, options);
    } else if (converterType === 'meshlab') {
      return this.convertWithMeshlab(converterPath, xFilePath, outputPath, options);
    } else {
      throw new Error(`Unsupported converter type: ${converterType}`);
    }
  }

  /**
   * Convert using Assimp
   */
  private static async convertWithAssimp(
    converterPath: string,
    xFilePath: string,
    outputPath: string,
    options: DirectXImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'export',
        xFilePath,
        outputPath,
        '-f', 'glb2' // Export as GLB binary format
      ];

      // Add optional arguments
      if (options.includeAnimations === false) {
        args.push('--no-anim');
      }

      if (options.converterOptions?.materials !== false) {
        // Assimp includes materials by default
      }

      console.log(`Converting DirectX .x to GLTF using Assimp...`);
      
      const converterProcess = spawn(converterPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      converterProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      converterProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      converterProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Assimp conversion completed successfully');
          resolve();
        } else {
          console.error('Assimp conversion failed:', stderr);
          reject(new Error(`Assimp conversion failed with code ${code}: ${stderr}`));
        }
      });

      converterProcess.on('error', (error) => {
        reject(new Error(`Failed to start Assimp process: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        converterProcess.kill();
        reject(new Error('DirectX conversion timed out'));
      }, 60000); // 1 minute timeout
    });
  }

  /**
   * Convert using Meshlab
   */
  private static async convertWithMeshlab(
    converterPath: string,
    xFilePath: string,
    outputPath: string,
    options: DirectXImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Meshlab requires a filter script for conversion
      // For simplicity, we'll do a basic mesh-only conversion
      const args = [
        '-i', xFilePath,
        '-o', outputPath
      ];

      console.log(`Converting DirectX .x to GLTF using Meshlab...`);
      
      const converterProcess = spawn(converterPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      converterProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      converterProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      converterProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Meshlab conversion completed successfully');
          resolve();
        } else {
          console.error('Meshlab conversion failed:', stderr);
          reject(new Error(`Meshlab conversion failed with code ${code}: ${stderr}`));
        }
      });

      converterProcess.on('error', (error) => {
        reject(new Error(`Failed to start Meshlab process: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        converterProcess.kill();
        reject(new Error('DirectX conversion timed out'));
      }, 60000); // 1 minute timeout
    });
  }

  /**
   * Get basic information about a DirectX .x file
   */
  static async getDirectXInfo(xFilePath: string): Promise<{
    hasAnimations: boolean;
    hasMeshes: boolean;
    hasMaterials: boolean;
    estimatedComplexity: 'low' | 'medium' | 'high';
    isTextFormat: boolean;
  }> {
    try {
      const fs = require('fs');
      const stats = fs.statSync(xFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      // Check if file is text or binary by reading first few bytes
      const buffer = fs.readFileSync(xFilePath, { start: 0, end: 16 });
      const header = buffer.toString('ascii');
      const isTextFormat = header.startsWith('xof ');
      
      return {
        hasAnimations: true,  // DirectX .x files can have animations
        hasMeshes: true,      // Assume mesh data is present
        hasMaterials: true,   // DirectX .x supports materials
        estimatedComplexity: fileSizeMB < 0.5 ? 'low' : fileSizeMB < 5 ? 'medium' : 'high',
        isTextFormat
      };
    } catch (error) {
      throw new Error(`Failed to analyze DirectX .x file: ${error}`);
    }
  }

  /**
   * Check if a file is a valid DirectX .x file
   */
  static isDirectXFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.x');
  }

  /**
   * Validate DirectX .x file format
   */
  static async validateDirectXFile(filePath: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const buffer = fs.readFileSync(filePath, { start: 0, end: 16 });
      const header = buffer.toString('ascii');
      
      // DirectX .x files start with 'xof ' for text format
      // or have specific binary headers
      return header.startsWith('xof ') || buffer[0] === 0x78 && buffer[1] === 0x6f && buffer[2] === 0x66;
    } catch (error) {
      return false;
    }
  }

  /**
   * Export mesh to .x file
   */
  static async exportMesh(
    mesh: Mesh,
    xFilePath: string,
    options: DirectXImportOptions = {}
  ): Promise<void> {
    const result: GltfImportResult = {
      mesh,
      skeleton: undefined,
      animations: [],
      skinWeights: undefined
    };
    
    return this.exportComplete(result, xFilePath, options);
  }

  /**
   * Export complete model (mesh + skeleton + animations) to .x file
   */
  static async exportComplete(
    data: GltfImportResult,
    xFilePath: string,
    options: DirectXImportOptions = {}
  ): Promise<void> {
    // Detect converter
    const converterInfo = await this.detectConverter();
    if (!converterInfo.found) {
      throw new Error(
        'No DirectX converter found for export. Please install Assimp or Meshlab.\n' +
        'Assimp: https://assimp.org/\n' +
        'Meshlab: https://www.meshlab.net/'
      );
    }

    if (!converterInfo.hasDirectXSupport) {
      throw new Error(`Converter ${converterInfo.type} does not support DirectX .x format export`);
    }

    const converterPath = options.converterPath || converterInfo.path!;
    
    // Create temporary directory for conversion
    const tempDir = mkdtempSync(join(tmpdir(), 'directx-export-'));
    const tempGlbPath = join(tempDir, 'temp-export.glb');

    try {
      // First, export to GLTF
      console.log('📤 Converting to GLTF for DirectX export...');
      const gltfBuffer = await GltfIO.exportComplete(data);
      
      // Write temporary GLB file
      require('fs').writeFileSync(tempGlbPath, Buffer.from(gltfBuffer));
      
      // Convert GLB to DirectX .x
      if (converterInfo.type === 'assimp' || converterInfo.type === 'meshlab') {
        await this.convertGltfToDirectX(
          converterInfo.type, 
          converterPath, 
          tempGlbPath, 
          xFilePath, 
          options
        );
      } else {
        throw new Error(`Unsupported converter type for export: ${converterInfo.type}`);
      }
      
      console.log(`✅ Successfully exported DirectX .x to: ${xFilePath}`);
    } finally {
      // Cleanup temporary files
      if (options.cleanup !== false) {
        try {
          if (existsSync(tempGlbPath)) {
            unlinkSync(tempGlbPath);
          }
        } catch (error) {
          console.warn('Failed to cleanup temporary files:', error);
        }
      }
    }
  }

  /**
   * Convert GLTF to DirectX .x using available converter
   */
  private static async convertGltfToDirectX(
    converterType: 'assimp' | 'meshlab',
    converterPath: string,
    gltfFilePath: string,
    outputPath: string,
    options: DirectXImportOptions
  ): Promise<void> {
    if (converterType === 'assimp') {
      return this.convertGltfToDirectXWithAssimp(converterPath, gltfFilePath, outputPath, options);
    } else if (converterType === 'meshlab') {
      return this.convertGltfToDirectXWithMeshlab(converterPath, gltfFilePath, outputPath, options);
    } else {
      throw new Error(`Unsupported converter type: ${converterType}`);
    }
  }

  /**
   * Convert GLTF to DirectX .x using Assimp
   */
  private static async convertGltfToDirectXWithAssimp(
    converterPath: string,
    gltfFilePath: string,
    outputPath: string,
    options: DirectXImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'export',
        gltfFilePath,
        outputPath,
        '-f', 'x' // Export as DirectX .x format
      ];

      // Add optional arguments
      if (options.includeAnimations === false) {
        args.push('--no-anim');
      }

      if (options.converterOptions?.materials !== false) {
        // Assimp includes materials by default for DirectX export
      }

      console.log(`Converting GLTF to DirectX .x using Assimp...`);
      
      const converterProcess = spawn(converterPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      converterProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      converterProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      converterProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Assimp DirectX .x export completed successfully');
          resolve();
        } else {
          console.error('Assimp DirectX .x export failed:', stderr);
          reject(new Error(`Assimp DirectX .x export failed with code ${code}: ${stderr}`));
        }
      });

      converterProcess.on('error', (error) => {
        reject(new Error(`Failed to start Assimp export process: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        converterProcess.kill();
        reject(new Error('DirectX .x export conversion timed out'));
      }, 60000);
    });
  }

  /**
   * Convert GLTF to DirectX .x using Meshlab
   */
  private static async convertGltfToDirectXWithMeshlab(
    converterPath: string,
    gltfFilePath: string,
    outputPath: string,
    options: DirectXImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Meshlab basic conversion from GLTF to DirectX .x
      const args = [
        '-i', gltfFilePath,
        '-o', outputPath
      ];

      console.log(`Converting GLTF to DirectX .x using Meshlab...`);
      
      const converterProcess = spawn(converterPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      converterProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      converterProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      converterProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Meshlab DirectX .x export completed successfully');
          resolve();
        } else {
          console.error('Meshlab DirectX .x export failed:', stderr);
          reject(new Error(`Meshlab DirectX .x export failed with code ${code}: ${stderr}`));
        }
      });

      converterProcess.on('error', (error) => {
        reject(new Error(`Failed to start Meshlab export process: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        converterProcess.kill();
        reject(new Error('DirectX .x export conversion timed out'));
      }, 60000);
    });
  }
} 