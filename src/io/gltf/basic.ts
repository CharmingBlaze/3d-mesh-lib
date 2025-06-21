/**
 * 🔄 GLTF Basic I/O - Core mesh import/export functionality
 * 
 * Handles basic mesh geometry, materials, and textures without animation or skeletal data.
 * This forms the foundation for more advanced GLTF features.
 */

import { load, encode } from '@loaders.gl/core';
import { GLTFLoader, GLTFWriter } from '@loaders.gl/gltf';

import { Mesh } from '../../core/Mesh';
import { Material, MaterialOptions } from '../../core/Material';
import { Vector3D } from '../../utils/Vector3D';
import {
  ProcessedGltf,
  GltfJson,
  GltfMaterialJson,
  GltfPrimitiveJson,
  GltfMeshJson,
  GltfNodeJson,
  GltfSceneJson,
  GltfBufferJson,
  GltfBufferViewJson,
  GltfAccessorJson,
  GLTF_COMPONENT_TYPES,
  GLTF_TARGETS,
  GLTF_PRIMITIVE_MODES,
  GLTF_TEXTURE_FILTERS,
  GLTF_TEXTURE_WRAPS
} from './types';

type GltfComponentType = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;
type GltfAccessorType = "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4";

interface InterleavedPrimitiveData {
  interleavedVertexData: ArrayBuffer;
  indices: Uint16Array | Uint32Array;
  vertexCount: number;
  attributesInfo: {
    position: { offsetBytes: number; componentType: GltfComponentType; type: GltfAccessorType; components: 3; min: number[]; max: number[]; };
    normal?: { offsetBytes: number; componentType: GltfComponentType; type: GltfAccessorType; components: 3 };
    texcoord_0?: { offsetBytes: number; componentType: GltfComponentType; type: GltfAccessorType; components: 2 };
    joints_0?: { offsetBytes: number; componentType: GltfComponentType; type: GltfAccessorType; components: 4 };
    weights_0?: { offsetBytes: number; componentType: GltfComponentType; type: GltfAccessorType; components: 4 };
  };
  byteStride: number;
}

/**
 * Core GLTF import/export functionality for basic mesh operations
 */
export class GltfBasicIO {
  /**
   * Detects GLTF format from file extension or data
   */
  private static detectGltfFormat(filePathOrData: string | ArrayBuffer | Uint8Array): 'gltf' | 'glb' {
    if (typeof filePathOrData === 'string') {
      // File path detection
      const extension = filePathOrData.toLowerCase().split('.').pop();
      return extension === 'gltf' ? 'gltf' : 'glb';
    } else {
      // Binary data detection - GLB files start with 'glTF' magic number
      const dataView = new DataView(filePathOrData instanceof ArrayBuffer ? filePathOrData : filePathOrData.buffer);
      const magic = dataView.getUint32(0, true);
      const gltfMagic = 0x46546C67; // 'glTF' as little-endian uint32
      return magic === gltfMagic ? 'glb' : 'gltf';
    }
  }

  /**
   * Import a mesh from GLTF/GLB data with format detection
   * Supports both .gltf (text/JSON) and .glb (binary) formats
   */
  static async importMesh(
    gltfDataUrlOrArrayBuffer: string | ArrayBuffer | Uint8Array,
    meshIndex: number = 0,
    options: any = {}
  ): Promise<Mesh> {
    const { load } = await import('@loaders.gl/core');
    const { GLTFLoader } = await import('@loaders.gl/gltf');
    
    // Detect format and set appropriate options
    const format = this.detectGltfFormat(gltfDataUrlOrArrayBuffer);
    const loadOptions = {
      ...options,
      gltf: {
        // Force binary mode for GLB files
        loadImages: true,
        loadBuffers: true,
        createImages: false, // We handle images separately
        ...options.gltf
      }
    };
    
    console.log(`Loading GLTF file in ${format.toUpperCase()} format...`);
    
    const gltfData = await load(gltfDataUrlOrArrayBuffer, GLTFLoader, loadOptions);
    const gltf = gltfData as any as ProcessedGltf;

    if (!gltf.json?.meshes || gltf.json.meshes.length === 0) {
      throw new Error('No meshes found in GLTF file');
    }

    if (meshIndex >= gltf.json.meshes.length) {
      throw new Error(`Mesh index ${meshIndex} out of range. File contains ${gltf.json.meshes.length} meshes.`);
    }

    const gltfMesh = gltf.json.meshes[meshIndex];
    const meshName = gltfMesh.name || `ImportedMesh_${meshIndex}`;
    
    return this.processGltfMesh(gltf, gltfMesh, meshName);
  }

