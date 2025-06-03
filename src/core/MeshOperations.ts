import { Vector3D } from '@/utils/Vector3D';
import { Vector2D } from '@/utils/Vector2D';
import { Vertex } from './Vertex';
import { Edge } from './Edge';
import { Face } from './Face';
import { MeshGeometry } from './MeshGeometry';

/**
 * Handles complex mesh operations including validation, cleanup, and advanced manipulations.
 * These operations modify the mesh geometry or analyze its properties.
 */
export class MeshOperations {
  /**
   * Welds (merges) vertices that are closer than a given tolerance.
   * This operation modifies the mesh in place.
   * - Slave vertices are removed.
   * - Faces and edges are updated to reference the master vertex of a welded group.
   * - The master vertex (first one encountered in a group) retains its normal and UVs.
   * @param geometry - The mesh geometry to operate on.
   * @param tolerance - The maximum distance between vertices to be considered coincident.
   * @returns The number of vertices welded (removed).
   * TODO: Implement a more efficient spatial query (e.g., octree) for large meshes.
   * TODO: Consider strategies for merging normals and UVs (e.g., averaging).
   */
  static weldVertices(geometry: MeshGeometry, tolerance: number = 1e-6): number {
    const verticesToRemove = new Set<number>();
    const vertexMap = new Map<number, number>(); // Maps slaveId -> masterId
    const originalVertexArray = geometry.vertexArray; // Avoid issues with map modification during iteration
    let weldedCount = 0;

    // For performance, square the tolerance once
    const toleranceSq = tolerance * tolerance;

    // Find groups of coincident vertices
    for (let i = 0; i < originalVertexArray.length; i++) {
      const v1 = originalVertexArray[i];
      if (verticesToRemove.has(v1.id) || vertexMap.has(v1.id)) continue; // Already processed as a slave or master of a processed slave

      for (let j = i + 1; j < originalVertexArray.length; j++) {
        const v2 = originalVertexArray[j];
        if (verticesToRemove.has(v2.id) || vertexMap.has(v2.id)) continue;

        if (v1.position.distanceToSquared(v2.position) < toleranceSq) {
          // v1 becomes master, v2 becomes slave
          vertexMap.set(v2.id, v1.id);
          verticesToRemove.add(v2.id);
          weldedCount++;
        }
      }
    }

    if (weldedCount === 0) {
      return 0; // No welding needed
    }

    // Update faces and edges to use master vertices
    const facesToUpdate = new Set<Face>();

    geometry.faces.forEach(face => {
      let needsUpdate = false;
      const newVertices = face.vertices.map(vertex => {
        const masterId = vertexMap.get(vertex.id);
        if (masterId !== undefined) {
          needsUpdate = true;
          const masterVertex = geometry.getVertex(masterId);
          if (!masterVertex) {
            throw new Error(`MeshOperations.weldVertices: Master vertex ${masterId} not found.`);
          }
          return masterVertex;
        }
        return vertex;
      });

      if (needsUpdate) {
        // Check for degenerate faces (faces where multiple vertices map to the same master)
        const uniqueVertexIds = new Set(newVertices.map(v => v.id));
        if (uniqueVertexIds.size < 3) {
          // Mark face for removal
          facesToUpdate.add(face);
        } else {
          // Update the face's vertex list
          face.vertices = newVertices;
          // Recalculate normal
          face.calculateNormal();
        }
      }
    });

    // Remove degenerate faces
    facesToUpdate.forEach(face => {
      geometry.removeFace(face.id);
    });

    // Remove slave vertices
    verticesToRemove.forEach(vertexId => {
      geometry.removeVertex(vertexId);
    });

    // Rebuild edges (they'll be automatically recreated with proper master vertex references)
    // This is handled by the removeVertex and addFace operations

    return weldedCount;
  }

