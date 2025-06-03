/**
 * 🦴 GLTF Skeleton I/O - Skeletal data import/export functionality
 * 
 * Handles skeletons, bones, skinning data, and vertex weights for GLTF format.
 * Works with the core skeletal animation system.
 */

import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';

import { Mesh } from '../../core/Mesh';
import { Skeleton } from '../../core/Skeleton';
import { Bone, BoneTransform } from '../../core/Bone';
import { SkinWeights } from '../../core/Skinning';
import { Vector3D } from '../../utils/Vector3D';
import { Matrix4, Matrix4Data } from '../../utils/Matrix4';
import {
  ProcessedGltf,
  GltfSkinJson,
  GltfNodeJson,
  GltfAccessorJson,
  GLTF_COMPONENT_TYPES
} from './types';

/**
 * GLTF skeleton and skinning functionality
 */
export class GltfSkeletonIO {
  /**
   * Import only skeleton data from GLTF file
   * @param gltfDataUrlOrArrayBuffer GLTF file data
   * @param options Import options
   * @returns Skeleton or undefined if none found
   */
  static async importSkeleton(gltfDataUrlOrArrayBuffer: string | ArrayBuffer, options?: any): Promise<Skeleton | undefined> {
    console.log('Importing skeleton from glTF...');
    
    try {
      const gltf = await load(gltfDataUrlOrArrayBuffer, GLTFLoader, options) as unknown as ProcessedGltf;
      
      if (!gltf || !gltf.json) {
        return undefined;
      }

      return this.extractSkeleton(gltf);
      
    } catch (error) {
      console.error('Error importing skeleton from glTF:', error);
      return undefined;
    }
  }

  /**
   * Extract skeleton from processed GLTF data
   * @param gltf Processed GLTF data
   * @returns Skeleton or undefined if none found
   */
  static extractSkeleton(gltf: ProcessedGltf): Skeleton | undefined {
    if (!gltf.json.skins || gltf.json.skins.length === 0) {
      return undefined;
    }

    const skin = gltf.json.skins[0]; // Use first skin
    const skeleton = new Skeleton(skin.name || 'ImportedSkeleton');
    
    // Build bone hierarchy from nodes
    const boneMap = new Map<number, Bone>();
    
    // Create bones for each joint
    skin.joints.forEach((jointIndex, index) => {
      const node = gltf.json.nodes?.[jointIndex];
      if (node) {
        const bone = this.createBoneFromNode(node, index);
        boneMap.set(jointIndex, bone);
      }
    });

    // Build hierarchy
    skin.joints.forEach(jointIndex => {
      const node = gltf.json.nodes?.[jointIndex];
      const bone = boneMap.get(jointIndex);
      
      if (node && bone && node.children) {
        node.children.forEach(childIndex => {
          const childBone = boneMap.get(childIndex);
          if (childBone) {
            bone.addChild(childBone);
          }
        });
      }
    });

    // Add all bones to skeleton
    boneMap.forEach(bone => {
      if (!bone.parent) {
        skeleton.addBone(bone);
      }
    });

    return skeleton;
  }

  /**
   * Create a bone from a GLTF node
   * @param node GLTF node data
   * @param index Index for fallback naming
   * @returns Created bone
   */
  private static createBoneFromNode(node: GltfNodeJson, index: number): Bone {
    const bone = new Bone(node.name || `Bone_${index}`);
    
    // Set transform from node
    if (node.translation) {
      bone.transform.position.set(node.translation[0], node.translation[1], node.translation[2]);
    }
    
    if (node.rotation) {
      // GLTF uses quaternion [x, y, z, w], store as quaternion in userData for now
      bone.userData.set('rotation_quat', node.rotation);
      
      // Convert quaternion to Euler angles for the transform
      // This is a simplified conversion - a proper implementation would use a quaternion class
      bone.transform.rotation = this.quaternionToEuler(node.rotation);
    }
    
    if (node.scale) {
      bone.transform.scale.set(node.scale[0], node.scale[1], node.scale[2]);
    }
    
    // Copy transform to rest and bind poses
    bone.restTransform = {
      position: bone.transform.position.clone(),
      rotation: bone.transform.rotation.clone(),
      scale: bone.transform.scale.clone()
    };
    
    bone.bindTransform = {
      position: bone.transform.position.clone(),
      rotation: bone.transform.rotation.clone(),
      scale: bone.transform.scale.clone()
    };
    
    return bone;
  }

  /**
   * Convert quaternion to Euler angles (simplified)
   * @param quat Quaternion [x, y, z, w]
   * @returns Euler angles as Vector3D
   */
  private static quaternionToEuler(quat: [number, number, number, number]): Vector3D {
    const [x, y, z, w] = quat;
    
    // Convert quaternion to Euler angles (simplified implementation)
    // Roll (x-axis rotation)
    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (y-axis rotation)
    const sinp = 2 * (w * y - z * x);
    let pitch;
    if (Math.abs(sinp) >= 1) {
      pitch = Math.sign(sinp) * Math.PI / 2; // Use 90 degrees if out of range
    } else {
      pitch = Math.asin(sinp);
    }

    // Yaw (z-axis rotation)
    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return new Vector3D(roll, pitch, yaw);
  }