  /**
   * Export a mesh to GLTF/GLB format with format detection
   * Supports both .gltf (text/JSON) and .glb (binary) formats
   */
  static async exportMesh(
    mesh: Mesh, 
    format: 'gltf' | 'glb' = 'glb',
    options: any = {}
  ): Promise<ArrayBuffer> {
    const { encode } = await import('@loaders.gl/core');
    const { GLTFWriter } = await import('@loaders.gl/gltf');

    const gltfData = this.createGltfFromMesh(mesh);
    
    const exportOptions = {
      ...options,
      gltf: {
        // Binary output for GLB, JSON for GLTF
        binary: format === 'glb',
        embed: format === 'glb', // Embed buffers in GLB
        embedImages: format === 'glb',
        ...options.gltf
      }
    };

    console.log(`Exporting mesh to ${format.toUpperCase()} format...`);
    
    const encoded = await encode(gltfData, GLTFWriter, exportOptions);
    
    if (encoded instanceof ArrayBuffer) {
      return encoded;
    } else {
      // Convert string to ArrayBuffer for consistent return type
      const encoder = new TextEncoder();
      return encoder.encode(encoded as string).buffer;
    }
  }

  /**
   * Creates an accessor data reader function for the given GLTF
   */
  private static createAccessorDataReader(gltf: ProcessedGltf) {
    return (accessorIndex: number): Float32Array | Uint16Array | Uint32Array | Int8Array | Uint8Array | Int16Array | undefined => {
      const accessor = gltf.json.accessors?.[accessorIndex];
      if (!accessor) return undefined;
      const bufferView = gltf.json.bufferViews?.[accessor.bufferView!];
      if (!bufferView) return undefined;
      const bufferData = gltf.buffers?.[bufferView.buffer];
      if (!bufferData || !bufferData.arrayBuffer) return undefined;

      const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
      const length = accessor.count * (accessor.type === 'SCALAR' ? 1 : accessor.type === 'VEC2' ? 2 : accessor.type === 'VEC3' ? 3 : 4);
      
      switch (accessor.componentType) {
        case GLTF_COMPONENT_TYPES.BYTE:
          return new Int8Array(bufferData.arrayBuffer, byteOffset, length);
        case GLTF_COMPONENT_TYPES.UNSIGNED_BYTE:
          return new Uint8Array(bufferData.arrayBuffer, byteOffset, length);
        case GLTF_COMPONENT_TYPES.SHORT:
          return new Int16Array(bufferData.arrayBuffer, byteOffset, length);
        case GLTF_COMPONENT_TYPES.UNSIGNED_SHORT:
          return new Uint16Array(bufferData.arrayBuffer, byteOffset, length);
        case GLTF_COMPONENT_TYPES.UNSIGNED_INT:
          return new Uint32Array(bufferData.arrayBuffer, byteOffset, length);
        case GLTF_COMPONENT_TYPES.FLOAT:
          return new Float32Array(bufferData.arrayBuffer, byteOffset, length);
        default:
          console.warn(`Unsupported accessor componentType: ${accessor.componentType}`);
          return undefined;
      }
    };
  }

  /**
   * Process scenes and extract mesh data
   */
  private static processScenes(
    gltf: ProcessedGltf, 
    mesh: Mesh, 
    materials: Material[], 
    getAccessorData: (index: number) => any
  ) {
    (gltf.json.scenes || []).forEach((scene: GltfSceneJson) => {
      (scene.nodes || []).forEach((nodeIndex: number) => {
        const node = gltf.json.nodes?.[nodeIndex] as GltfNodeJson | undefined;
        if (node && typeof node.mesh === 'number') {
          const gltfMesh = gltf.json.meshes?.[node.mesh] as GltfMeshJson | undefined;
          if (gltfMesh && gltfMesh.primitives) {
            this.processMeshPrimitives(gltfMesh.primitives, mesh, materials, getAccessorData);
          }
        }
      });
    });
  }

