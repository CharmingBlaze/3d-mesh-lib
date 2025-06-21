/**
 * 🗃️ GLTF I/O Module - Complete GLTF import/export functionality
 * 
 * A comprehensive GLTF module that provides:
 * - ✅ Basic mesh import/export
 * - ✅ Skeletal animation support
 * - ✅ Bone hierarchy and skinning
 * - ✅ Animation clips and keyframes
 * - ✅ Material and texture support
 * 
 * This module serves as the main entry point for all GLTF operations,
 * combining the specialized functionality from sub-modules.
 */

import { Mesh } from '../../core/Mesh';
import { Skeleton } from '../../core/Skeleton';
import { AnimationClip } from '../../core/Animation';
import { SkinWeights } from '../../core/Skinning';
import { GltfBasicIO } from './basic';
import { GltfSkeletonIO } from './skeleton';
import { GltfAnimationIO } from './animation';
import { ProcessedGltf, GLTF_COMPONENT_TYPES } from './types';

// Re-export types for convenience
export * from './types';

/**
 * Complete GLTF import result with all possible data
 */
export interface GltfImportResult {
  /** Imported mesh geometry */
  mesh: Mesh;
  /** Skeletal structure (if present) */
  skeleton?: Skeleton;
  /** Animation clips (if present) */
  animations?: AnimationClip[];
  /** Skin weights for vertex-bone binding (if present) */
  skinWeights?: SkinWeights;
}

/**
 * 🎯 Main GLTF I/O Class - Unified interface for all GLTF operations
 * 
 * This class provides high-level methods that combine basic mesh, skeletal,
 * and animation functionality for complete GLTF import/export workflows.
 */
export class GltfIO {
  /**
   * Import basic mesh from GLTF (geometry and materials only)
   * 
   * @param gltfDataUrlOrArrayBuffer GLTF file URL or ArrayBuffer
   * @param options Import options
   * @returns Promise resolving to Mesh
   */
  static async importMesh(gltfDataUrlOrArrayBuffer: string | ArrayBuffer, options?: any): Promise<Mesh> {
    return GltfBasicIO.importMesh(gltfDataUrlOrArrayBuffer, options);
  }

  /**
   * Export basic mesh to GLTF binary format
   * 
   * @param mesh Mesh to export
   * @param options Export options
   * @returns Promise resolving to ArrayBuffer (GLB format)
   */
  static async exportMesh(mesh: Mesh, options?: any): Promise<ArrayBuffer> {
    return GltfBasicIO.exportMesh(mesh, options);
  }

  /**
   * Import complete 3D model with animations and skeletal data
   * 
   * @param gltfDataUrlOrArrayBuffer GLTF file URL or ArrayBuffer
   * @param options Import options
   * @returns Promise resolving to complete import result
   */
  static async importComplete(gltfDataUrlOrArrayBuffer: string | ArrayBuffer, options?: any): Promise<GltfImportResult> {
    console.log('Starting complete GLTF import (mesh + skeleton + animations)...');
    
    try {
      // Import basic mesh first
      const mesh = await GltfBasicIO.importMesh(gltfDataUrlOrArrayBuffer, options);
      
      // Try to import skeleton
      const skeleton = await GltfSkeletonIO.importSkeleton(gltfDataUrlOrArrayBuffer, options);
      
      // Import animations if skeleton exists
      let animations: AnimationClip[] = [];
      if (skeleton) {
        animations = await GltfAnimationIO.importAnimations(gltfDataUrlOrArrayBuffer, skeleton, options);
      }
      
      // Import skin weights if skeleton exists
      let skinWeights: SkinWeights | undefined;
      if (skeleton) {
        // We need to re-load the GLTF data for skin weights import
        // This is less efficient but ensures we have all the data we need
        const { load } = await import('@loaders.gl/core');
        const { GLTFLoader } = await import('@loaders.gl/gltf');
        const gltfData = await load(gltfDataUrlOrArrayBuffer, GLTFLoader, options);
        // Type cast to our expected format since loaders.gl types don't perfectly match
        const gltf = gltfData as any as ProcessedGltf;
        skinWeights = GltfSkeletonIO.importSkinWeights(gltf, mesh, skeleton);
      }
      
      console.log('Complete GLTF import finished:', {
        vertices: mesh.vertices.size,
        faces: mesh.faces.size,
        materials: mesh.materials?.size || 0,
        bones: skeleton?.getAllBones().length || 0,
        animations: animations.length,
        hasSkinWeights: !!skinWeights
      });
      
      return {
        mesh,
        skeleton,
        animations: animations.length > 0 ? animations : undefined,
        skinWeights
      };
      
    } catch (error) {
      console.error('Error during complete GLTF import:', error);
      
      // Fallback to basic mesh import
      const mesh = await GltfBasicIO.importMesh(gltfDataUrlOrArrayBuffer, options);
      return { mesh };
    }
  }

