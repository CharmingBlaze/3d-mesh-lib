/**
 * 🎬 GLTF Animation I/O - Animation data import/export functionality
 * 
 * Handles keyframes, animation tracks, and timeline data for GLTF format.
 * Supports bone animations, morph targets, and property animations.
 */

import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';

import { AnimationClip, AnimationTrack, Keyframe } from '../../core/Animation';
import { Skeleton } from '../../core/Skeleton';
import { Vector3D } from '../../utils/Vector3D';
import {
  ProcessedGltf,
  GltfAnimationJson,
  GltfAnimationChannelJson,
  GltfAnimationSamplerJson,
  GLTF_COMPONENT_TYPES
} from './types';

/**
 * GLTF animation functionality
 */
export class GltfAnimationIO {
  /**
   * Import animations from GLTF file
   * @param gltfDataUrlOrArrayBuffer GLTF file data
   * @param skeleton Associated skeleton (optional)
   * @param options Import options
   * @returns Array of animation clips
   */
  static async importAnimations(
    gltfDataUrlOrArrayBuffer: string | ArrayBuffer,
    skeleton?: Skeleton,
    options?: any
  ): Promise<AnimationClip[]> {
    console.log('Importing animations from glTF...');
    
    try {
      const gltf = await load(gltfDataUrlOrArrayBuffer, GLTFLoader, options) as unknown as ProcessedGltf;
      
      if (!gltf || !gltf.json) {
        return [];
      }

      return this.extractAnimations(gltf, skeleton);
      
    } catch (error) {
      console.error('Error importing animations from glTF:', error);
      return [];
    }
  }

  /**
   * Extract animations from processed GLTF data
   * @param gltf Processed GLTF data
   * @param skeleton Associated skeleton (optional)
   * @returns Array of animation clips
   */
  static extractAnimations(gltf: ProcessedGltf, skeleton?: Skeleton): AnimationClip[] {
    if (!gltf.json.animations || gltf.json.animations.length === 0) {
      return [];
    }

    const animationClips: AnimationClip[] = [];
    const getAccessorData = this.createAccessorDataReader(gltf);

    gltf.json.animations.forEach((gltfAnimation, index) => {
      const animClip = this.createAnimationClipFromGltf(
        gltfAnimation,
        gltf,
        skeleton,
        getAccessorData,
        index
      );
      
      if (animClip) {
        animationClips.push(animClip);
      }
    });

    return animationClips;
  }

  /**
   * Create an animation clip from GLTF animation data
   */
  private static createAnimationClipFromGltf(
    gltfAnimation: GltfAnimationJson,
    gltf: ProcessedGltf,
    skeleton: Skeleton | undefined,
    getAccessorData: (index: number) => any,
    fallbackIndex: number
  ): AnimationClip | undefined {
    const clipName = gltfAnimation.name || `Animation_${fallbackIndex}`;
    const animClip = new AnimationClip(clipName);

    let maxDuration = 0;

    // Process each animation channel
    gltfAnimation.channels.forEach(channel => {
      const sampler = gltfAnimation.samplers[channel.sampler];
      if (!sampler) return;

      const track = this.createAnimationTrackFromChannel(
        channel,
        sampler,
        gltf,
        skeleton,
        getAccessorData
      );

      if (track) {
        animClip.addTrack(track);
        
        // Update duration based on last keyframe
        if (track.keyframes.length > 0) {
          const lastKeyframe = track.keyframes[track.keyframes.length - 1];
          maxDuration = Math.max(maxDuration, lastKeyframe.time);
        }
      }
    });

    animClip.duration = maxDuration;
    return animClip.getAllTracks().length > 0 ? animClip : undefined;
  }

