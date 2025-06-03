/**
 * 📄 JSON I/O - Enhanced Mesh Import/Export
 * 
 * This module provides comprehensive JSON import/export functionality for mesh data including:
 * - Mesh geometry (vertices, faces, materials)
 * - Material properties and colors
 * - Human-readable format for debugging
 * 
 * Features:
 * - ✅ Human-readable JSON format for debugging
 * - ✅ Complete mesh geometry support
 * - ✅ Material and color data preservation
 * - ✅ Extensible format for custom data
 * - ⚠️ Basic animation support (limited by core classes)
 */

import { Mesh } from '../core/Mesh';
import { Material } from '../core/Material';
import { Vector3D } from '../utils/Vector3D';
import { GltfImportResult } from './GltfIO';

/**
 * JSON format structure for 3D meshes
 */
export interface JsonFormat {
  /** Format version for compatibility */
  version: string;
  /** Metadata about the model */
  metadata?: {
    generator?: string;
    created?: string;
    modified?: string;
    author?: string;
    description?: string;
  };
  /** Mesh data */
  mesh: {
    name: string;
    vertices: Array<{
      id: number;
      position: { x: number; y: number; z: number };
      normal?: { x: number; y: number; z: number };
      uv?: { u: number; v: number };
    }>;
    faces: Array<{
      id: number;
      vertexIds: number[];
      materialId?: number;
      normal?: { x: number; y: number; z: number };
    }>;
    materials: Array<{
      id: number;
      name: string;
      color: { x: number; y: number; z: number };
      opacity: number;
      metallic: number;
      roughness: number;
      emissiveColor: { x: number; y: number; z: number };
    }>;
  };
}

/**
 * Options for JSON import/export
 */
export interface JsonOptions {
  /** Include metadata in export */
  includeMetadata?: boolean;
  /** Pretty print JSON output */
  prettyPrint?: boolean;
  /** Custom metadata to include */
  metadata?: Partial<JsonFormat['metadata']>;
}

/**
 * JSON I/O class for mesh import/export
 */
export class JsonIO {
  private static readonly FORMAT_VERSION = '1.0.0';

  /**
   * Export a complete 3D model to JSON string (mesh only for now)
   */
  static exportComplete(
    data: GltfImportResult,
    options: JsonOptions = {}
  ): string {
    const jsonData = this.createJsonFormat(data.mesh, options);
    return JSON.stringify(jsonData, null, options.prettyPrint ? 2 : undefined);
  }

  /**
   * Export just a mesh to JSON string
   */
  static exportMeshToString(mesh: Mesh, prettyPrint: boolean = false): string {
    return this.exportComplete({ 
      mesh, 
      skeleton: undefined, 
      animations: [], 
      skinWeights: undefined 
    }, { prettyPrint });
  }

  /**
   * Import a complete 3D model from JSON string (mesh only for now)
   */
  static importComplete(jsonString: string): GltfImportResult {
    const jsonData: JsonFormat = JSON.parse(jsonString);
    this.validateJsonFormat(jsonData);
    
    return {
      mesh: this.importMeshFromJson(jsonData.mesh),
      skeleton: undefined,
      animations: [],
      skinWeights: undefined
    };
  }

  /**
   * Import just a mesh from JSON string
   */
  static importMeshFromString(jsonString: string): Mesh {
    const result = this.importComplete(jsonString);
    return result.mesh;
  }

  /**
   * Create JSON format structure from mesh data
   */
  private static createJsonFormat(
    mesh: Mesh,
    options: JsonOptions
  ): JsonFormat {
    const jsonFormat: JsonFormat = {
      version: this.FORMAT_VERSION,
      mesh: this.exportMeshToJson(mesh)
    };

    // Add metadata
    if (options.includeMetadata !== false) {
      jsonFormat.metadata = {
        generator: '3d-mesh-lib JSON exporter',
        created: new Date().toISOString(),
        ...options.metadata
      };
    }

    return jsonFormat;
  }