  /**
   * Validates the mesh for common issues and returns a list of problems found.
   * @param geometry - The mesh geometry to validate.
   * @returns An array of strings describing validation issues found.
   */
  static validate(geometry: MeshGeometry): string[] {
    const issues: string[] = [];

    // Check for orphaned vertices (vertices not part of any face)
    geometry.vertices.forEach((vertex, id) => {
      if (vertex.faces.size === 0) {
        issues.push(`Orphaned vertex found: ${id}`);
      }
    });

    // Check for orphaned edges (edges not part of any face)
    geometry.edges.forEach((edge, key) => {
      if (edge.faces.size === 0) {
        issues.push(`Orphaned edge found: ${key}`);
      }
    });

    // Check for faces with invalid vertex references
    geometry.faces.forEach((face, id) => {
      face.vertices.forEach((vertex, index) => {
        if (!geometry.vertices.has(vertex.id)) {
          issues.push(`Face ${id} references non-existent vertex ${vertex.id} at index ${index}`);
        }
      });

      // Check for degenerate faces (less than 3 vertices or collinear vertices)
      if (face.vertices.length < 3) {
        issues.push(`Degenerate face found: ${id} (less than 3 vertices)`);
      }

      if (face.normal === null) {
        issues.push(`Face ${id} has null normal (possibly degenerate)`);
      }
    });

    // Check for edges with invalid vertex references
    geometry.edges.forEach((edge, key) => {
      if (!geometry.vertices.has(edge.v0.id)) {
        issues.push(`Edge ${key} references non-existent vertex ${edge.v0.id}`);
      }
      if (!geometry.vertices.has(edge.v1.id)) {
        issues.push(`Edge ${key} references non-existent vertex ${edge.v1.id}`);
      }
    });

    // Check for material references
    geometry.faces.forEach((face, id) => {
      if (face.materialIndex !== null && face.materialIndex !== undefined) {
        if (!geometry.materials.has(face.materialIndex)) {
          issues.push(`Face ${id} references non-existent material ${face.materialIndex}`);
        }
      }
    });

    return issues;
  }

  /**
   * Removes faces that have degenerate geometry (null normals, collinear vertices, etc.).
   * @param geometry - The mesh geometry to clean.
   * @returns The number of degenerate faces removed.
   */
  static removeDegenerateFaces(geometry: MeshGeometry): number {
    const facesToRemove: number[] = [];

    geometry.faces.forEach((face, id) => {
      if (face.vertices.length < 3) {
        facesToRemove.push(id);
        return;
      }

      // Check if face has null normal (indicates degenerate geometry)
      if (face.normal === null) {
        facesToRemove.push(id);
        return;
      }

      // Additional check: see if face normal is too small (nearly zero area)
      if (face.normal && face.normal.lengthSq() < 1e-12) {
        facesToRemove.push(id);
        return;
      }
    });

    facesToRemove.forEach(faceId => {
      geometry.removeFace(faceId);
    });

    return facesToRemove.length;
  }

  /**
   * Removes edges that are not part of any face.
   * @param geometry - The mesh geometry to clean.
   * @returns The number of orphaned edges removed.
   */
  static removeOrphanedEdges(geometry: MeshGeometry): number {
    const edgesToRemove: string[] = [];

    geometry.edges.forEach((edge, key) => {
      if (edge.faces.size === 0) {
        edgesToRemove.push(key);
      }
    });

    edgesToRemove.forEach(edgeKey => {
      const edge = geometry.edges.get(edgeKey);
      if (edge) {
        // Remove edge references from vertices
        edge.v0.edges.delete(edgeKey);
        edge.v1.edges.delete(edgeKey);
        geometry.edges.delete(edgeKey);
      }
    });

    return edgesToRemove.length;
  }

  /**
   * Removes vertices that are not part of any face.
   * @param geometry - The mesh geometry to clean.
   * @returns The number of orphaned vertices removed.
   */
  static removeOrphanedVertices(geometry: MeshGeometry): number {
    const verticesToRemove: number[] = [];

    geometry.vertices.forEach((vertex, id) => {
      if (vertex.faces.size === 0) {
        verticesToRemove.push(id);
      }
    });

    verticesToRemove.forEach(vertexId => {
      const vertex = geometry.vertices.get(vertexId);
      if (vertex) {
        // Remove vertex references from edges
        vertex.edges.forEach(edgeKey => {
          const edge = geometry.edges.get(edgeKey);
          if (edge) {
            geometry.edges.delete(edgeKey);
          }
        });
        geometry.vertices.delete(vertexId);
      }
    });

    return verticesToRemove.length;
  }

  /**
   * Cleans up material indices by removing references to non-existent materials.
   * @param geometry - The mesh geometry to clean.
   * @returns The number of invalid material references cleaned.
   */
  static cleanMaterialIndices(geometry: MeshGeometry): number {
    let cleanedCount = 0;

    geometry.faces.forEach(face => {
      if (face.materialIndex !== null && face.materialIndex !== undefined) {
        if (!geometry.materials.has(face.materialIndex)) {
          face.materialIndex = null;
          cleanedCount++;
        }
      }
    });

    return cleanedCount;
  }