  /**
   * Create an animation track from GLTF channel and sampler
   */
  private static createAnimationTrackFromChannel(
    channel: GltfAnimationChannelJson,
    sampler: GltfAnimationSamplerJson,
    gltf: ProcessedGltf,
    skeleton: Skeleton | undefined,
    getAccessorData: (index: number) => any
  ): AnimationTrack | undefined {
    const inputData = getAccessorData(sampler.input) as Float32Array; // Time values
    const outputData = getAccessorData(sampler.output); // Property values
    
    if (!inputData || !outputData) {
      return undefined;
    }

    // Determine target name
    let targetName = `Node_${channel.target.node || 0}`;
    if (skeleton && typeof channel.target.node === 'number') {
      const allBones = skeleton.getAllBones();
      if (allBones[channel.target.node]) {
        targetName = allBones[channel.target.node].name;
      }
    }

    const trackPath = `${targetName}.${channel.target.path}`;
    const track = new AnimationTrack(trackPath);

    // Create keyframes
    this.createKeyframesFromSamplerData(
      track,
      inputData,
      outputData,
      channel.target.path,
      sampler.interpolation || 'LINEAR'
    );

    return track.keyframes.length > 0 ? track : undefined;
  }

  /**
   * Create keyframes from sampler data
   */
  private static createKeyframesFromSamplerData(
    track: AnimationTrack,
    inputData: Float32Array,
    outputData: Float32Array | Uint16Array | Uint8Array,
    propertyPath: string,
    interpolation: string
  ) {
    const componentCount = this.getComponentCount(propertyPath);
    
    for (let i = 0; i < inputData.length; i++) {
      const time = inputData[i];
      let value: any;

      switch (propertyPath) {
        case 'translation':
        case 'scale':
          value = new Vector3D(
            outputData[i * 3],
            outputData[i * 3 + 1],
            outputData[i * 3 + 2]
          );
          break;
          
        case 'rotation':
          // Quaternion [x, y, z, w] -> convert to Euler angles
          const quat = [
            outputData[i * 4],
            outputData[i * 4 + 1],
            outputData[i * 4 + 2],
            outputData[i * 4 + 3]
          ];
          value = this.quaternionToEuler(quat);
          break;
          
        case 'weights':
          // Morph target weights (array of scalars)
          value = [];
          const weightCount = componentCount;
          for (let w = 0; w < weightCount; w++) {
            value.push(outputData[i * weightCount + w]);
          }
          break;
          
        default:
          // Single scalar value
          value = outputData[i];
          break;
      }

      const keyframe = {
        time: time,
        value: value,
        easing: interpolation.toLowerCase() as any
      };
      track.addKeyframe(keyframe);
    }
  }

  /**
   * Get component count for a property path
   */
  private static getComponentCount(propertyPath: string): number {
    switch (propertyPath) {
      case 'translation':
      case 'scale':
        return 3;
      case 'rotation':
        return 4;
      case 'weights':
        return 1; // Variable, but we'll handle this differently
      default:
        return 1;
    }
  }

  /**
   * Convert quaternion to Euler angles (simplified)
   */
  private static quaternionToEuler(quat: number[]): Vector3D {
    const [x, y, z, w] = quat;
    
    // Convert quaternion to Euler angles
    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (w * y - z * x);
    let pitch;
    if (Math.abs(sinp) >= 1) {
      pitch = Math.sign(sinp) * Math.PI / 2;
    } else {
      pitch = Math.asin(sinp);
    }

    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return new Vector3D(roll, pitch, yaw);
  }

  /**
   * Convert Euler angles to quaternion
   */
  private static eulerToQuaternion(euler: Vector3D): number[] {
    const { x: roll, y: pitch, z: yaw } = euler;
    
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);

    const w = cr * cp * cy + sr * sp * sy;
    const x = sr * cp * cy - cr * sp * sy;
    const y = cr * sp * cy + sr * cp * sy;
    const z = cr * cp * sy - sr * sp * cy;

