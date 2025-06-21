import { Vector3D } from '@/utils/Vector3D';
import { Vertex } from './Vertex';
import { Edge } from './Edge';
import { Face } from './Face';
import { Material } from './Material';
import { MeshGeometry } from './MeshGeometry';

/**
 * Handles serialization and deserialization of mesh data to/from JSON format.
 * This includes conversion of all mesh components and proper relationship restoration.
 */
export class MeshSerialization {
  /**
   * Serializes mesh geometry to a JSON object.
   * @param geometry - The mesh geometry to serialize.
   * @param meshId - The ID of the mesh.
   * @param meshName - The name of the mesh.
   * @param boundingBoxMin - The minimum corner of the bounding box.
   * @param boundingBoxMax - The maximum corner of the bounding box.
   * @param metadata - Additional metadata for the mesh.
   * @returns A JSON representation of the mesh.
   */
  static toJSON(
    geometry: MeshGeometry,
    meshId: number,
    meshName: string,
    boundingBoxMin: Vector3D | null = null,
    boundingBoxMax: Vector3D | null = null,
    metadata: Record<string, any> = {}
  ): {
    id: number;
    name: string;
    materials: any[];
    vertices: any[];
    edges: any[];
    faces: any[];
    boundingBoxMin: [number, number, number] | null;
    boundingBoxMax: [number, number, number] | null;
    metadata: Record<string, any>;
  } {
    return {
      id: meshId,
      name: meshName,
      materials: Array.from(geometry.materials.values()).map(material => material.toJSON()),
      vertices: Array.from(geometry.vertices.values()).map(vertex => vertex.toJSON()),
      edges: Array.from(geometry.edges.values()).map(edge => edge.toJSON()),
      faces: Array.from(geometry.faces.values()).map(face => face.toJSON()),
      boundingBoxMin: boundingBoxMin ? boundingBoxMin.toArray() : null,
      boundingBoxMax: boundingBoxMax ? boundingBoxMax.toArray() : null,
      metadata: metadata,
    };
  }

  /**
   * Creates mesh geometry from a JSON object.
   * @param json - The JSON object representing the mesh.
   * @returns An object containing the new geometry and mesh properties.
   * @throws Error if the JSON data is invalid or references are broken.
   */
  static fromJSON(json: {
    id: number;
    name: string;
    materials?: any[];
    vertices?: any[];
    edges?: any[];
    faces?: any[];
    boundingBoxMin?: [number, number, number] | null;
    boundingBoxMax?: [number, number, number] | null;
    metadata?: Record<string, any>;
  }): {
    geometry: MeshGeometry;
    meshId: number;
    meshName: string;
    boundingBoxMin: Vector3D | null;
    boundingBoxMax: Vector3D | null;
    metadata: Record<string, any>;
  } {
    const geometry = new MeshGeometry();

    // Deserialize Materials first (they're referenced by faces)
    if (json.materials) {
      json.materials.forEach((materialJson: any) => {
        const material = Material.fromJSON(materialJson);
        geometry.materials.set(material.id, material);
      });
    }

    // Deserialize Vertices
    const vertexMap = new Map<number, Vertex>();
    if (json.vertices) {
      json.vertices.forEach((vertexJson: any) => {
        const vertex = Vertex.fromJSON(vertexJson);
        geometry.vertices.set(vertex.id, vertex);
        vertexMap.set(vertex.id, vertex);
      });
    }

    // Deserialize Edges
    // Note: Edge.fromJSON requires vertices to exist, which they now do.
    if (json.edges) {
      json.edges.forEach((edgeJson: any) => {
        const edge = Edge.fromJSON(edgeJson, vertexMap);
        geometry.edges.set(edge.key, edge);
        // Ensure vertices are linked to this edge (Edge.fromJSON links edge to vertices, but vertex.edges might need update)
        edge.v0.edges.add(edge.key);
        edge.v1.edges.add(edge.key);
      });
    }

    // Deserialize Faces
    // Faces are linked to vertices via vertexMap. Edges within faces are re-linked.
    if (json.faces) {
      json.faces.forEach((faceJson: any) => {
        const face = Face.fromJSON(faceJson, vertexMap);
        geometry.faces.set(face.id, face);

        // Link face to its vertices
        face.vertices.forEach(v => v.faces.add(face.id));

        // Link face to its edges and edges to this face
        // Face.fromJSON does not set up face.edges or edge.faces by default.
        // We need to reconstruct face.edges[] and update edge.faces set.
        const edgeVertexPairs = face.getEdgeVertexPairs();
        edgeVertexPairs.forEach(pair => {
          const edgeKey = Edge.getKey(pair[0].id, pair[1].id);
          const edge = geometry.edges.get(edgeKey);
          if (edge) {
            face.edges.push(edge);
            edge.faces.add(face.id);
          } else {
            // This case should ideally not happen if all edges were serialized and deserialized correctly.
            // However, if edges are implicitly defined by faces, new edges might need to be created here.
            // For now, we assume edges are explicitly serialized and deserialized.
            console.warn(`Edge not found for face ${face.id} between vertices ${pair[0].id} and ${pair[1].id} during MeshSerialization.fromJSON. This might indicate an issue with edge serialization or deserialization.`);
          }
        });
      });
    }

    // Restore bounding box if present
    let boundingBoxMin: Vector3D | null = null;
    let boundingBoxMax: Vector3D | null = null;
    
    if (json.boundingBoxMin && json.boundingBoxMax) {
      boundingBoxMin = Vector3D.fromArray(json.boundingBoxMin);
      boundingBoxMax = Vector3D.fromArray(json.boundingBoxMax);
    }

    return {
      geometry,
      meshId: json.id,
      meshName: json.name,
      boundingBoxMin,
      boundingBoxMax,
      metadata: json.metadata || {}
    };
  }

