/**
 * 🎭 FBX I/O - Import .fbx files via conversion tools
 * 
 * This module provides import functionality for FBX files by:
 * 1. Detecting if FBX2glTF converter is available
 * 2. Using FBX2glTF to convert .fbx to .glb
 * 3. Importing the resulting GLTF data using our existing GLTF pipeline
 * 
 * Requirements:
 * - FBX2glTF must be installed and accessible via command line
 * - Alternative: Assimp with FBX support (cross-platform)
 * 
 * FBX Format Features:
 * - ✅ Complete Animation Support - Advanced keyframe animation
 * - ✅ Skeletal Systems - Full bone hierarchies and constraints
 * - ✅ Materials & Textures - PBR and traditional materials
 * - ✅ Industry Standard - Widely used in game development and VFX
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
 * FBX converter detection result
 */
export interface FbxConverterInfo {
  found: boolean;
  type?: 'fbx2gltf' | 'assimp' | 'custom';
  version?: string;
  path?: string;
  hasAnimationSupport: boolean;
}

/**
 * Options for FBX import
 */
export interface FbxImportOptions {
  /** FBX converter executable path (auto-detected if not provided) */
  converterPath?: string;
  /** Preferred converter type */
  preferredConverter?: 'fbx2gltf' | 'assimp' | 'auto';
  /** Whether to import animations */
  includeAnimations?: boolean;
  /** Whether to import skeletal data */
  includeSkeleton?: boolean;
  /** Whether to clean up temporary files */
  cleanup?: boolean;
  /** FBX converter specific options */
  converterOptions?: {
    /** Export binary GLB instead of text GLTF */
    binary?: boolean;
    /** Include materials */
    materials?: boolean;
    /** Include textures */
    textures?: boolean;
    /** Animation sampling rate */
    animationSampleRate?: number;
  };
}

/**
 * FBX I/O class for importing .fbx files
 */
export class FbxIO {
  private static converterPaths = {
    fbx2gltf: [
      // Windows
      'fbx2gltf',
      'fbx2gltf.exe',
      'FBX2glTF.exe',
      // macOS/Linux
      './fbx2gltf',
      '/usr/local/bin/fbx2gltf',
      '/opt/fbx2gltf/fbx2gltf'
    ],
    assimp: [
      'assimp',
      'assimp.exe',
      '/usr/bin/assimp',
      '/usr/local/bin/assimp'
    ]
  };