  /**
   * Process mesh primitives and add vertices/faces to mesh
   */
  private static processMeshPrimitives(
    primitives: GltfPrimitiveJson[], 
    mesh: Mesh, 
    materials: Material[], 
    getAccessorData: (index: number) => any
  ) {
    primitives.forEach((primitive: GltfPrimitiveJson) => {
      if (primitive.attributes && typeof primitive.attributes.POSITION === 'number') {
        const positions = getAccessorData(primitive.attributes.POSITION) as Float32Array;
        const normals = primitive.attributes.NORMAL !== undefined ? getAccessorData(primitive.attributes.NORMAL) as Float32Array : undefined;
        const texcoords = primitive.attributes.TEXCOORD_0 !== undefined ? getAccessorData(primitive.attributes.TEXCOORD_0) as Float32Array : undefined;
        const indices = primitive.indices !== undefined ? getAccessorData(primitive.indices) : undefined;

        if (!positions) return;

        const primitiveVertices = this.createVerticesFromPrimitive(
          mesh, positions, normals, texcoords
        );

        this.createFacesFromPrimitive(
          mesh, primitiveVertices, indices, primitive.material, materials
        );
      }
    });
  }

  /**
   * Create vertices from primitive data
   */
  private static createVerticesFromPrimitive(
    mesh: Mesh,
    positions: Float32Array,
    normals?: Float32Array,
    texcoords?: Float32Array
  ) {
    const primitiveVertices = [];
    const numVertices = positions.length / 3;

    for (let i = 0; i < numVertices; i++) {
      const posX = positions[i * 3];
      const posY = positions[i * 3 + 1];
      const posZ = positions[i * 3 + 2];
      
      let normal: Vector3D | undefined;
      if (normals) {
        normal = new Vector3D(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
      }
      
      let uv: { u: number; v: number } | undefined;
      if (texcoords) {
        uv = { u: texcoords[i * 2], v: texcoords[i * 2 + 1] };
      }
      
      // Add vertex to mesh and store reference
      const vertex = mesh.addVertex(posX, posY, posZ, normal, uv);
      primitiveVertices.push(vertex);
    }

    return primitiveVertices;
  }

  /**
   * Create faces from primitive data
   */
  private static createFacesFromPrimitive(
    mesh: Mesh,
    primitiveVertices: any[],
    indices: any,
    materialIndex: number | undefined,
    materials: Material[]
  ) {
    if (indices) {
      // Indexed triangles
      for (let i = 0; i < indices.length; i += 3) {
        const v1Id = primitiveVertices[indices[i]]?.id;
        const v2Id = primitiveVertices[indices[i + 1]]?.id;
        const v3Id = primitiveVertices[indices[i + 2]]?.id;
        if (v1Id !== undefined && v2Id !== undefined && v3Id !== undefined) {
          const materialId = (typeof materialIndex === 'number' && materials[materialIndex]) 
            ? materials[materialIndex].id 
            : undefined;
          mesh.addFace([v1Id, v2Id, v3Id], materialId);
        }
      }
    } else {
      // Non-indexed triangles
      for (let i = 0; i < primitiveVertices.length; i += 3) {
        const v1Id = primitiveVertices[i]?.id;
        const v2Id = primitiveVertices[i + 1]?.id;
        const v3Id = primitiveVertices[i + 2]?.id;
        if (v1Id !== undefined && v2Id !== undefined && v3Id !== undefined) {
          const materialId = (typeof materialIndex === 'number' && materials[materialIndex]) 
            ? materials[materialIndex].id 
            : undefined;
          mesh.addFace([v1Id, v2Id, v3Id], materialId);
        }
      }
    }
  }

  /**
   * Build GLTF JSON structure from mesh
   */
  private static buildGltfFromMesh(mesh: Mesh): { gltfJson: any, bufferData: ArrayBuffer[] } {
    const bufferData: ArrayBuffer[] = [];
    const gltfBuffers: GltfBufferJson[] = [];
    const gltfBufferViews: GltfBufferViewJson[] = [];
    const gltfAccessors: GltfAccessorJson[] = [];
    const gltfPrimitives: any[] = [];

    // Process materials
    const { gltfMaterials, materialIdToGltfIndexMap } = this.processMeshMaterials(mesh);

    // Process geometry
    this.processMeshGeometry(
      mesh, 
      bufferData, 
      gltfBuffers, 
      gltfBufferViews, 
      gltfAccessors, 
      gltfPrimitives,
      materialIdToGltfIndexMap
    );

    const gltfJson: any = {
      asset: {
        version: '2.0',
        generator: '3d-mesh-lib with @loaders.gl/gltf'
      },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: mesh.name || 'ExportedNode' }],
      meshes: [{
        name: mesh.name || 'ExportedMesh',
        primitives: gltfPrimitives
      }],
      buffers: gltfBuffers.map(b => ({ byteLength: b.byteLength, name: b.name, uri: b.uri })),
      bufferViews: gltfBufferViews,
      accessors: gltfAccessors,
      materials: gltfMaterials.length > 0 ? gltfMaterials : undefined,
    };