  /**
   * Validates the integrity of serialized mesh data.
   * @param json - The JSON object to validate.
   * @returns An array of validation errors, empty if valid.
   */
  static validateJSON(json: any): string[] {
    const errors: string[] = [];

    // Check required fields
    if (typeof json.id !== 'number') {
      errors.push('Missing or invalid mesh ID');
    }
    if (typeof json.name !== 'string') {
      errors.push('Missing or invalid mesh name');
    }

    // Validate materials
    if (json.materials && Array.isArray(json.materials)) {
      json.materials.forEach((material: any, index: number) => {
        if (typeof material.id !== 'number') {
          errors.push(`Material ${index}: Missing or invalid ID`);
        }
        if (typeof material.name !== 'string') {
          errors.push(`Material ${index}: Missing or invalid name`);
        }
      });
    }

    // Validate vertices
    if (json.vertices && Array.isArray(json.vertices)) {
      json.vertices.forEach((vertex: any, index: number) => {
        if (typeof vertex.id !== 'number') {
          errors.push(`Vertex ${index}: Missing or invalid ID`);
        }
        if (!Array.isArray(vertex.position) || vertex.position.length !== 3) {
          errors.push(`Vertex ${index}: Invalid position array`);
        }
      });
    }

    // Validate faces
    if (json.faces && Array.isArray(json.faces)) {
      const vertexIds = new Set(json.vertices?.map((v: any) => v.id) || []);
      
      json.faces.forEach((face: any, index: number) => {
        if (typeof face.id !== 'number') {
          errors.push(`Face ${index}: Missing or invalid ID`);
        }
        if (!Array.isArray(face.vertexIds) || face.vertexIds.length < 3) {
          errors.push(`Face ${index}: Invalid or insufficient vertex IDs`);
        } else {
          // Check if all vertex IDs exist
          face.vertexIds.forEach((vertexId: any) => {
            if (!vertexIds.has(vertexId)) {
              errors.push(`Face ${index}: References non-existent vertex ID ${vertexId}`);
            }
          });
        }
      });
    }

    // Validate edges
    if (json.edges && Array.isArray(json.edges)) {
      const vertexIds = new Set(json.vertices?.map((v: any) => v.id) || []);
      
      json.edges.forEach((edge: any, index: number) => {
        if (typeof edge.id !== 'number') {
          errors.push(`Edge ${index}: Missing or invalid ID`);
        }
        if (typeof edge.v0Id !== 'number' || typeof edge.v1Id !== 'number') {
          errors.push(`Edge ${index}: Invalid vertex IDs`);
        } else {
          if (!vertexIds.has(edge.v0Id)) {
            errors.push(`Edge ${index}: References non-existent vertex ID ${edge.v0Id}`);
          }
          if (!vertexIds.has(edge.v1Id)) {
            errors.push(`Edge ${index}: References non-existent vertex ID ${edge.v1Id}`);
          }
        }
      });
    }

    // Validate bounding box
    if (json.boundingBoxMin !== null && json.boundingBoxMin !== undefined) {
      if (!Array.isArray(json.boundingBoxMin) || json.boundingBoxMin.length !== 3) {
        errors.push('Invalid boundingBoxMin format');
      }
    }
    if (json.boundingBoxMax !== null && json.boundingBoxMax !== undefined) {
      if (!Array.isArray(json.boundingBoxMax) || json.boundingBoxMax.length !== 3) {
        errors.push('Invalid boundingBoxMax format');
      }
    }

    return errors;
  }

  /**
   * Creates a compact JSON representation by omitting optional/redundant data.
   * @param geometry - The mesh geometry to serialize.
   * @param meshId - The ID of the mesh.
   * @param meshName - The name of the mesh.
   * @param options - Options for compact serialization.
   * @returns A compact JSON representation of the mesh.
   */
  static toCompactJSON(
    geometry: MeshGeometry,
    meshId: number,
    meshName: string,
    options: {
      includeNormals?: boolean;
      includeUVs?: boolean;
      includeEdges?: boolean;
      includeMaterials?: boolean;
      includeBoundingBox?: boolean;
    } = {}
  ): any {
    const result: any = {
      id: meshId,
      name: meshName,
      vertices: geometry.vertexArray.map(vertex => {
        const data: any = {
          id: vertex.id,
          position: vertex.position.toArray()
        };
        if (options.includeNormals && vertex.normal) {
          data.normal = vertex.normal.toArray();
        }
        if (options.includeUVs && vertex.uv) {
          data.uv = vertex.uv;
        }
        return data;
      }),
      faces: geometry.faceArray.map(face => ({
        id: face.id,
        vertexIds: face.vertices.map(v => v.id),
        ...(face.materialIndex !== null && options.includeMaterials && { materialIndex: face.materialIndex })
      }))
    };

    if (options.includeEdges) {
      result.edges = geometry.edgeArray.map(edge => edge.toJSON());
    }

    if (options.includeMaterials) {
      result.materials = geometry.materialArray.map(material => material.toJSON());
    }

    return result;
  }
} 