/**
 * 🎨 Blender I/O - Import .blend files via Blender export
 * 
 * This module provides import functionality for Blender .blend files by:
 * 1. Detecting if Blender is installed on the system
 * 2. Using Blender's command-line interface to export .blend to .glb
 * 3. Importing the resulting GLTF data using our existing GLTF pipeline
 * 
 * Requirements:
 * - Blender must be installed and accessible via command line
 * - Blender 2.8+ recommended for best GLTF export support
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
 * Blender installation detection result
 */
export interface BlenderInstallation {
  found: boolean;
  version?: string;
  path?: string;
  hasGltfExport: boolean;
}

/**
 * Options for Blender import
 */
export interface BlenderImportOptions {
  /** Blender executable path (auto-detected if not provided) */
  blenderPath?: string;
  /** Whether to import animations */
  includeAnimations?: boolean;
  /** Whether to import skeletal data */
  includeSkeleton?: boolean;
  /** Whether to clean up temporary files */
  cleanup?: boolean;
  /** Additional Blender export options */
  exportOptions?: {
    /** Export selected objects only */
    exportSelected?: boolean;
    /** Include materials */
    exportMaterials?: boolean;
    /** Include textures */
    exportTextures?: boolean;
    /** Animation export mode */
    exportAnimations?: 'ACTIONS' | 'ACTIVE' | 'NLA_TRACKS';
  };
}

/**
 * Blender I/O class for importing .blend files
 */
export class BlenderIO {
  private static blenderPaths = [
    // Windows
    'blender',
    'blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
    // macOS
    '/Applications/Blender.app/Contents/MacOS/Blender',
    // Linux
    '/usr/bin/blender',
    '/usr/local/bin/blender',
    '/snap/bin/blender'
  ];

  /**
   * Detect Blender installation
   */
  static async detectBlender(): Promise<BlenderInstallation> {
    for (const blenderPath of this.blenderPaths) {
      try {
        // Try to run blender --version
        const command = `"${blenderPath}" --version`;
        const output = execSync(command, { 
          timeout: 10000, 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
        });
        
        const version = this.parseBlenderVersion(output);
        const hasGltfExport = this.checkGltfExportSupport(version);
        
        return {
          found: true,
          version,
          path: blenderPath,
          hasGltfExport
        };
      } catch (error) {
        // Continue to next path
        continue;
      }
    }
    
    return {
      found: false,
      hasGltfExport: false
    };
  }

  /**
   * Parse Blender version from output
   */
  private static parseBlenderVersion(output: string): string {
    const match = output.match(/Blender (\d+\.\d+(?:\.\d+)?)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Check if Blender version supports GLTF export
   */
  private static checkGltfExportSupport(version: string): boolean {
    const [major, minor] = version.split('.').map(Number);
    // GLTF export was added in Blender 2.8
    return major > 2 || (major === 2 && minor >= 8);
  }

  /**
   * Import mesh from .blend file
   */
  static async importMesh(
    blendFilePath: string, 
    options: BlenderImportOptions = {}
  ): Promise<Mesh> {
    const result = await this.importComplete(blendFilePath, options);
    return result.mesh;
  }

  /**
   * Import complete model (mesh + skeleton + animations) from .blend file
   */
  static async importComplete(
    blendFilePath: string,
    options: BlenderImportOptions = {}
  ): Promise<GltfImportResult> {
    // Check if file exists
    if (!existsSync(blendFilePath)) {
      throw new Error(`Blend file not found: ${blendFilePath}`);
    }

    // Detect Blender installation
    const blenderInfo = await this.detectBlender();
    if (!blenderInfo.found) {
      throw new Error('Blender installation not found. Please install Blender and ensure it\'s in your PATH.');
    }

    if (!blenderInfo.hasGltfExport) {
      throw new Error(`Blender version ${blenderInfo.version} does not support GLTF export. Please use Blender 2.8 or later.`);
    }

    const blenderPath = options.blenderPath || blenderInfo.path!;
    
    // Create temporary directory for export
    const tempDir = mkdtempSync(join(tmpdir(), 'blender-export-'));
    const tempGlbPath = join(tempDir, 'exported.glb');

    try {
      // Export .blend to .glb using Blender
      await this.exportBlendToGltf(blenderPath, blendFilePath, tempGlbPath, options);
      
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
          // Note: We don't remove the temp directory as it might be used by other processes
        } catch (error) {
          console.warn('Failed to cleanup temporary files:', error);
        }
      }
    }
  }

