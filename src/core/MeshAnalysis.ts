import { Vector3D } from '@/utils/Vector3D';
import { MeshGeometry } from './MeshGeometry';

/**
 * Handles analytical operations for mesh data including calculations of geometric properties.
 * These operations analyze the mesh without modifying it.
 */
export class MeshAnalysis {
  /**
   * Computes the axis-aligned bounding box for the mesh.
   * @param geometry - The mesh geometry to analyze.
   * @returns An object with min and max vectors, or null if no vertices exist.
   */
  static computeBoundingBox(geometry: MeshGeometry): { min: Vector3D; max: Vector3D } | null {
    if (geometry.vertices.size === 0) {
      return null;
    }

    const firstVertex = geometry.vertexArray[0];
    const min = firstVertex.position.clone();
    const max = firstVertex.position.clone();

    geometry.vertices.forEach(vertex => {
      const pos = vertex.position;
      if (pos.x < min.x) min.x = pos.x;
      if (pos.y < min.y) min.y = pos.y;
      if (pos.z < min.z) min.z = pos.z;
      if (pos.x > max.x) max.x = pos.x;
      if (pos.y > max.y) max.y = pos.y;
      if (pos.z > max.z) max.z = pos.z;
    });

    return { min, max };
  }

  /**
   * Calculates the total surface area of the mesh.
   * @param geometry - The mesh geometry to analyze.
   * @returns The total surface area.
   */
  static calculateSurfaceArea(geometry: MeshGeometry): number {
    let totalArea = 0;

    geometry.faces.forEach(face => {
      if (face.vertices.length < 3) {
        return; // Skip degenerate faces
      }

      if (face.vertices.length === 3) {
        // Triangle: use cross product
        const v0 = face.vertices[0].position;
        const v1 = face.vertices[1].position;
        const v2 = face.vertices[2].position;
        
        const edge1 = Vector3D.subtract(v1, v0);
        const edge2 = Vector3D.subtract(v2, v0);
        const cross = Vector3D.cross(edge1, edge2);
        totalArea += cross.length() * 0.5;
      } else {
        // Polygon: triangulate from first vertex
        const v0 = face.vertices[0].position;
        for (let i = 1; i < face.vertices.length - 1; i++) {
          const v1 = face.vertices[i].position;
          const v2 = face.vertices[i + 1].position;
          
          const edge1 = Vector3D.subtract(v1, v0);
          const edge2 = Vector3D.subtract(v2, v0);
          const cross = Vector3D.cross(edge1, edge2);
          totalArea += cross.length() * 0.5;
        }
      }
    });

    return totalArea;
  }

  /**
   * Calculates the volume of the mesh using the divergence theorem.
   * Assumes the mesh represents a closed, manifold surface.
   * @param geometry - The mesh geometry to analyze.
   * @returns The volume of the mesh.
   * @warning This method assumes the mesh is closed and manifold. 
   * Results may be incorrect for open meshes or meshes with holes.
   */
  static calculateVolume(geometry: MeshGeometry): number {
    let volume = 0;

    geometry.faces.forEach(face => {
      if (face.vertices.length < 3) {
        return; // Skip degenerate faces
      }

      if (face.vertices.length === 3) {
        // Triangle
        const v0 = face.vertices[0].position;
        const v1 = face.vertices[1].position;
        const v2 = face.vertices[2].position;
        
        // Volume contribution of tetrahedron formed by origin and triangle
        volume += v0.dot(Vector3D.cross(v1, v2)) / 6.0;
      } else {
        // Polygon: triangulate from first vertex
        const v0 = face.vertices[0].position;
        for (let i = 1; i < face.vertices.length - 1; i++) {
          const v1 = face.vertices[i].position;
          const v2 = face.vertices[i + 1].position;
          
          // Volume contribution of tetrahedron formed by origin and triangle
          volume += v0.dot(Vector3D.cross(v1, v2)) / 6.0;
        }
      }
    });

    return Math.abs(volume);
  }