  /**
   * Import skin weights from GLTF
   * @param gltf Processed GLTF data
   * @param mesh Target mesh
   * @param skeleton Associated skeleton
   * @returns SkinWeights or undefined if none found
   */
  static importSkinWeights(gltf: ProcessedGltf, mesh: Mesh, skeleton: Skeleton): SkinWeights | undefined {
    if (!gltf.json.skins || gltf.json.skins.length === 0) {
      return undefined;
    }

    const skinWeights = new SkinWeights(mesh);
    
    // Create accessor data reader
    const getAccessorData = this.createAccessorDataReader(gltf);
    
    // Process each mesh primitive to extract skinning data
    if (gltf.json.meshes) {
      gltf.json.meshes.forEach(gltfMesh => {
        gltfMesh.primitives.forEach(primitive => {
          if (primitive.attributes.JOINTS_0 !== undefined && primitive.attributes.WEIGHTS_0 !== undefined) {
            this.processPrimitiveSkinning(
              primitive,
              mesh,
              skeleton,
              skinWeights,
              getAccessorData
            );
          }
        });
      });
    }
    
    return skinWeights;
  }

  /**
   * Process skinning data from a primitive
   */
  private static processPrimitiveSkinning(
    primitive: any,
    mesh: Mesh,
    skeleton: Skeleton,
    skinWeights: SkinWeights,
    getAccessorData: (index: number) => any
  ) {
    const joints = getAccessorData(primitive.attributes.JOINTS_0);
    const weights = getAccessorData(primitive.attributes.WEIGHTS_0);
    
    if (!joints || !weights) {
      return;
    }

    const numVertices = joints.length / 4; // 4 joints per vertex
    const allBones = skeleton.getAllBones();
    
    // Map joint indices to bone IDs
    const jointToBoneMap = new Map<number, string>();
    allBones.forEach((bone, index) => {
      jointToBoneMap.set(index, bone.id);
    });

    // Process each vertex
    for (let vertexIndex = 0; vertexIndex < numVertices; vertexIndex++) {
      const baseIndex = vertexIndex * 4;
      
      // Process 4 joint influences per vertex
      for (let jointOffset = 0; jointOffset < 4; jointOffset++) {
        const jointIndex = joints[baseIndex + jointOffset];
        const weight = weights[baseIndex + jointOffset];
        
        if (weight > 0) {
          const boneId = jointToBoneMap.get(jointIndex);
          if (boneId) {
            skinWeights.setWeight(vertexIndex, boneId, weight);
          }
        }
      }
    }
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
          console.warn(`Unsupported accessor componentType for skinning: ${accessor.componentType}`);
          return undefined;
      }
    };
  }

  /**
   * Convert Euler angles to quaternion
   * @param euler Euler angles as Vector3D
   * @returns Quaternion as { x: number; y: number; z: number; w: number }
   */
  private static eulerToQuaternion(euler: Vector3D): { x: number; y: number; z: number; w: number } {
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

    return { x, y, z, w };
  }

  /**
   * Export skeleton to GLTF nodes and skin data
   * @param skeleton Skeleton to export
   * @returns GLTF data structures
   */
  static exportSkeleton(skeleton: Skeleton): {
    nodes: GltfNodeJson[];
    skin: GltfSkinJson;
    nodeIndexMap: Map<string, number>;
    inverseBindMatricesData?: Float32Array; // Optional for now, until fully implemented
  } {
    console.log('Exporting skeleton to GLTF...');
    
    const nodes: GltfNodeJson[] = [];
    const nodeIndexMap = new Map<string, number>();
    const jointIndices: number[] = [];
    
    // Process all bones
    const allBones = skeleton.getAllBones();
    
    // Create nodes for each bone
    allBones.forEach((bone, index) => {
      const nodeIndex = nodes.length;
      nodeIndexMap.set(bone.id, nodeIndex);
      
      const gltfNode: GltfNodeJson = {
        name: bone.name,
        translation: [
          bone.transform.position.x,
          bone.transform.position.y,
          bone.transform.position.z
        ],
        scale: [
          bone.transform.scale.x,
          bone.transform.scale.y,
          bone.transform.scale.z
        ]
      };
      
      // Convert Euler angles back to quaternion for GLTF
      const quat = GltfSkeletonIO.eulerToQuaternion(bone.transform.rotation);
      gltfNode.rotation = [quat.x, quat.y, quat.z, quat.w];
      
      // Add children if any
      if (bone.children.length > 0) {
        gltfNode.children = []; // Will be filled later
      }
      
      nodes.push(gltfNode);
      jointIndices.push(nodeIndex);
    });
    
    // Set up parent-child relationships
    allBones.forEach((bone, index) => {
      const nodeIndex = nodeIndexMap.get(bone.id)!;
      const node = nodes[nodeIndex];
      
      if (bone.children.length > 0 && node.children) {
        bone.children.forEach(childBone => {
          const childNodeIndex = nodeIndexMap.get(childBone.id);
          if (childNodeIndex !== undefined) {
            node.children!.push(childNodeIndex);
          }
        });
      }
    });
    
    // Create skin
    const skin: GltfSkinJson = {
      name: skeleton.name,
      joints: jointIndices
      // Note: inverseBindMatrices would need to be calculated and added here for full skinning support
    };

    // Calculate Inverse Bind Matrices (IBMs)
    const inverseBindMatricesArray: number[] = [];
    const boneMap = new Map<number, Bone>(); // Map node index to Bone
    allBones.forEach(bone => {
      const nodeIndex = nodeIndexMap.get(bone.id);
      if (nodeIndex !== undefined) {
        boneMap.set(nodeIndex, bone);
      }
    });

    for (const jointNodeIndex of skin.joints) {
      const jointBone = boneMap.get(jointNodeIndex);
      if (jointBone) {
        const globalBindMatrix = GltfSkeletonIO.getGlobalBindMatrix(jointBone);
        const ibm = Matrix4.invert(globalBindMatrix); // Using placeholder invert for now
        if (ibm) {
          inverseBindMatricesArray.push(...ibm);
        } else {
          // Should not happen with placeholder, but good practice for real invert
          console.warn(`Could not invert global bind matrix for bone ${jointBone.name}`);
          inverseBindMatricesArray.push(...Matrix4.identity()); // Push identity as fallback
        }
      } else {
        console.warn(`Could not find bone for joint index ${jointNodeIndex}`);
        inverseBindMatricesArray.push(...Matrix4.identity()); // Push identity as fallback
      }
    }
    const inverseBindMatricesData = new Float32Array(inverseBindMatricesArray);

    return { nodes, skin, nodeIndexMap, inverseBindMatricesData };
  }

  /**
   * Helper to calculate the global bind matrix for a bone.
   * Traverses up the parent chain, accumulating bind transforms.
   * @param bone The bone for which to calculate the global bind matrix.
   * @returns The global bind matrix as Matrix4Data.
   */
  private static getGlobalBindMatrix(bone: Bone): Matrix4Data {
    let currentBone: Bone | null = bone;
    let globalMatrix = Matrix4.identity();

    const boneChain: Bone[] = [];
    while (currentBone) {
      boneChain.unshift(currentBone); // Add to the beginning to process from root to leaf
      currentBone = currentBone.parent;
    }

    for (const b of boneChain) {
      const transform = b.bindTransform;
      const q = GltfSkeletonIO.eulerToQuaternion(transform.rotation);
      const localMatrix = Matrix4.compose(transform.position, q, transform.scale);
      globalMatrix = Matrix4.multiply(globalMatrix, localMatrix); // global = parentGlobal * local
    }
    return globalMatrix;
  }

  /**
   * Export skin weights to GLTF format
   * @param skinWeights Skin weights to export
   * @param mesh Associated mesh
   * @param skeleton Associated skeleton
   * @returns GLTF skinning attribute data
   */
  static exportSkinWeights(
    skinWeights: SkinWeights, 
    mesh: Mesh, 
    skeleton: Skeleton
  ): {
    joints: Uint8Array | Uint16Array;
    weights: Float32Array;
  } {
    console.log('Exporting skin weights to GLTF...');
    
    const allBones = skeleton.getAllBones();
    const boneToIndexMap = new Map<string, number>();
    allBones.forEach((bone, index) => {
      boneToIndexMap.set(bone.id, index);
    });
    
    const vertexCount = mesh.vertices.size;
    const joints = new Uint8Array(vertexCount * 4); // 4 joints per vertex
    const weights = new Float32Array(vertexCount * 4); // 4 weights per vertex
    
    // Process each vertex
    let vertexIndex = 0;
    for (const vertex of mesh.vertices.values()) {
      const vertexWeights = skinWeights.getVertexWeights(vertex.id);
      
      // Sort weights by strength and take top 4
      const sortedWeights = vertexWeights
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 4);
      
      // Normalize weights to sum to 1
      const totalWeight = sortedWeights.reduce((sum, w) => sum + w.weight, 0);
      
      for (let i = 0; i < 4; i++) {
        const baseIndex = vertexIndex * 4 + i;
        
        if (i < sortedWeights.length && totalWeight > 0) {
          const weightData = sortedWeights[i];
          const boneIndex = boneToIndexMap.get(weightData.boneId) || 0;
          
          joints[baseIndex] = boneIndex;
          weights[baseIndex] = weightData.weight / totalWeight;
        } else {
          joints[baseIndex] = 0;
          weights[baseIndex] = 0;
        }
      }
      
      vertexIndex++;
    }
    
    return { joints, weights };
  }
} 