    return [x, y, z, w];
  }

  /**
   * Creates an accessor data reader function for the given GLTF
   */
  private static createAccessorDataReader(gltf: ProcessedGltf) {
    return (accessorIndex: number): Float32Array | Uint8Array | Uint16Array | undefined => {
      const accessor = gltf.json.accessors?.[accessorIndex];
      if (!accessor) return undefined;
      const bufferView = gltf.json.bufferViews?.[accessor.bufferView!];
      if (!bufferView) return undefined;
      const bufferData = gltf.buffers?.[bufferView.buffer];
      if (!bufferData || !bufferData.arrayBuffer) return undefined;

      const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
      const length = accessor.count * (accessor.type === 'SCALAR' ? 1 : accessor.type === 'VEC2' ? 2 : accessor.type === 'VEC3' ? 3 : 4);
      
      switch (accessor.componentType) {
        case GLTF_COMPONENT_TYPES.UNSIGNED_BYTE:
          return new Uint8Array(bufferData.arrayBuffer, byteOffset, length);
        case GLTF_COMPONENT_TYPES.UNSIGNED_SHORT:
          return new Uint16Array(bufferData.arrayBuffer, byteOffset, length);
        case GLTF_COMPONENT_TYPES.FLOAT:
          return new Float32Array(bufferData.arrayBuffer, byteOffset, length);
        default:
          console.warn(`Unsupported accessor componentType for animation: ${accessor.componentType}`);
          return undefined;
      }
    };
  }

  /**
   * Export animation clips to GLTF format
   * @param animationClips Animation clips to export
   * @param skeleton Associated skeleton (optional)
   * @returns GLTF animation data structures
   */
  static exportAnimations(
    animationClips: AnimationClip[],
    skeleton?: Skeleton
  ): {
    animations: GltfAnimationJson[];
    accessors: any[];
    bufferViews: any[];
    bufferData: ArrayBuffer[];
  } {
    console.log('Exporting animations to GLTF...');
    
    const animations: GltfAnimationJson[] = [];
    const accessors: any[] = [];
    const bufferViews: any[] = [];
    const bufferData: ArrayBuffer[] = [];

    // Create bone name to index mapping if skeleton is provided
    const boneNameToIndexMap = new Map<string, number>();
    if (skeleton) {
      const allBones = skeleton.getAllBones();
      allBones.forEach((bone, index) => {
        boneNameToIndexMap.set(bone.name, index);
      });
    }

    animationClips.forEach((clip, clipIndex) => {
      const gltfAnimation = this.exportAnimationClip(
        clip,
        boneNameToIndexMap,
        accessors,
        bufferViews,
        bufferData,
        clipIndex
      );
      
      if (gltfAnimation) {
        animations.push(gltfAnimation);
      }
    });

    return { animations, accessors, bufferViews, bufferData };
  }

  /**
   * Export a single animation clip
   */
  private static exportAnimationClip(
    clip: AnimationClip,
    boneNameToIndexMap: Map<string, number>,
    accessors: any[],
    bufferViews: any[],
    bufferData: ArrayBuffer[],
    clipIndex: number
  ): GltfAnimationJson | undefined {
    const channels: GltfAnimationChannelJson[] = [];
    const samplers: GltfAnimationSamplerJson[] = [];

    clip.getAllTracks().forEach(track => {
      if (track.keyframes.length === 0) return;

      // Determine target node index
      const targetName = track.propertyPath.split('.')[0]; // Extract bone name
      const nodeIndex = boneNameToIndexMap.get(targetName);
      
      if (nodeIndex === undefined) {
        console.warn(`Cannot find bone index for track: ${track.propertyPath}`);
        return;
      }

      const propertyName = track.propertyPath.split('.')[1]; // Extract property name
      const samplerData = this.createSamplerData(track, propertyName);
      if (!samplerData) return;

      // Create input accessor (times)
      const inputAccessorIndex = this.createFloatAccessor(
        samplerData.inputArray,
        'SCALAR',
        accessors,
        bufferViews,
        bufferData
      );

      // Create output accessor (values)
      const outputAccessorIndex = this.createFloatAccessor(
        samplerData.outputArray,
        samplerData.outputType,
        accessors,
        bufferViews,
        bufferData
      );

      // Create sampler
      const samplerIndex = samplers.length;
      samplers.push({
        input: inputAccessorIndex,
        output: outputAccessorIndex,
        interpolation: samplerData.interpolation as any
      });

      // Create channel
      channels.push({
        sampler: samplerIndex,
        target: {
          node: nodeIndex,
          path: propertyName as any
        }
      });
    });

    if (channels.length === 0) {
      return undefined;
    }

    return {
      name: clip.name,
      channels,
      samplers
    };
  }

  /**
   * Create sampler data from animation track
   */
  private static createSamplerData(track: AnimationTrack, propertyName: string): {
    inputArray: Float32Array;
    outputArray: Float32Array;
    outputType: string;
    interpolation: string;
  } | undefined {
    if (track.keyframes.length === 0) {
      return undefined;
    }

    const inputArray = new Float32Array(track.keyframes.length);
    let outputComponentCount: number;
    let outputType: string;
    let interpolation = 'LINEAR';

    // Determine output format based on property
    switch (propertyName) {
      case 'translation':
      case 'scale':
        outputComponentCount = 3;
        outputType = 'VEC3';
        break;
      case 'rotation':
        outputComponentCount = 4;
        outputType = 'VEC4';
        break;
      case 'weights':
        // Morph target weights (variable length)
        const firstKeyframe = track.keyframes[0];
        if (Array.isArray(firstKeyframe.value)) {
          outputComponentCount = firstKeyframe.value.length;
        } else {
          outputComponentCount = 1;
        }
        outputType = 'SCALAR';
        break;
      default:
        outputComponentCount = 1;
        outputType = 'SCALAR';
        break;
    }

    const outputArray = new Float32Array(track.keyframes.length * outputComponentCount);

    // Fill arrays
    track.keyframes.forEach((keyframe, index) => {
      inputArray[index] = keyframe.time;
      
      if (keyframe.easing) {
        interpolation = keyframe.easing.toUpperCase();
      }

      const outputOffset = index * outputComponentCount;

      switch (propertyName) {
        case 'translation':
        case 'scale':
          if (keyframe.value instanceof Vector3D) {
            outputArray[outputOffset] = keyframe.value.x;
            outputArray[outputOffset + 1] = keyframe.value.y;
            outputArray[outputOffset + 2] = keyframe.value.z;
          }
          break;
          
        case 'rotation':
          if (keyframe.value instanceof Vector3D) {
            // Convert Euler angles to quaternion
            const quat = this.eulerToQuaternion(keyframe.value);
            outputArray[outputOffset] = quat[0];
            outputArray[outputOffset + 1] = quat[1];
            outputArray[outputOffset + 2] = quat[2];
            outputArray[outputOffset + 3] = quat[3];
          }
          break;
          
        case 'weights':
          if (Array.isArray(keyframe.value)) {
            keyframe.value.forEach((weight, i) => {
              if (i < outputComponentCount) {
                outputArray[outputOffset + i] = weight;
              }
            });
          } else if (typeof keyframe.value === 'number') {
            outputArray[outputOffset] = keyframe.value;
          }
          break;
          
        default:
          if (typeof keyframe.value === 'number') {
            outputArray[outputOffset] = keyframe.value;
          }
          break;
      }
    });

    return {
      inputArray,
      outputArray,
      outputType,
      interpolation
    };
  }

  /**
   * Create a Float32Array accessor in GLTF format
   */
  private static createFloatAccessor(
    data: Float32Array,
    type: string,
    accessors: any[],
    bufferViews: any[],
    bufferData: ArrayBuffer[]
  ): number {
    const bufferIndex = bufferData.length;
    const bufferViewIndex = bufferViews.length;
    const accessorIndex = accessors.length;

    // Add buffer data
    bufferData.push(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

    // Add buffer view
    bufferViews.push({
      buffer: bufferIndex,
      byteOffset: 0,
      byteLength: data.byteLength,
      target: 34962 // ARRAY_BUFFER
    });

    // Calculate min/max for position data
    let min: number[] | undefined;
    let max: number[] | undefined;
    
    if (type === 'VEC3' && data.length >= 3) {
      min = [Infinity, Infinity, Infinity];
      max = [-Infinity, -Infinity, -Infinity];
      
      for (let i = 0; i < data.length; i += 3) {
        min[0] = Math.min(min[0], data[i]);
        min[1] = Math.min(min[1], data[i + 1]);
        min[2] = Math.min(min[2], data[i + 2]);
        max[0] = Math.max(max[0], data[i]);
        max[1] = Math.max(max[1], data[i + 1]);
        max[2] = Math.max(max[2], data[i + 2]);
      }
    }

    // Add accessor
    const accessor: any = {
      bufferView: bufferViewIndex,
      componentType: GLTF_COMPONENT_TYPES.FLOAT,
      count: data.length / (type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : type === 'VEC3' ? 3 : 4),
      type: type
    };

    if (min && max) {
      accessor.min = min;
      accessor.max = max;
    }

    accessors.push(accessor);
    return accessorIndex;
  }
} 