  /**
   * Creates a deep clone of the mesh geometry.
   * New vertices, edges, faces, and materials will be created with new IDs.
   * @param originalGeometry - The geometry to clone.
   * @returns A new MeshGeometry instance that is a clone of the original.
   */
  static clone(originalGeometry: MeshGeometry): MeshGeometry {
    const newGeometry = new MeshGeometry();

    // 1. Clone Materials
    const oldToNewMaterialIdMap = new Map<number, number>();
    originalGeometry.materials.forEach(originalMaterial => {
      const clonedMaterial = originalMaterial.clone(); // clone() assigns a new ID
      newGeometry.materials.set(clonedMaterial.id, clonedMaterial);
      if (originalMaterial.id != null) { // Keep track of mapping if original had an ID
        oldToNewMaterialIdMap.set(originalMaterial.id, clonedMaterial.id);
      }
    });

    // 2. Clone Vertices
    const oldToNewVertexInstanceMap = new Map<number, Vertex>();
    originalGeometry.vertices.forEach(originalVertex => {
      // newGeometry.addVertex creates a new Vertex instance with a new ID
      const newVertex = newGeometry.addVertex(
        originalVertex.position.x,
        originalVertex.position.y,
        originalVertex.position.z,
        originalVertex.normal ? originalVertex.normal.clone() : undefined,
        originalVertex.uv ? { ...originalVertex.uv } : undefined
      );
      oldToNewVertexInstanceMap.set(originalVertex.id, newVertex);
    });

    // 3. Clone Faces (and their constituent edges)
    originalGeometry.faces.forEach(originalFace => {
      const newFaceVertexInstances = originalFace.vertices.map(ov => oldToNewVertexInstanceMap.get(ov.id)!);
      if (newFaceVertexInstances.some(v => !v)) {
        console.warn(`MeshOperations.clone: Could not find all new vertex instances for face ${originalFace.id}. Skipping face.`);
        return;
      }
      const newVertexIds = newFaceVertexInstances.map(v => v.id);
      
      let newMaterialIndex: number | undefined = undefined;
      if (originalFace.materialIndex !== undefined && originalFace.materialIndex !== null) {
        newMaterialIndex = oldToNewMaterialIdMap.get(originalFace.materialIndex);
      }

      // newGeometry.addFace creates a new Face, finds/creates Edges, and links everything
      const newFace = newGeometry.addFace(newVertexIds, newMaterialIndex);

      // Copy face normal if it was pre-calculated (custom normal)
      if (originalFace.normal && !newFace.normal) { // Check if addFace already computed one
        newFace.normal = originalFace.normal.clone();
      } else if (originalFace.normal && newFace.normal && !originalFace.normal.equals(newFace.normal, 1e-6)){
        // If addFace computed a normal different from a pre-existing one, prefer the original pre-calculated one.
        newFace.normal = originalFace.normal.clone();
      }
    });

    // 4. Clone Standalone Edges (edges not part of any face)
    originalGeometry.edges.forEach(originalEdge => {
      if (originalEdge.faces.size === 0) {
        const newV0 = oldToNewVertexInstanceMap.get(originalEdge.v0.id);
        const newV1 = oldToNewVertexInstanceMap.get(originalEdge.v1.id);

        if (newV0 && newV1) {
          // Check if this edge was already created by addFace (e.g. if faces were malformed and didn't include all their edges)
          // This is a safeguard, typically addFace handles edges belonging to faces.
          const edgeKey = Edge.getKey(newV0.id, newV1.id);
          if (!newGeometry.edges.has(edgeKey)) {
            const newStandaloneEdge = new Edge(newV0, newV1); // Edge constructor assigns new ID
            newGeometry.edges.set(newStandaloneEdge.key, newStandaloneEdge);
            newV0.edges.add(newStandaloneEdge.key);
            newV1.edges.add(newStandaloneEdge.key);
          }
        } else {
          console.warn(`MeshOperations.clone: Could not find new vertex instances for standalone edge ${originalEdge.id}. Skipping edge.`);
        }
      }
    });

    return newGeometry;
  }

  /**
   * Intelligently unwraps UV coordinates for the mesh using angle-based projection.
   * This method automatically determines the best projection axis based on face normals
   * and creates UV coordinates that minimize distortion.
   * 
   * @param geometry - The mesh geometry to unwrap.
   * @param options - Optional parameters for UV unwrapping.
   * @returns Number of vertices that received UV coordinates.
   */
  static smartUnwrapUVs(
    geometry: MeshGeometry,
    options: {
      scaleUVs?: number;           // Scale factor for UV coordinates (default: 1.0)
      offsetU?: number;            // U offset (default: 0.0)
      offsetV?: number;            // V offset (default: 0.0)
      normalizeToUnitSquare?: boolean; // Whether to normalize UVs to [0,1] range (default: true)
      preferredAxis?: 'x' | 'y' | 'z' | 'auto'; // Preferred projection axis (default: 'auto')
    } = {}
  ): number {
    const {
      scaleUVs = 1.0,
      offsetU = 0.0,
      offsetV = 0.0,
      normalizeToUnitSquare = true,
      preferredAxis = 'auto'
    } = options;

    if (geometry.vertices.size === 0) {
      console.warn('MeshOperations.smartUnwrapUVs: No vertices in mesh to unwrap.');
      return 0;
    }

    // Phase 1: Determine optimal projection axis
    const projectionAxis = this.determineOptimalProjectionAxis(geometry, preferredAxis);
    
    // Phase 2: Project vertices to 2D plane
    const uvCoordinates = new Map<number, Vector2D>();
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    geometry.vertices.forEach(vertex => {
      const uv = this.projectVertexToPlane(vertex.position, projectionAxis);
      uvCoordinates.set(vertex.id, uv);
      
      // Track bounds for normalization
      minU = Math.min(minU, uv.x);
      maxU = Math.max(maxU, uv.x);
      minV = Math.min(minV, uv.y);
      maxV = Math.max(maxV, uv.y);
    });

    // Phase 3: Normalize UV coordinates if requested
    if (normalizeToUnitSquare && (maxU > minU) && (maxV > minV)) {
      const uRange = maxU - minU;
      const vRange = maxV - minV;
      
      uvCoordinates.forEach(uv => {
        uv.x = (uv.x - minU) / uRange;
        uv.y = (uv.y - minV) / vRange;
      });
    }

    // Phase 4: Apply scaling and offset, then assign to vertices
    let processedCount = 0;
    geometry.vertices.forEach(vertex => {
      const uv = uvCoordinates.get(vertex.id);
      if (uv) {
        vertex.setUV(
          (uv.x * scaleUVs) + offsetU,
          (uv.y * scaleUVs) + offsetV
        );
        processedCount++;
      }
    });

    return processedCount;
  }