  /**
   * Export .blend file to GLTF using Blender command line
   */
  private static async exportBlendToGltf(
    blenderPath: string,
    blendFilePath: string,
    outputPath: string,
    options: BlenderImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Build Blender Python script for export
      const pythonScript = this.buildExportScript(outputPath, options);
      
      // Blender command: blender file.blend --background --python-expr "script"
      const args = [
        blendFilePath,
        '--background', // Run without UI
        '--python-expr', pythonScript
      ];

      console.log(`Exporting ${blendFilePath} to GLTF using Blender...`);
      
      const blenderProcess = spawn(blenderPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      blenderProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      blenderProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      blenderProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Blender export completed successfully');
          resolve();
        } else {
          console.error('Blender export failed:', stderr);
          reject(new Error(`Blender export failed with code ${code}: ${stderr}`));
        }
      });

      blenderProcess.on('error', (error) => {
        reject(new Error(`Failed to start Blender process: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        blenderProcess.kill();
        reject(new Error('Blender export timed out'));
      }, 60000); // 60 second timeout
    });
  }

  /**
   * Build Python script for Blender GLTF export
   */
  private static buildExportScript(outputPath: string, options: BlenderImportOptions): string {
    const exportOptions = options.exportOptions || {};
    
    return `
import bpy
import os

# Clear default scene
bpy.ops.object.select_all(action='SELECT')
if not ${exportOptions.exportSelected || false}:
    bpy.ops.object.delete(use_global=False)

# Set export options
export_settings = {
    'filepath': '${outputPath.replace(/\\/g, '\\\\')}',
    'export_format': 'GLB',
    'export_materials': '${exportOptions.exportMaterials !== false ? 'EXPORT' : 'NONE'}',
    'export_images': ${exportOptions.exportTextures !== false},
    'export_animations': ${options.includeAnimations !== false},
    'export_skins': ${options.includeSkeleton !== false},
    'export_morph': True,
    'export_apply': False,
    'export_selected': ${exportOptions.exportSelected || false}
}

# Export to GLTF
try:
    bpy.ops.export_scene.gltf(**export_settings)
    print("GLTF export successful")
except Exception as e:
    print(f"GLTF export failed: {e}")
    import sys
    sys.exit(1)
`;
  }

  /**
   * Get information about a .blend file (requires Blender)
   */
  static async getBlendInfo(blendFilePath: string): Promise<{
    hasObjects: boolean;
    hasMeshes: boolean;
    hasAnimations: boolean;
    hasArmatures: boolean;
    objectCount: number;
    meshCount: number;
    animationCount: number;
    armatureCount: number;
  }> {
    const blenderInfo = await this.detectBlender();
    if (!blenderInfo.found) {
      throw new Error('Blender installation not found');
    }

    const pythonScript = `
import bpy
import json

# Load the blend file
bpy.ops.wm.open_mainfile(filepath='${blendFilePath.replace(/\\/g, '\\\\')}')

# Gather information
info = {
    'objectCount': len(bpy.data.objects),
    'meshCount': len(bpy.data.meshes),
    'animationCount': len(bpy.data.actions),
    'armatureCount': len(bpy.data.armatures),
    'hasObjects': len(bpy.data.objects) > 0,
    'hasMeshes': len(bpy.data.meshes) > 0,
    'hasAnimations': len(bpy.data.actions) > 0,
    'hasArmatures': len(bpy.data.armatures) > 0
}

print("BLEND_INFO:" + json.dumps(info))
`;

    try {
      const output = execSync(`"${blenderInfo.path}" "${blendFilePath}" --background --python-expr "${pythonScript}"`, {
        encoding: 'utf8',
        timeout: 30000
      });

      const infoMatch = output.match(/BLEND_INFO:(.+)/);
      if (infoMatch) {
        return JSON.parse(infoMatch[1]);
      } else {
        throw new Error('Failed to parse blend file information');
      }
    } catch (error) {
      throw new Error(`Failed to get blend file info: ${error}`);
    }
  }

  /**
   * Check if a file is a valid Blender file
   */
  static isBlendFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.blend');
  }

  /**
   * Export mesh to .blend file
   */
  static async exportMesh(
    mesh: Mesh,
    blendFilePath: string,
    options: BlenderImportOptions = {}
  ): Promise<void> {
    const data: GltfImportResult = {
      mesh,
      skeleton: undefined,
      animations: [],
      skinWeights: undefined
    };
    
    return this.exportComplete(data, blendFilePath, options);
  }

  /**
   * Export complete model (mesh + skeleton + animations) to .blend file
   */
  static async exportComplete(
    data: GltfImportResult,
    blendFilePath: string,
    options: BlenderImportOptions = {}
  ): Promise<void> {
    // Detect Blender installation
    const blenderInfo = await this.detectBlender();
    if (!blenderInfo.found) {
      throw new Error('Blender installation not found. Please install Blender and ensure it\'s in your PATH.');
    }

    if (!blenderInfo.hasGltfExport) {
      throw new Error(`Blender version ${blenderInfo.version} does not support GLTF import/export. Please use Blender 2.8 or later.`);
    }

    const blenderPath = options.blenderPath || blenderInfo.path!;
    
    // Create temporary directory for conversion
    const tempDir = mkdtempSync(join(tmpdir(), 'blender-import-'));
    const tempGlbPath = join(tempDir, 'temp-export.glb');

    try {
      // First, export to GLTF
      console.log('📤 Converting to GLTF for Blender import...');
      const gltfBuffer = await GltfIO.exportComplete(data);
      
      // Write temporary GLB file
      require('fs').writeFileSync(tempGlbPath, Buffer.from(gltfBuffer));
      
      // Import GLB into Blender and save as .blend
      await this.importGltfToBlend(blenderPath, tempGlbPath, blendFilePath, options);
      
      console.log(`✅ Successfully exported Blender file to: ${blendFilePath}`);
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
   * Import GLTF into Blender and save as .blend file
   */
  private static async importGltfToBlend(
    blenderPath: string,
    gltfFilePath: string,
    outputPath: string,
    options: BlenderImportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Build Python script for importing GLTF and saving as .blend
      const pythonScript = this.buildImportScript(gltfFilePath, outputPath, options);
      
      // Execute Blender with the script
      const args = [
        '--background',
        '--python-expr', pythonScript
      ];

      console.log(`Importing GLTF into Blender and saving as .blend...`);
      
      const blenderProcess = spawn(blenderPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      blenderProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      blenderProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      blenderProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Blender import and save completed successfully');
          resolve();
        } else {
          console.error('Blender import/save failed:', stderr);
          reject(new Error(`Blender import/save failed with code ${code}: ${stderr}`));
        }
      });

      blenderProcess.on('error', (error) => {
        reject(new Error(`Failed to start Blender process: ${error.message}`));
      });

      // Set timeout for large files
      setTimeout(() => {
        blenderProcess.kill();
        reject(new Error('Blender import/save operation timed out'));
      }, 180000); // 3 minute timeout
    });
  }

  /**
   * Build Python script for importing GLTF and saving as .blend
   */
  private static buildImportScript(
    gltfFilePath: string, 
    outputPath: string, 
    options: BlenderImportOptions
  ): string {
    const escapedGltfPath = gltfFilePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedOutputPath = outputPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    return `
import bpy
import os

# Clear default scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Import GLTF file
try:
    bpy.ops.import_scene.gltf(filepath='${escapedGltfPath}')
    print("GLTF imported successfully")
except Exception as e:
    print(f"Failed to import GLTF: {e}")
    exit(1)

# Optional: Set import options based on parameters
${options.exportOptions?.exportSelected ? "bpy.ops.object.select_all(action='DESELECT')" : ""}

# Save as .blend file
try:
    bpy.ops.wm.save_as_mainfile(filepath='${escapedOutputPath}')
    print("Blend file saved successfully")
except Exception as e:
    print(f"Failed to save blend file: {e}")
    exit(1)

print("Export to Blender completed successfully")
`;
  }
} 