  /**
   * Export mesh to JSON format
   */
  private static exportMeshToJson(mesh: Mesh): JsonFormat['mesh'] {
    const vertices = Array.from(mesh.vertices.values()).map(vertex => ({
      id: vertex.id,
      position: { x: vertex.position.x, y: vertex.position.y, z: vertex.position.z },
      normal: vertex.normal ? { x: vertex.normal.x, y: vertex.normal.y, z: vertex.normal.z } : undefined,
      uv: vertex.uv ? { u: vertex.uv.u, v: vertex.uv.v } : undefined
    }));

    const faces = Array.from(mesh.faces.values()).map(face => ({
      id: face.id,
      vertexIds: face.vertices.map(v => v.id),
      materialId: face.materialIndex || undefined,
      normal: face.normal ? { x: face.normal.x, y: face.normal.y, z: face.normal.z } : undefined
    }));

    const materials = Array.from(mesh.materials.values()).map(material => ({
      id: material.id,
      name: material.name,
      color: { x: material.color.x, y: material.color.y, z: material.color.z },
      opacity: material.opacity,
      metallic: material.metallic,
      roughness: material.roughness,
      emissiveColor: { x: material.emissiveColor.x, y: material.emissiveColor.y, z: material.emissiveColor.z }
    }));

    return {
      name: mesh.name,
      vertices,
      faces,
      materials
    };
  }

  /**
   * Import mesh from JSON format
   */
  private static importMeshFromJson(meshData: JsonFormat['mesh']): Mesh {
    const mesh = new Mesh(meshData.name);

    // Import materials first
    const materialMap = new Map<number, Material>();
    for (const matData of meshData.materials) {
      const material = mesh.addMaterial(matData.name, {
        color: new Vector3D(matData.color.x, matData.color.y, matData.color.z),
        opacity: matData.opacity,
        metallic: matData.metallic,
        roughness: matData.roughness,
        emissiveColor: new Vector3D(matData.emissiveColor.x, matData.emissiveColor.y, matData.emissiveColor.z)
      });
      materialMap.set(matData.id, material);
    }

    // Import vertices
    const vertexMap = new Map<number, any>();
    for (const vertexData of meshData.vertices) {
      const normal = vertexData.normal ? new Vector3D(vertexData.normal.x, vertexData.normal.y, vertexData.normal.z) : undefined;
      const uv = vertexData.uv ? { u: vertexData.uv.u, v: vertexData.uv.v } : undefined;
      
      const vertex = mesh.addVertex(
        vertexData.position.x,
        vertexData.position.y,
        vertexData.position.z,
        normal,
        uv
      );
      vertexMap.set(vertexData.id, vertex);
    }

    // Import faces
    for (const faceData of meshData.faces) {
      const vertexIds = faceData.vertexIds.map(id => vertexMap.get(id)?.id).filter(id => id !== undefined);
      const materialId = faceData.materialId !== undefined ? materialMap.get(faceData.materialId)?.id : undefined;
      
      if (vertexIds.length >= 3) {
        mesh.addFace(vertexIds, materialId);
      }
    }

    return mesh;
  }

  /**
   * Validate JSON format structure
   */
  private static validateJsonFormat(jsonData: any): void {
    if (!jsonData.version) {
      throw new Error('Invalid JSON format: missing version field');
    }

    if (!jsonData.mesh) {
      throw new Error('Invalid JSON format: missing mesh data');
    }

    if (!jsonData.mesh.name || !Array.isArray(jsonData.mesh.vertices) || !Array.isArray(jsonData.mesh.faces)) {
      throw new Error('Invalid JSON format: mesh data is incomplete');
    }
  }

  /**
   * Get format information
   */
  static getFormatInfo(): {
    version: string;
    features: string[];
    limitations: string[];
  } {
    return {
      version: this.FORMAT_VERSION,
      features: [
        'Complete mesh geometry (vertices, faces, materials)',
        'Full material data (PBR properties, colors)',
        'Human-readable JSON format',
        'Extensible metadata support'
      ],
      limitations: [
        'Larger file sizes compared to binary formats',
        'No texture embedding (external texture references only)',
        'Limited precision for floating-point values',
        'No animation or skeletal data support yet'
      ]
    };
  }

  /**
   * Check if a string contains valid JSON format
   */
  static isValidJsonFormat(jsonString: string): boolean {
    try {
      const jsonData = JSON.parse(jsonString);
      this.validateJsonFormat(jsonData);
      return true;
    } catch {
      return false;
    }
  }
}