  /**
   * Calculates the centroid (center of mass) of the mesh based on vertex positions.
   * @param geometry - The mesh geometry to analyze.
   * @returns The centroid as a Vector3D, or null if no vertices exist.
   */
  static calculateCentroid(geometry: MeshGeometry): Vector3D | null {
    if (geometry.vertices.size === 0) {
      return null;
    }

    const centroid = new Vector3D(0, 0, 0);
    let count = 0;

    geometry.vertices.forEach(vertex => {
      centroid.add(vertex.position);
      count++;
    });

    centroid.divideScalar(count);
    return centroid;
  }

  /**
   * Calculates basic mesh statistics.
   * @param geometry - The mesh geometry to analyze.
   * @returns An object containing various mesh statistics.
   */
  static calculateStatistics(geometry: MeshGeometry): {
    vertexCount: number;
    edgeCount: number;
    faceCount: number;
    materialCount: number;
    triangleCount: number;
    quadCount: number;
    polygonCount: number;
    boundingBox: { min: Vector3D; max: Vector3D } | null;
    surfaceArea: number;
    volume: number;
    centroid: Vector3D | null;
  } {
    let triangleCount = 0;
    let quadCount = 0;
    let polygonCount = 0;

    geometry.faces.forEach(face => {
      if (face.vertices.length === 3) {
        triangleCount++;
      } else if (face.vertices.length === 4) {
        quadCount++;
      } else if (face.vertices.length > 4) {
        polygonCount++;
      }
    });

    return {
      vertexCount: geometry.vertices.size,
      edgeCount: geometry.edges.size,
      faceCount: geometry.faces.size,
      materialCount: geometry.materials.size,
      triangleCount,
      quadCount,
      polygonCount,
      boundingBox: this.computeBoundingBox(geometry),
      surfaceArea: this.calculateSurfaceArea(geometry),
      volume: this.calculateVolume(geometry),
      centroid: this.calculateCentroid(geometry)
    };
  }

  /**
   * Checks if the mesh is manifold (each edge is shared by at most 2 faces).
   * @param geometry - The mesh geometry to analyze.
   * @returns An object indicating if the mesh is manifold and any problematic edges.
   */
  static checkManifold(geometry: MeshGeometry): {
    isManifold: boolean;
    nonManifoldEdges: string[];
    boundaryEdges: string[];
  } {
    const nonManifoldEdges: string[] = [];
    const boundaryEdges: string[] = [];

    geometry.edges.forEach((edge, key) => {
      if (edge.faces.size > 2) {
        nonManifoldEdges.push(key);
      } else if (edge.faces.size === 1) {
        boundaryEdges.push(key);
      }
    });

    return {
      isManifold: nonManifoldEdges.length === 0,
      nonManifoldEdges,
      boundaryEdges
    };
  }

  /**
   * Checks if the mesh is closed (no boundary edges).
   * @param geometry - The mesh geometry to analyze.
   * @returns True if the mesh is closed, false otherwise.
   */
  static isClosed(geometry: MeshGeometry): boolean {
    for (const edge of geometry.edges.values()) {
      if (edge.faces.size < 2) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculates the Euler characteristic (V - E + F) of the mesh.
   * For a closed mesh without holes, this should be 2.
   * @param geometry - The mesh geometry to analyze.
   * @returns The Euler characteristic.
   */
  static calculateEulerCharacteristic(geometry: MeshGeometry): number {
    return geometry.vertices.size - geometry.edges.size + geometry.faces.size;
  }

  /**
   * Finds the minimum and maximum edge lengths in the mesh.
   * @param geometry - The mesh geometry to analyze.
   * @returns An object with min and max edge lengths, or null if no edges exist.
   */
  static findEdgeLengthRange(geometry: MeshGeometry): { min: number; max: number } | null {
    if (geometry.edges.size === 0) {
      return null;
    }

    let minLength = Infinity;
    let maxLength = -Infinity;

    geometry.edges.forEach(edge => {
      const length = edge.v0.position.distanceTo(edge.v1.position);
      if (length < minLength) minLength = length;
      if (length > maxLength) maxLength = length;
    });

    return { min: minLength, max: maxLength };
  }
} 