  /**
   * Export complete 3D model with animations and skeletal data
   * 
   * @param data Complete model data to export
   * @param options Export options
   * @returns Promise resolving to ArrayBuffer (GLB format)
   */
  static async exportComplete(data: GltfImportResult, options?: any): Promise<ArrayBuffer> {
    console.log('Starting complete GLTF export (mesh + skeleton + animations)...');
    
    try {
      const { mesh, skeleton, animations, skinWeights } = data;
      
      if (!skeleton && !animations) {
        // If no skeletal data, use basic export
        return GltfBasicIO.exportMesh(mesh, options);
      }
      
      // Build comprehensive GLTF structure
      const gltfData = await this.buildCompleteGltfData(mesh, skeleton, animations, skinWeights);
      
      // Export using loaders.gl
      const { encode } = await import('@loaders.gl/core');
      const { GLTFWriter } = await import('@loaders.gl/gltf');
      
      const writerOptions = {
        ...options,
        binaryChunk: gltfData.bufferData
      };
      
      const glbArrayBuffer = await encode(gltfData.gltfJson, GLTFWriter, writerOptions);
      
      console.log('Complete GLTF export finished.');
      return glbArrayBuffer;
      
    } catch (error) {
      console.error('Error during complete GLTF export:', error);
      
      // Fallback to basic mesh export
      return GltfBasicIO.exportMesh(data.mesh, options);
    }
  }

  /**
   * Import only skeleton data from GLTF
   * 
   * @param gltfDataUrlOrArrayBuffer GLTF file URL or ArrayBuffer
   * @param options Import options
   * @returns Promise resolving to Skeleton or undefined
   */
  static async importSkeleton(gltfDataUrlOrArrayBuffer: string | ArrayBuffer, options?: any): Promise<Skeleton | undefined> {
    return GltfSkeletonIO.importSkeleton(gltfDataUrlOrArrayBuffer, options);
  }

  /**
   * Import only animation data from GLTF
   * 
   * @param gltfDataUrlOrArrayBuffer GLTF file URL or ArrayBuffer
   * @param skeleton Associated skeleton (optional)
   * @param options Import options
   * @returns Promise resolving to array of AnimationClips
   */
  static async importAnimations(
    gltfDataUrlOrArrayBuffer: string | ArrayBuffer,
    skeleton?: Skeleton,
    options?: any
  ): Promise<AnimationClip[]> {
    return GltfAnimationIO.importAnimations(gltfDataUrlOrArrayBuffer, skeleton, options);
  }

  /**
   * Export only animation data to GLTF format
   * 
   * @param animations Animation clips to export
   * @param skeleton Associated skeleton (optional)
   * @param options Export options
   * @returns Promise resolving to ArrayBuffer
   */
  static async exportAnimations(
    animations: AnimationClip[],
    skeleton?: Skeleton,
    options?: any
  ): Promise<ArrayBuffer> {
    const animationData = GltfAnimationIO.exportAnimations(animations, skeleton);
    
    // Create minimal GLTF structure for animations only
    const gltfJson = {
      asset: {
        version: '2.0',
        generator: '3d-mesh-lib - Animation Export'
      },
      animations: animationData.animations,
      accessors: animationData.accessors,
      bufferViews: animationData.bufferViews,
      buffers: animationData.bufferData.map(buffer => ({ byteLength: buffer.byteLength }))
    };
    
    const { encode } = await import('@loaders.gl/core');
    const { GLTFWriter } = await import('@loaders.gl/gltf');
    
    const writerOptions = {
      ...options,
      binaryChunk: animationData.bufferData
    };
    
    return encode(gltfJson, GLTFWriter, writerOptions);
  }

  /**
   * Check if a GLTF file contains skeletal animation data
   * 
   * @param gltfDataUrlOrArrayBuffer GLTF file URL or ArrayBuffer
   * @param options Check options
   * @returns Promise resolving to boolean
   */
  static async hasSkeletalAnimation(gltfDataUrlOrArrayBuffer: string | ArrayBuffer, options?: any): Promise<boolean> {
    try {
      const { load } = await import('@loaders.gl/core');
      const { GLTFLoader } = await import('@loaders.gl/gltf');
      
      const gltf = await load(gltfDataUrlOrArrayBuffer, GLTFLoader, options);
      
      return !!(gltf?.json?.skins && gltf.json.skins.length > 0) ||
             !!(gltf?.json?.animations && gltf.json.animations.length > 0);
             
    } catch (error) {
      console.warn('Error checking for skeletal animation:', error);
      return false;
    }
  }