  /**
   * Determines the optimal projection axis based on face normals.
   * @param geometry - The mesh geometry to analyze.
   * @param preferredAxis - User-specified preferred axis or 'auto' for automatic detection.
   * @returns The optimal projection axis.
   */
  private static determineOptimalProjectionAxis(
    geometry: MeshGeometry, 
    preferredAxis: 'x' | 'y' | 'z' | 'auto'
  ): 'x' | 'y' | 'z' {
    if (preferredAxis !== 'auto') {
      return preferredAxis;
    }

    // Calculate weighted average normal based on face areas
    const totalNormal = new Vector3D(0, 0, 0);
    let totalWeight = 0;

    geometry.faces.forEach(face => {
      if (face.normal && face.vertices.length >= 3) {
        // Calculate face area as weight
        const area = this.calculateFaceArea(face);
        totalNormal.add(face.normal.clone().multiplyScalar(area));
        totalWeight += area;
      }
    });

    if (totalWeight > 0) {
      totalNormal.divideScalar(totalWeight);
    }

    // Choose axis with smallest component (most perpendicular to average normal)
    const absX = Math.abs(totalNormal.x);
    const absY = Math.abs(totalNormal.y);
    const absZ = Math.abs(totalNormal.z);

    if (absX <= absY && absX <= absZ) {
      return 'x'; // Project onto YZ plane
    } else if (absY <= absZ) {
      return 'y'; // Project onto XZ plane
    } else {
      return 'z'; // Project onto XY plane
    }
  }

  /**
   * Projects a 3D vertex position onto a 2D plane.
   * @param position - The 3D position to project.
   * @param axis - The axis to project along ('x', 'y', or 'z').
   * @returns The 2D UV coordinates.
   */
  private static projectVertexToPlane(position: Vector3D, axis: 'x' | 'y' | 'z'): Vector2D {
    switch (axis) {
      case 'x': // Project onto YZ plane (ignore X)
        return new Vector2D(position.y, position.z);
      case 'y': // Project onto XZ plane (ignore Y)  
        return new Vector2D(position.x, position.z);
      case 'z': // Project onto XY plane (ignore Z)
        return new Vector2D(position.x, position.y);
      default:
        throw new Error(`Invalid projection axis: ${axis}`);
    }
  }

  /**
   * Calculates the area of a face.
   * @param face - The face to calculate area for.
   * @returns The area of the face.
   */
  private static calculateFaceArea(face: Face): number {
    if (face.vertices.length < 3) {
      return 0;
    }

    if (face.vertices.length === 3) {
      // Triangle area using cross product
      const v0 = face.vertices[0].position;
      const v1 = face.vertices[1].position;
      const v2 = face.vertices[2].position;
      
      const edge1 = Vector3D.subtract(v1, v0);
      const edge2 = Vector3D.subtract(v2, v0);
      const cross = Vector3D.cross(edge1, edge2);
      return cross.length() * 0.5;
    } else {
      // Polygon area by triangulation from first vertex
      let totalArea = 0;
      const v0 = face.vertices[0].position;
      
      for (let i = 1; i < face.vertices.length - 1; i++) {
        const v1 = face.vertices[i].position;
        const v2 = face.vertices[i + 1].position;
        
        const edge1 = Vector3D.subtract(v1, v0);
        const edge2 = Vector3D.subtract(v2, v0);
        const cross = Vector3D.cross(edge1, edge2);
        totalArea += cross.length() * 0.5;
      }
      
      return totalArea;
    }
  }
} 