    return { gltfJson, bufferData };
  }

  /**
   * Process mesh materials for export
   */
  private static processMeshMaterials(mesh: Mesh) {
    const gltfMaterials: any[] = [];
    const materialIdToGltfIndexMap = new Map<number, number>();

    if (mesh.materials && mesh.materials.size > 0) {
      mesh.materials.forEach((material, index) => {
        const pbrMetallicRoughness: any = {
          baseColorFactor: [material.color.x, material.color.y, material.color.z, material.opacity],
          metallicFactor: material.metallic,
          roughnessFactor: material.roughness,
        };

        const gltfMat: any = {
          name: material.name || `Material_${index}`,
          pbrMetallicRoughness: pbrMetallicRoughness,
        };
        
        if (material.emissiveColor.lengthSq() > 0) {
          gltfMat.emissiveFactor = [material.emissiveColor.x, material.emissiveColor.y, material.emissiveColor.z];
        }
        
        gltfMaterials.push(gltfMat);
        materialIdToGltfIndexMap.set(material.id, gltfMaterials.length - 1);
      });
    }

    return { gltfMaterials, materialIdToGltfIndexMap };
  }

  /**
   * Builds interleaved primitive data (vertex attributes and indices) for a set of faces.
   * Ensures all attributes (position, normal, texcoord_0) are present for consistent stride,
   * using default values if an attribute is missing on a vertex.
   */
  private static buildPrimitiveData(materialFaces: any[]): InterleavedPrimitiveData {
    const uniqueVerticesMap = new Map<string, number>();
    // Stores data for each unique vertex: { pos, norm, uv, joints, weights, originalVertex }
    const uniqueVertexDataForBuffer: any[] = [];
    const indicesArray: number[] = [];
    let nextVertexIndex = 0;

    const minPos = [Infinity, Infinity, Infinity];
    const maxPos = [-Infinity, -Infinity, -Infinity];

    const defaultNormalArray = [0, 1, 0];
    const defaultUVArray = [0, 0];
    const defaultJointsArray = [0, 0, 0, 0];
    const defaultWeightsArray = [0, 0, 0, 0];

    // --- 1. Determine attribute presence for the entire primitive --- 
    let primitiveHasNormals = false;
    let primitiveHasTexcoords = false;
    let primitiveHasJoints = false;
    let primitiveHasWeights = false;

    for (const face of materialFaces) {
      const parentMeshVertices = (face as any).mesh?.vertices;
      if (!parentMeshVertices) continue;
      for (const vertexId of face.vertices) {
        const vertex = parentMeshVertices.get(vertexId);
        if (!vertex) continue;
        if (vertex.normal) primitiveHasNormals = true;
        if (vertex.uv) primitiveHasTexcoords = true;
        if (vertex.metadata?.skinJoints) primitiveHasJoints = true;
        if (vertex.metadata?.skinWeights) primitiveHasWeights = true;
      }
    }

    // --- 2. Calculate byteStride and attributesInfo --- 
    let currentByteOffset = 0;
    const attributesInfo: InterleavedPrimitiveData['attributesInfo'] = {
      position: { offsetBytes: currentByteOffset, componentType: GLTF_COMPONENT_TYPES.FLOAT, type: 'VEC3', components: 3, min: minPos, max: maxPos }
    };
    currentByteOffset += 3 * 4; // Position: 3 floats

    if (primitiveHasNormals) {
      attributesInfo.normal = { offsetBytes: currentByteOffset, componentType: GLTF_COMPONENT_TYPES.FLOAT, type: 'VEC3', components: 3 };
      currentByteOffset += 3 * 4; // Normal: 3 floats
    }
    if (primitiveHasTexcoords) {
      attributesInfo.texcoord_0 = { offsetBytes: currentByteOffset, componentType: GLTF_COMPONENT_TYPES.FLOAT, type: 'VEC2', components: 2 };
      currentByteOffset += 2 * 4; // Texcoord: 2 floats
    }
    if (primitiveHasJoints) {
      attributesInfo.joints_0 = { offsetBytes: currentByteOffset, componentType: GLTF_COMPONENT_TYPES.UNSIGNED_BYTE, type: 'VEC4', components: 4 };
      currentByteOffset += 4 * 1; // Joints: 4 unsigned bytes
    }
    if (primitiveHasWeights) {
      attributesInfo.weights_0 = { offsetBytes: currentByteOffset, componentType: GLTF_COMPONENT_TYPES.FLOAT, type: 'VEC4', components: 4 };
      currentByteOffset += 4 * 4; // Weights: 4 floats
    }
    const byteStride = currentByteOffset;

    // --- 3. Process faces to populate unique vertices and indices --- 
    for (const face of materialFaces) {
      const faceIndicesForCurrentPolygon: number[] = [];
      const parentMeshVertices = (face as any).mesh?.vertices;
      if (!parentMeshVertices) {
        console.warn('Face is missing mesh context, skipping face in buildPrimitiveData');
        continue;
      }

      for (const vertexId of face.vertices) {
        const vertex = parentMeshVertices.get(vertexId);
        if (!vertex) continue;

        const vPos = vertex.position;
        const vNorm = vertex.normal || (primitiveHasNormals ? new Vector3D(...defaultNormalArray) : null);
        const vUV = vertex.uv || (primitiveHasTexcoords ? { u: defaultUVArray[0], v: defaultUVArray[1] } : null);
        const vJoints = (vertex.metadata?.skinJoints as number[] | undefined) || (primitiveHasJoints ? defaultJointsArray : null);
        const vWeights = (vertex.metadata?.skinWeights as number[] | undefined) || (primitiveHasWeights ? defaultWeightsArray : null);

        let vertexKey = `${vPos.x.toFixed(6)},${vPos.y.toFixed(6)},${vPos.z.toFixed(6)}`;
        if (primitiveHasNormals && vNorm) vertexKey += `|N:${vNorm.x.toFixed(4)},${vNorm.y.toFixed(4)},${vNorm.z.toFixed(4)}`;
        if (primitiveHasTexcoords && vUV) vertexKey += `|T:${vUV.u.toFixed(4)},${vUV.v.toFixed(4)}`;
        if (primitiveHasJoints && vJoints) vertexKey += `|J:${vJoints.join(',')}`;
        if (primitiveHasWeights && vWeights) vertexKey += `|W:${vWeights.map(w => w.toFixed(4)).join(',')}`;

        let index = uniqueVerticesMap.get(vertexKey);
        if (index === undefined) {
          index = nextVertexIndex++;
          uniqueVerticesMap.set(vertexKey, index);
          uniqueVertexDataForBuffer.push({ 
            pos: vPos, norm: vNorm, uv: vUV, 
            joints: vJoints, weights: vWeights, 
            originalVertex: vertex 
          });

          if (vPos.x < minPos[0]) minPos[0] = vPos.x;
          if (vPos.y < minPos[1]) minPos[1] = vPos.y;
          if (vPos.z < minPos[2]) minPos[2] = vPos.z;
          if (vPos.x > maxPos[0]) maxPos[0] = vPos.x;
          if (vPos.y > maxPos[1]) maxPos[1] = vPos.y;
          if (vPos.z > maxPos[2]) maxPos[2] = vPos.z;
        }
        faceIndicesForCurrentPolygon.push(index);
      }

      if (faceIndicesForCurrentPolygon.length === 3) {
        indicesArray.push(...faceIndicesForCurrentPolygon);
      } else if (faceIndicesForCurrentPolygon.length === 4) { // Triangulate quads
        indicesArray.push(faceIndicesForCurrentPolygon[0], faceIndicesForCurrentPolygon[1], faceIndicesForCurrentPolygon[2]);
        indicesArray.push(faceIndicesForCurrentPolygon[0], faceIndicesForCurrentPolygon[2], faceIndicesForCurrentPolygon[3]);
      }
    }
    // Update min/max on the attributesInfo directly, as it might have been initialized with Infinity
    attributesInfo.position.min = minPos;
    attributesInfo.position.max = maxPos;

    // --- 4. Create and populate ArrayBuffer --- 
    const interleavedArrayBuffer = new ArrayBuffer(uniqueVertexDataForBuffer.length * byteStride);
    const dataView = new DataView(interleavedArrayBuffer);
    let bufferWriteOffset = 0;

    for (const uniqueVertex of uniqueVertexDataForBuffer) {
      dataView.setFloat32(bufferWriteOffset + attributesInfo.position.offsetBytes, uniqueVertex.pos.x, true);
      dataView.setFloat32(bufferWriteOffset + attributesInfo.position.offsetBytes + 4, uniqueVertex.pos.y, true);
      dataView.setFloat32(bufferWriteOffset + attributesInfo.position.offsetBytes + 8, uniqueVertex.pos.z, true);

      if (primitiveHasNormals && attributesInfo.normal && uniqueVertex.norm) {
        dataView.setFloat32(bufferWriteOffset + attributesInfo.normal.offsetBytes, uniqueVertex.norm.x, true);
        dataView.setFloat32(bufferWriteOffset + attributesInfo.normal.offsetBytes + 4, uniqueVertex.norm.y, true);
        dataView.setFloat32(bufferWriteOffset + attributesInfo.normal.offsetBytes + 8, uniqueVertex.norm.z, true);
      }
      if (primitiveHasTexcoords && attributesInfo.texcoord_0 && uniqueVertex.uv) {
        dataView.setFloat32(bufferWriteOffset + attributesInfo.texcoord_0.offsetBytes, uniqueVertex.uv.u, true);
        dataView.setFloat32(bufferWriteOffset + attributesInfo.texcoord_0.offsetBytes + 4, uniqueVertex.uv.v, true);
      }
      if (primitiveHasJoints && attributesInfo.joints_0 && uniqueVertex.joints) {
        for (let i = 0; i < 4; i++) {
          dataView.setUint8(bufferWriteOffset + attributesInfo.joints_0.offsetBytes + i, uniqueVertex.joints[i]);
        }
      }
      if (primitiveHasWeights && attributesInfo.weights_0 && uniqueVertex.weights) {
        for (let i = 0; i < 4; i++) {
          dataView.setFloat32(bufferWriteOffset + attributesInfo.weights_0.offsetBytes + (i * 4), uniqueVertex.weights[i], true);
        }
      }
      bufferWriteOffset += byteStride;
    }

    // --- 5. Finalize and return --- 
    const indices = uniqueVertexDataForBuffer.length > 65535 ? new Uint32Array(indicesArray) : new Uint16Array(indicesArray);

    return {
      interleavedVertexData: interleavedArrayBuffer,
      indices,
      vertexCount: uniqueVertexDataForBuffer.length,
      attributesInfo,
      byteStride,
    };
  }

  /**
   * Process mesh geometry for export, creating primitives for each material group.
   * Uses interleaved vertex buffers and a single main GLTF buffer.
   */
  private static processMeshGeometry(
    mesh: Mesh,
    bufferDataCollection: ArrayBuffer[], // Collection to push the final main buffer into
    gltfBuffers: GltfBufferJson[],
    gltfBufferViews: GltfBufferViewJson[],
    gltfAccessors: GltfAccessorJson[],
    gltfPrimitives: any[],
    materialIdToGltfIndexMap: Map<number | null, number>
  ) {
    const facesByMaterial = new Map<number | null, any[]>();
    mesh.faces.forEach(face => {
      // Attach mesh reference to face for buildPrimitiveData to access vertices
      // This is a workaround; ideally, Face objects would inherently know their parent Mesh.
      (face as any).mesh = mesh;
      const matId = face.materialIndex === undefined ? null : face.materialIndex;
      if (!facesByMaterial.has(matId)) {
        facesByMaterial.set(matId, []);
      }
      facesByMaterial.get(matId)!.push(face);
    });

    const mainBufferDataSegments: ArrayBuffer[] = [];
    let mainBufferTotalByteLength = 0;

    for (const [materialId, materialFaces] of facesByMaterial) {
      if (materialFaces.length === 0) continue;

      const primitiveData = this.buildPrimitiveData(materialFaces);

      if (primitiveData.indices.length === 0) continue;

      const vertexDataByteOffset = mainBufferTotalByteLength;
      mainBufferDataSegments.push(primitiveData.interleavedVertexData); // Already an ArrayBuffer
      mainBufferTotalByteLength += primitiveData.interleavedVertexData.byteLength;

      const indexDataByteOffset = mainBufferTotalByteLength;
      mainBufferDataSegments.push(primitiveData.indices.buffer);
      mainBufferTotalByteLength += primitiveData.indices.byteLength;

      const bufferInfo = this.createPrimitiveBuffers(
        primitiveData,
        0, // All bufferViews will point to buffer 0 (the main buffer)
        vertexDataByteOffset,
        indexDataByteOffset,
        gltfBufferViews,
        gltfAccessors
      );

      const gltfPrim = this.createGltfPrimitive(
        bufferInfo,
        materialId, // materialId from facesByMaterial map key
        materialIdToGltfIndexMap
      );

      gltfPrimitives.push(gltfPrim);
    }

    if (mainBufferDataSegments.length > 0) {
      const finalBuffer = new Uint8Array(mainBufferTotalByteLength);
      let currentWriteOffset = 0;
      for (const segment of mainBufferDataSegments) {
        finalBuffer.set(new Uint8Array(segment), currentWriteOffset);
        currentWriteOffset += segment.byteLength;
      }
      bufferDataCollection.push(finalBuffer.buffer);
      gltfBuffers.push({ byteLength: finalBuffer.byteLength });
    }
  }
  /**
   * Creates GLTF buffer views and accessors for a primitive using interleaved vertex data.
   * Assumes vertex data and index data are segments within a larger buffer (buffer 0).
   */
  private static createPrimitiveBuffers(
    primitiveData: InterleavedPrimitiveData,
    bufferIndex: number, // Index of the GLTF buffer (e.g., 0 for the main buffer)
    vertexDataByteOffset: number, // Byte offset of this primitive's vertex data in the main buffer
    indexDataByteOffset: number,   // Byte offset of this primitive's index data in the main buffer
    gltfBufferViews: GltfBufferViewJson[],
    gltfAccessors: GltfAccessorJson[]
  ) {
    const { interleavedVertexData, indices, vertexCount, attributesInfo, byteStride } = primitiveData;

    // Create BufferView for the interleaved vertex data
    const vertexBufferViewIndex = gltfBufferViews.length;
    gltfBufferViews.push({
      buffer: bufferIndex,
      byteOffset: vertexDataByteOffset,
      byteLength: interleavedVertexData.byteLength, // This is now an ArrayBuffer
      byteStride: byteStride, // Stride for the interleaved attributes
      target: GLTF_TARGETS.ARRAY_BUFFER,
    });

    const attributes: { [key: string]: number } = {};

    // Position Accessor
    attributes.POSITION = gltfAccessors.length;
    gltfAccessors.push({
      bufferView: vertexBufferViewIndex,
      byteOffset: attributesInfo.position.offsetBytes, // Offset within the interleaved data
      componentType: attributesInfo.position.componentType,
      count: vertexCount,
      type: attributesInfo.position.type,
      min: attributesInfo.position.min,
      max: attributesInfo.position.max,
    });

    // Normal Accessor (if present)
    if (attributesInfo.normal) {
      attributes.NORMAL = gltfAccessors.length;
      gltfAccessors.push({
        bufferView: vertexBufferViewIndex,
        byteOffset: attributesInfo.normal.offsetBytes,
        componentType: attributesInfo.normal.componentType,
        count: vertexCount,
        type: attributesInfo.normal.type,
      });
    }

    // TexCoord_0 Accessor (if present)
    if (attributesInfo.texcoord_0) {
      attributes.TEXCOORD_0 = gltfAccessors.length;
      gltfAccessors.push({
        bufferView: vertexBufferViewIndex,
        byteOffset: attributesInfo.texcoord_0.offsetBytes,
        componentType: attributesInfo.texcoord_0.componentType,
        count: vertexCount,
        type: attributesInfo.texcoord_0.type,
      });
    }

    // Create BufferView for the index data
    const indexBufferViewIndex = gltfBufferViews.length;
    gltfBufferViews.push({
      buffer: bufferIndex,
      byteOffset: indexDataByteOffset,
      byteLength: indices.byteLength,
      target: GLTF_TARGETS.ELEMENT_ARRAY_BUFFER, // For indices
    });

    // Index Accessor
    const indicesAccessorIndex = gltfAccessors.length;
    gltfAccessors.push({
      bufferView: indexBufferViewIndex,
      byteOffset: 0, // Indices are tightly packed in their own buffer view segment
      componentType: indices instanceof Uint16Array ? GLTF_COMPONENT_TYPES.UNSIGNED_SHORT : GLTF_COMPONENT_TYPES.UNSIGNED_INT,
      count: indices.length,
      type: 'SCALAR',
    });

    return {
      attributes,
      indicesAccessorIndex,
    };
  }

  /**
   * Create GLTF primitive object
   */
  private static createGltfPrimitive(
    bufferInfo: any,
    materialIndexValue: number | null,
    materialIdToGltfIndexMap: Map<number | null, number>
  ) {
    const gltfPrim: any = {
      attributes: bufferInfo.attributes,
      indices: bufferInfo.indicesAccessorIndex,
      mode: GLTF_PRIMITIVE_MODES.TRIANGLES,
    };

    if (materialIndexValue !== null && materialIndexValue !== undefined) {
      const gltfMaterialIndex = materialIdToGltfIndexMap.get(materialIndexValue);
      if (gltfMaterialIndex !== undefined) {
        gltfPrim.material = gltfMaterialIndex;
      }
    }

    return gltfPrim;
  }

  /**
   * Process a GLTF mesh and convert it to our Mesh format
   */
  private static processGltfMesh(
    gltf: ProcessedGltf,
    gltfMesh: GltfMeshJson,
    meshName: string
  ): Mesh {
    const newCoreMesh = new Mesh(meshName);

    // Helper to get ArrayBuffer data for an accessor
    const getAccessorData = this.createAccessorDataReader(gltf);

    // Process materials and textures first (simplified)
    const materials: Material[] = [];
    if (gltf.json.materials) {
      for (const gltfMat of gltf.json.materials as GltfMaterialJson[]) {
        const materialName = gltfMat.name || `Material_${materials.length}`;
        
        // Prepare material options
        const materialOptions: Partial<MaterialOptions> = {};
        
        if (gltfMat.pbrMetallicRoughness) {
          if (gltfMat.pbrMetallicRoughness.baseColorFactor) {
            materialOptions.color = new Vector3D(...gltfMat.pbrMetallicRoughness.baseColorFactor.slice(0, 3) as [number, number, number]);
            materialOptions.opacity = gltfMat.pbrMetallicRoughness.baseColorFactor[3] ?? 1.0;
          }
          materialOptions.metallic = gltfMat.pbrMetallicRoughness.metallicFactor ?? 0.0;
          materialOptions.roughness = gltfMat.pbrMetallicRoughness.roughnessFactor ?? 1.0;
        }
        if (gltfMat.emissiveFactor) {
          materialOptions.emissiveColor = new Vector3D(...gltfMat.emissiveFactor as [number, number, number]);
        }
        
        const material = newCoreMesh.addMaterial(materialName, materialOptions);
        materials.push(material);
      }
    }

    // Process the mesh primitives
    if (gltfMesh.primitives) {
      this.processMeshPrimitives(gltfMesh.primitives, newCoreMesh, materials, getAccessorData);
    }
    
    newCoreMesh.computeBoundingBox();
    console.log('glTF basic mesh import finished. Mesh created:', newCoreMesh);
    return newCoreMesh;
  }

  /**
   * Create GLTF data structure from a mesh
   */
  private static createGltfFromMesh(mesh: Mesh): any {
    const { gltfJson, bufferData } = this.buildGltfFromMesh(mesh);
    
    return {
      json: gltfJson,
      buffers: bufferData.map((buffer, index) => ({
        arrayBuffer: buffer,
        byteLength: buffer.byteLength
      }))
    };
  }
} 