  /**
   * Get basic info about a GLTF file without full import
   * 
   * @param gltfDataUrlOrArrayBuffer GLTF file URL or ArrayBuffer
   * @param options Info options
   * @returns Promise resolving to file info
   */
  static async getInfo(gltfDataUrlOrArrayBuffer: string | ArrayBuffer, options?: any): Promise<{
    hasMeshes: boolean;
    hasAnimations: boolean;
    hasSkins: boolean;
    meshCount: number;
    animationCount: number;
    nodeCount: number;
    materialCount: number;
  }> {
    try {
      const { load } = await import('@loaders.gl/core');
      const { GLTFLoader } = await import('@loaders.gl/gltf');
      
      const gltf = await load(gltfDataUrlOrArrayBuffer, GLTFLoader, options);
      const json = gltf?.json;
      
      return {
        hasMeshes: !!(json?.meshes && json.meshes.length > 0),
        hasAnimations: !!(json?.animations && json.animations.length > 0),
        hasSkins: !!(json?.skins && json.skins.length > 0),
        meshCount: json?.meshes?.length || 0,
        animationCount: json?.animations?.length || 0,
        nodeCount: json?.nodes?.length || 0,
        materialCount: json?.materials?.length || 0
      };
      
    } catch (error) {
      console.warn('Error getting GLTF info:', error);
      return {
        hasMeshes: false,
        hasAnimations: false,
        hasSkins: false,
        meshCount: 0,
        animationCount: 0,
        nodeCount: 0,
        materialCount: 0
      };
    }
  }