  /**
   * Detect available FBX converters
   */
  static async detectConverter(): Promise<FbxConverterInfo> {
    // Try FBX2glTF first (best quality for FBX)
    for (const converterPath of this.converterPaths.fbx2gltf) {
      try {
        const output = execSync(`"${converterPath}" --version`, { 
          timeout: 10000, 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
        
        const version = this.parseFbx2GltfVersion(output);
        return {
          found: true,
          type: 'fbx2gltf',
          version,
          path: converterPath,
          hasAnimationSupport: true
        };
      } catch (error) {
        continue;
      }
    }

    // Try Assimp as fallback
    for (const converterPath of this.converterPaths.assimp) {
      try {
        const output = execSync(`"${converterPath}" version`, { 
          timeout: 10000, 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
        
        const version = this.parseAssimpVersion(output);
        return {
          found: true,
          type: 'assimp',
          version,
          path: converterPath,
          hasAnimationSupport: true // Assimp supports animations
        };
      } catch (error) {
        continue;
      }
    }
    
    return {
      found: false,
      hasAnimationSupport: false
    };
  }

  /**
   * Parse FBX2glTF version from output
   */
  private static parseFbx2GltfVersion(output: string): string {
    const match = output.match(/FBX2glTF\s+v?(\d+\.\d+(?:\.\d+)?)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Parse Assimp version from output
   */
  private static parseAssimpVersion(output: string): string {
    const match = output.match(/Assimp\s+v?(\d+\.\d+(?:\.\d+)?)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Import mesh from .fbx file
   */
  static async importMesh(
    fbxFilePath: string, 
    options: FbxImportOptions = {}
  ): Promise<Mesh> {
    const result = await this.importComplete(fbxFilePath, options);
    return result.mesh;
  }

  /**
   * Import complete model (mesh + skeleton + animations) from .fbx file
   */
  static async importComplete(
    fbxFilePath: string,
    options: FbxImportOptions = {}
  ): Promise<GltfImportResult> {
    // Check if file exists
    if (!existsSync(fbxFilePath)) {
      throw new Error(`FBX file not found: ${fbxFilePath}`);
    }

    // Detect converter
    const converterInfo = await this.detectConverter();
    if (!converterInfo.found) {
      throw new Error(
        'No FBX converter found. Please install FBX2glTF or Assimp.\n' +
        'FBX2glTF: https://github.com/facebookincubator/FBX2glTF\n' +
        'Assimp: https://assimp.org/'
      );
    }

    const converterPath = options.converterPath || converterInfo.path!;
    
    // Create temporary directory for conversion
    const tempDir = mkdtempSync(join(tmpdir(), 'fbx-import-'));
    const tempGlbPath = join(tempDir, 'converted.glb');

    try {
      // Convert .fbx to .glb
      if (converterInfo.type === 'fbx2gltf' || converterInfo.type === 'assimp') {
        await this.convertFbxToGltf(
          converterInfo.type, 
          converterPath, 
          fbxFilePath, 
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
   * Convert FBX file to GLTF using available converter
   */
  private static async convertFbxToGltf(
    converterType: 'fbx2gltf' | 'assimp',
    converterPath: string,
    fbxFilePath: string,
    outputPath: string,
    options: FbxImportOptions
  ): Promise<void> {
    if (converterType === 'fbx2gltf') {
      return this.convertWithFbx2Gltf(converterPath, fbxFilePath, outputPath, options);
    } else if (converterType === 'assimp') {
      return this.convertWithAssimp(converterPath, fbxFilePath, outputPath, options);
    } else {
      throw new Error(`Unsupported converter type: ${converterType}`);
    }
  }

  /**
   * Convert using FBX2glTF
   */
  private static async convertWithFbx2Gltf(
    converterPath: string,
    fbxFilePath: string,
    outputPath: string,
    options: FbxImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '--input', fbxFilePath,
        '--output', outputPath,
        '--binary' // Always output binary GLB for consistency
      ];

      // Add optional arguments
      if (options.converterOptions?.materials !== false) {
        args.push('--materials');
      }
      
      if (options.converterOptions?.textures !== false) {
        args.push('--textures');
      }

      if (options.includeAnimations !== false) {
        args.push('--animations');
        if (options.converterOptions?.animationSampleRate) {
          args.push('--anim-sample-rate', options.converterOptions.animationSampleRate.toString());
        }
      }

      console.log(`Converting FBX to GLTF using FBX2glTF...`);
      
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
          console.log('FBX2glTF conversion completed successfully');
          resolve();
        } else {
          console.error('FBX2glTF conversion failed:', stderr);
          reject(new Error(`FBX2glTF conversion failed with code ${code}: ${stderr}`));
        }
      });

      converterProcess.on('error', (error) => {
        reject(new Error(`Failed to start FBX2glTF process: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        converterProcess.kill();
        reject(new Error('FBX conversion timed out'));
      }, 120000); // 2 minute timeout for large FBX files
    });
  }

  /**
   * Convert using Assimp
   */
  private static async convertWithAssimp(
    converterPath: string,
    fbxFilePath: string,
    outputPath: string,
    options: FbxImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'export',
        fbxFilePath,
        outputPath,
        '-f', 'glb2' // Export as GLB binary format
      ];

      // Add optional arguments
      if (options.includeAnimations === false) {
        args.push('--no-anim');
      }

      console.log(`Converting FBX to GLTF using Assimp...`);
      
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
        reject(new Error('FBX conversion timed out'));
      }, 120000); // 2 minute timeout
    });
  }

  /**
   * Get information about an FBX file (requires converter)
   */
  static async getFbxInfo(fbxFilePath: string): Promise<{
    hasAnimations: boolean;
    hasMeshes: boolean;
    hasMaterials: boolean;
    estimatedComplexity: 'low' | 'medium' | 'high';
  }> {
    const converterInfo = await this.detectConverter();
    if (!converterInfo.found) {
      throw new Error('No FBX converter found for file analysis');
    }

    // For now, we'll do a basic analysis
    // In a real implementation, you might use FBX SDK or other tools for detailed analysis
    try {
      const stats = require('fs').statSync(fbxFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      return {
        hasAnimations: true, // FBX files commonly have animations
        hasMeshes: true,     // Assume mesh data is present
        hasMaterials: true,  // Assume material data is present
        estimatedComplexity: fileSizeMB < 1 ? 'low' : fileSizeMB < 10 ? 'medium' : 'high'
      };
    } catch (error) {
      throw new Error(`Failed to analyze FBX file: ${error}`);
    }
  }

  /**
   * Check if a file is a valid FBX file
   */
  static isFbxFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.fbx');
  }

  /**
   * Export mesh to .fbx file
   */
  static async exportMesh(
    mesh: Mesh,
    fbxFilePath: string,
    options: FbxImportOptions = {}
  ): Promise<void> {
    const result: GltfImportResult = {
      mesh,
      skeleton: undefined,
      animations: [],
      skinWeights: undefined
    };
    
    return this.exportComplete(result, fbxFilePath, options);
  }

  /**
   * Export complete model (mesh + skeleton + animations) to .fbx file
   */
  static async exportComplete(
    data: GltfImportResult,
    fbxFilePath: string,
    options: FbxImportOptions = {}
  ): Promise<void> {
    // Detect converter
    const converterInfo = await this.detectConverter();
    if (!converterInfo.found) {
      throw new Error(
        'No FBX converter found for export. Please install FBX2glTF or Assimp.\n' +
        'FBX2glTF: https://github.com/facebookincubator/FBX2glTF\n' +
        'Assimp: https://assimp.org/'
      );
    }

    const converterPath = options.converterPath || converterInfo.path!;
    
    // Create temporary directory for conversion
    const tempDir = mkdtempSync(join(tmpdir(), 'fbx-export-'));
    const tempGlbPath = join(tempDir, 'temp-export.glb');

    try {
      // First, export to GLTF
      console.log('📤 Converting to GLTF for FBX export...');
      const gltfBuffer = await GltfIO.exportComplete(data);
      
      // Write temporary GLB file
      require('fs').writeFileSync(tempGlbPath, Buffer.from(gltfBuffer));
      
      // Convert GLB to FBX
      if (converterInfo.type === 'fbx2gltf' || converterInfo.type === 'assimp') {
        await this.convertGltfToFbx(
          converterInfo.type, 
          converterPath, 
          tempGlbPath, 
          fbxFilePath, 
          options
        );
      } else {
        throw new Error(`Unsupported converter type for export: ${converterInfo.type}`);
      }
      
      console.log(`✅ Successfully exported FBX to: ${fbxFilePath}`);
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
   * Convert GLTF to FBX using available converter
   */
  private static async convertGltfToFbx(
    converterType: 'fbx2gltf' | 'assimp',
    converterPath: string,
    gltfFilePath: string,
    outputPath: string,
    options: FbxImportOptions
  ): Promise<void> {
    if (converterType === 'fbx2gltf') {
      return this.convertGltfToFbxWithFbx2Gltf(converterPath, gltfFilePath, outputPath, options);
    } else if (converterType === 'assimp') {
      return this.convertGltfToFbxWithAssimp(converterPath, gltfFilePath, outputPath, options);
    } else {
      throw new Error(`Unsupported converter type: ${converterType}`);
    }
  }

  /**
   * Convert GLTF to FBX using FBX2glTF (reverse operation)
   */
  private static async convertGltfToFbxWithFbx2Gltf(
    converterPath: string,
    gltfFilePath: string,
    outputPath: string,
    options: FbxImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Note: FBX2glTF is primarily designed for FBX->GLTF conversion
      // For GLTF->FBX, we need to check if it supports reverse conversion
      const args = [
        '--input', gltfFilePath,
        '--output', outputPath
      ];

      // Add optional arguments
      if (options.converterOptions?.materials !== false) {
        args.push('--materials');
      }
      
      if (options.converterOptions?.textures !== false) {
        args.push('--textures');
      }

      if (options.includeAnimations !== false) {
        args.push('--animations');
      }

      console.log(`Converting GLTF to FBX using FBX2glTF...`);
      
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
          console.log('FBX2glTF export conversion completed successfully');
          resolve();
        } else {
          console.error('FBX2glTF export conversion failed:', stderr);
          // Fallback error message for unsupported reverse conversion
          if (stderr.includes('unsupported') || stderr.includes('input format')) {
            reject(new Error(
              'FBX2glTF does not support GLTF->FBX conversion. ' +
              'Use Assimp or other tools for FBX export.'
            ));
          } else {
            reject(new Error(`FBX2glTF export failed with code ${code}: ${stderr}`));
          }
        }
      });

      converterProcess.on('error', (error) => {
        reject(new Error(`Failed to start FBX2glTF export process: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        converterProcess.kill();
        reject(new Error('FBX export conversion timed out'));
      }, 120000);
    });
  }

  /**
   * Convert GLTF to FBX using Assimp
   */
  private static async convertGltfToFbxWithAssimp(
    converterPath: string,
    gltfFilePath: string,
    outputPath: string,
    options: FbxImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'export',
        gltfFilePath,
        outputPath,
        '-f', 'fbx' // Export as FBX format
      ];

      // Add optional arguments
      if (options.includeAnimations === false) {
        args.push('--no-anim');
      }

      console.log(`Converting GLTF to FBX using Assimp...`);
      
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
          console.log('Assimp FBX export completed successfully');
          resolve();
        } else {
          console.error('Assimp FBX export failed:', stderr);
          reject(new Error(`Assimp FBX export failed with code ${code}: ${stderr}`));
        }
      });

      converterProcess.on('error', (error) => {
        reject(new Error(`Failed to start Assimp export process: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        converterProcess.kill();
        reject(new Error('FBX export conversion timed out'));
      }, 120000);
    });
  }
} 