  /**
   * Build complete GLTF data structure combining all components
   */
  private static async buildCompleteGltfData(
    mesh: Mesh,
    skeleton?: Skeleton,
    animations?: AnimationClip[],
    skinWeights?: SkinWeights
  ): Promise<{ gltfJson: any; bufferData: ArrayBuffer[] }> {
    // Start with basic mesh export
    const basicData = GltfBasicIO['buildGltfFromMesh'](mesh);
    let gltfJson = basicData.gltfJson;
    let bufferData = basicData.bufferData;
    
    // Add skeleton data if present
    if (skeleton) {
      const skeletonData = GltfSkeletonIO.exportSkeleton(skeleton);
      
      // Merge skeleton nodes into existing nodes
      const nodeOffset = gltfJson.nodes?.length || 0;
      gltfJson.nodes = [...(gltfJson.nodes || []), ...skeletonData.nodes];
      
      // Add skin
      gltfJson.skins = [skeletonData.skin];
      
      // Update node references in skin
      if (gltfJson.skins[0].joints) {
        gltfJson.skins[0].joints = gltfJson.skins[0].joints.map((joint: number) => joint + nodeOffset);
      }
      
      // Link mesh to skin
      if (gltfJson.nodes[0]) {
        gltfJson.nodes[0].skin = 0; // skin index 0, assuming the first mesh node is skinned
      }

      // Add Inverse Bind Matrices (IBMs) if available
      if (skeletonData.inverseBindMatricesData && skeletonData.inverseBindMatricesData.length > 0) {
        const ibmData = skeletonData.inverseBindMatricesData;

        // Create buffer for IBMs
        const ibmBufferIndex = gltfJson.buffers.length;
        gltfJson.buffers.push({ byteLength: ibmData.byteLength });
        bufferData.push(ibmData.buffer); // Add the actual ArrayBuffer

        // Create bufferView for IBMs
        const ibmBufferViewIndex = gltfJson.bufferViews.length;
        gltfJson.bufferViews.push({
          buffer: ibmBufferIndex,
          byteOffset: 0,
          byteLength: ibmData.byteLength,
          // target: GLTF_BUFFERVIEW_TARGETS.ARRAY_BUFFER // Optional target for IBMs
        });

        // Create accessor for IBMs
        const ibmAccessorIndex = gltfJson.accessors.length;
        gltfJson.accessors.push({
          bufferView: ibmBufferViewIndex,
          byteOffset: 0,
          componentType: GLTF_COMPONENT_TYPES.FLOAT, // IBMs are Float32
          count: ibmData.length / 16, // Number of 4x4 matrices
          type: 'MAT4', // Accessor type is MAT4
          // min, max are not typically used for matrices
        });

        // Link IBM accessor to the skin
        if (gltfJson.skins && gltfJson.skins[0]) {
          gltfJson.skins[0].inverseBindMatrices = ibmAccessorIndex;
        }
      }
    }
    
    // Add animation data if present
    if (animations && animations.length > 0 && skeleton) {
      const animationData = GltfAnimationIO.exportAnimations(animations, skeleton);
      
      // Merge animation data
      const accessorOffset = gltfJson.accessors?.length || 0;
      const bufferViewOffset = gltfJson.bufferViews?.length || 0;
      const bufferOffset = gltfJson.buffers?.length || 0;
      
      // Add new accessors with updated indices
      gltfJson.accessors = [...(gltfJson.accessors || []), ...animationData.accessors.map(acc => ({
        ...acc,
        bufferView: acc.bufferView + bufferViewOffset
      }))];
      
      // Add new buffer views with updated indices
      gltfJson.bufferViews = [...(gltfJson.bufferViews || []), ...animationData.bufferViews.map(bv => ({
        ...bv,
        buffer: bv.buffer + bufferOffset
      }))];
      
      // Add new buffers
      gltfJson.buffers = [...(gltfJson.buffers || []), ...animationData.bufferData.map(buffer => ({
        byteLength: buffer.byteLength
      }))];
      
      // Add animations with updated accessor indices
      gltfJson.animations = animationData.animations.map(anim => ({
        ...anim,
        samplers: anim.samplers.map(sampler => ({
          ...sampler,
          input: sampler.input + accessorOffset,
          output: sampler.output + accessorOffset
        }))
      }));
      
      // Add animation buffer data
      bufferData = [...bufferData, ...animationData.bufferData];
    }
    
    // Add skin weights data if present
    if (skinWeights && skeleton) {
      const skinData = GltfSkeletonIO.exportSkinWeights(skinWeights, mesh, skeleton);
      
      // Add JOINTS_0 and WEIGHTS_0 attributes to mesh primitives
      if (gltfJson.meshes && gltfJson.meshes[0] && gltfJson.meshes[0].primitives) {
        // This would require creating additional accessors for the skin weights
        // For now, we'll note this as a TODO for full skinning support
                const numVertices = mesh.vertices.size;

        // JOINTS_0 accessor
        const jointsComponentType = skinData.joints instanceof Uint8Array ? GLTF_COMPONENT_TYPES.UNSIGNED_BYTE : GLTF_COMPONENT_TYPES.UNSIGNED_SHORT;
        const jointsBufferIndex = gltfJson.buffers.length;
        gltfJson.buffers.push({ byteLength: skinData.joints.byteLength });
        bufferData.push(skinData.joints.buffer);

        const jointsBufferViewIndex = gltfJson.bufferViews.length;
        gltfJson.bufferViews.push({
          buffer: jointsBufferIndex,
          byteOffset: 0,
          byteLength: skinData.joints.byteLength,
          // target: GLTF_BUFFERVIEW_TARGETS.ARRAY_BUFFER // Optional target
        });

        const jointsAccessorIndex = gltfJson.accessors.length;
        gltfJson.accessors.push({
          bufferView: jointsBufferViewIndex,
          byteOffset: 0,
          componentType: jointsComponentType,
          count: numVertices,
          type: 'VEC4',
          // min, max could be added if known
        });

        // WEIGHTS_0 accessor
        const weightsBufferIndex = gltfJson.buffers.length;
        gltfJson.buffers.push({ byteLength: skinData.weights.byteLength });
        bufferData.push(skinData.weights.buffer);

        const weightsBufferViewIndex = gltfJson.bufferViews.length;
        gltfJson.bufferViews.push({
          buffer: weightsBufferIndex,
          byteOffset: 0,
          byteLength: skinData.weights.byteLength,
          // target: GLTF_BUFFERVIEW_TARGETS.ARRAY_BUFFER // Optional target
        });

        const weightsAccessorIndex = gltfJson.accessors.length;
        gltfJson.accessors.push({
          bufferView: weightsBufferViewIndex,
          byteOffset: 0,
          componentType: GLTF_COMPONENT_TYPES.FLOAT,
          count: numVertices,
          type: 'VEC4',
          // min, max could be added if known
        });

        // Add attributes to all primitives of the skinned mesh
        // (Assuming gltfJson.meshes[0] is the mesh corresponding to the input 'mesh' argument for exportComplete)
        if (gltfJson.meshes && gltfJson.meshes[0] && gltfJson.meshes[0].primitives) {
          if (gltfJson.meshes[0].primitives.length > 0) {
            gltfJson.meshes[0].primitives.forEach((primitive: any) => {
              primitive.attributes.JOINTS_0 = jointsAccessorIndex;
              primitive.attributes.WEIGHTS_0 = weightsAccessorIndex;
            });
          } else {
            console.warn('Skinned mesh has no primitives to attach skinning attributes to.');
          }
        } else {
          console.warn('Could not find the target mesh or its primitives to attach skinning attributes to.');
        }
      }
    }
    
    return { gltfJson, bufferData };
  }
}

// Default export for convenience
export default GltfIO; 