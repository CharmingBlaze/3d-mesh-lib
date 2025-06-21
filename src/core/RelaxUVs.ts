import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

interface UVRelaxationData {
  vertexId: number;
  originalU: number;
  originalV: number;
  newU: number;
  newV: number;
}

/**
 * Command to relax UV coordinates to minimize distortion.
 * Uses iterative relaxation to improve UV distribution and reduce stretching.
 */
export class RelaxUVs implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private iterations: number;
  private relaxationFactor: number; // 0.0 to 1.0
  private relaxSelectedOnly: boolean;
  private preserveBoundary: boolean;
  private method: 'laplacian' | 'angle-based';
  
  // Store data for undo
  private relaxationData: UVRelaxationData[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of RelaxUVs command.
   * @param mesh - The mesh to relax UVs for.
   * @param selectionManager - The selection manager.
   * @param iterations - Number of relaxation iterations (default: 5).
   * @param relaxationFactor - Relaxation factor 0.0-1.0 (default: 0.5).
   * @param relaxSelectedOnly - If true, only relax selected vertices (default: false).
   * @param preserveBoundary - If true, don't move UV boundary vertices (default: true).
   * @param method - Relaxation method ('laplacian' or 'angle-based', default: 'laplacian').
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    iterations: number = 5,
    relaxationFactor: number = 0.5,
    relaxSelectedOnly: boolean = false,
    preserveBoundary: boolean = true,
    method: 'laplacian' | 'angle-based' = 'laplacian'
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.iterations = Math.max(1, iterations);
    this.relaxationFactor = Math.max(0.0, Math.min(1.0, relaxationFactor));
    this.relaxSelectedOnly = relaxSelectedOnly;
    this.preserveBoundary = preserveBoundary;
    this.method = method;
    
    const targetDesc = relaxSelectedOnly ? 'selected vertices' : 'entire mesh';
    this.description = `Relax UVs ${targetDesc} (${iterations} iteration${iterations === 1 ? '' : 's'}, ${method}, factor=${relaxationFactor.toFixed(2)})`;
  }

  execute(): void {
    this.relaxationData = [];
    
    const verticesToRelax = this.getVerticesToRelax();
    if (verticesToRelax.length === 0) {
      console.warn('RelaxUVs: No vertices to relax.');
      return;
    }

    // Ensure all vertices have UV coordinates
    this.initializeUVCoordinates(verticesToRelax);

    // Store original UV coordinates
    verticesToRelax.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex && vertex.uv) {
        this.relaxationData.push({
          vertexId: vertexId,
          originalU: vertex.uv.u,
          originalV: vertex.uv.v,
          newU: vertex.uv.u,
          newV: vertex.uv.v
        });
      }
    });

    // Perform relaxation iterations
    for (let i = 0; i < this.iterations; i++) {
      this.performRelaxationIteration(verticesToRelax);
    }

    // Update final UV coordinates in relaxationData
    this.updateFinalUVCoordinates(verticesToRelax);

    console.log(`RelaxUVs: Relaxed ${verticesToRelax.length} vertices over ${this.iterations} iteration${this.iterations === 1 ? '' : 's'} using ${this.method} method.`);
  }

  undo(): void {
    // Restore original UV coordinates
    this.relaxationData.forEach(data => {
      const vertex = this.mesh.getVertex(data.vertexId);
      if (vertex && vertex.uv) {
        vertex.uv.u = data.originalU;
        vertex.uv.v = data.originalV;
      }
    });
    
    this.relaxationData = [];
  }

  /**
   * Gets the list of vertices to relax based on selection and settings.
   * @returns Array of vertex IDs to relax.
   */
  private getVerticesToRelax(): number[] {
    if (this.relaxSelectedOnly) {
      const selectedVertices = this.selectionManager.getSelectedVertexIds();
      if (selectedVertices.size === 0) {
        console.warn('RelaxUVs: No vertices selected for relaxation.');
        return [];
      }
      return Array.from(selectedVertices);
    } else {
      return Array.from(this.mesh.vertices.keys());
    }
  }

  /**
   * Initializes UV coordinates for vertices that don't have them.
   * @param vertexIds - Array of vertex IDs to initialize.
   */
  private initializeUVCoordinates(vertexIds: number[]): void {
    vertexIds.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex && !vertex.uv) {
        // Initialize with simple planar projection
        vertex.uv = {
          u: (vertex.position.x + 1) / 2, // Normalize to [0,1]
          v: (vertex.position.z + 1) / 2  // Normalize to [0,1]
        };
      }
    });
  }

  /**
   * Performs one iteration of UV relaxation.
   * @param verticesToRelax - Array of vertex IDs to relax.
   */
  private performRelaxationIteration(verticesToRelax: number[]): void {
    const newUVs = new Map<number, { u: number; v: number }>();

    // Calculate new UV positions for all vertices
    verticesToRelax.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex || !vertex.uv) return;

      // Skip UV boundary vertices if preserveBoundary is enabled
      if (this.preserveBoundary && this.isUVBoundaryVertex(vertexId)) {
        newUVs.set(vertexId, { u: vertex.uv.u, v: vertex.uv.v });
        return;
      }

      let relaxedUV: { u: number; v: number } | null;
      
      if (this.method === 'laplacian') {
        relaxedUV = this.calculateLaplacianUV(vertexId);
      } else {
        relaxedUV = this.calculateAngleBasedUV(vertexId);
      }

      if (relaxedUV) {
        // Apply relaxation factor
        const currentU = vertex.uv.u;
        const currentV = vertex.uv.v;
        
        const newU = currentU + (relaxedUV.u - currentU) * this.relaxationFactor;
        const newV = currentV + (relaxedUV.v - currentV) * this.relaxationFactor;
        
        // Clamp to [0,1] range
        newUVs.set(vertexId, {
          u: Math.max(0, Math.min(1, newU)),
          v: Math.max(0, Math.min(1, newV))
        });
      }
    });

    // Apply new UV coordinates
    newUVs.forEach((uv, vertexId) => {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex && vertex.uv) {
        vertex.uv.u = uv.u;
        vertex.uv.v = uv.v;
      }
    });
  }

  /**
   * Calculates Laplacian-based relaxed UV position for a vertex.
   * @param vertexId - The vertex ID.
   * @returns Relaxed UV coordinates or null if calculation fails.
   */
  private calculateLaplacianUV(vertexId: number): { u: number; v: number } | null {
    const vertex = this.mesh.getVertex(vertexId);
    if (!vertex || !vertex.uv) return null;

    const uvNeighbors = this.getUVNeighbors(vertexId);
    if (uvNeighbors.length === 0) return null;

    // Calculate centroid of UV neighbors
    let totalU = 0;
    let totalV = 0;
    
    uvNeighbors.forEach(neighborUV => {
      totalU += neighborUV.u;
      totalV += neighborUV.v;
    });

    return {
      u: totalU / uvNeighbors.length,
      v: totalV / uvNeighbors.length
    };
  }

  /**
   * Calculates angle-based relaxed UV position for a vertex.
   * @param vertexId - The vertex ID.
   * @returns Relaxed UV coordinates or null if calculation fails.
   */
  private calculateAngleBasedUV(vertexId: number): { u: number; v: number } | null {
    const vertex = this.mesh.getVertex(vertexId);
    if (!vertex || !vertex.uv) return null;

    const neighbors = this.getVertexNeighbors(vertexId);
    if (neighbors.length < 2) return null;

    // For angle-based relaxation, we weight neighbors by their 3D angles
    let totalU = 0;
    let totalV = 0;
    let totalWeight = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const neighborVertex = this.mesh.getVertex(neighbors[i]);
      if (!neighborVertex || !neighborVertex.uv) continue;

      // Calculate weight based on angle in 3D space
      const weight = this.calculateAngleWeight(vertexId, neighbors[i], neighbors[(i + 1) % neighbors.length]);
      
      totalU += neighborVertex.uv.u * weight;
      totalV += neighborVertex.uv.v * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return null;

    return {
      u: totalU / totalWeight,
      v: totalV / totalWeight
    };
  }

  /**
   * Calculates angle weight for angle-based relaxation.
   * @param centerVertexId - Center vertex ID.
   * @param neighbor1Id - First neighbor vertex ID.
   * @param neighbor2Id - Second neighbor vertex ID.
   * @returns Angle weight.
   */
  private calculateAngleWeight(centerVertexId: number, neighbor1Id: number, neighbor2Id: number): number {
    const center = this.mesh.getVertex(centerVertexId);
    const neighbor1 = this.mesh.getVertex(neighbor1Id);
    const neighbor2 = this.mesh.getVertex(neighbor2Id);
    
    if (!center || !neighbor1 || !neighbor2) return 1.0; // Default weight

    // Calculate vectors
    const v1 = {
      x: neighbor1.position.x - center.position.x,
      y: neighbor1.position.y - center.position.y,
      z: neighbor1.position.z - center.position.z
    };
    
    const v2 = {
      x: neighbor2.position.x - center.position.x,
      y: neighbor2.position.y - center.position.y,
      z: neighbor2.position.z - center.position.z
    };

    // Calculate angle between vectors
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    
    if (mag1 === 0 || mag2 === 0) return 1.0;
    
    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    // Use cotangent weight (common in mesh processing)
    const tanHalfAngle = Math.tan(angle / 2);
    return tanHalfAngle > 0 ? 1.0 / tanHalfAngle : 1.0;
  }

  /**
   * Gets UV coordinates of neighboring vertices.
   * @param vertexId - The vertex ID.
   * @returns Array of neighbor UV coordinates.
   */
  private getUVNeighbors(vertexId: number): Array<{ u: number; v: number }> {
    const neighbors = this.getVertexNeighbors(vertexId);
    const uvNeighbors: Array<{ u: number; v: number }> = [];
    
    neighbors.forEach(neighborId => {
      const neighbor = this.mesh.getVertex(neighborId);
      if (neighbor && neighbor.uv) {
        uvNeighbors.push({ u: neighbor.uv.u, v: neighbor.uv.v });
      }
    });
    
    return uvNeighbors;
  }

  /**
   * Gets all neighboring vertices of a given vertex.
   * @param vertexId - The vertex ID.
   * @returns Array of neighboring vertex IDs.
   */
  private getVertexNeighbors(vertexId: number): number[] {
    const vertex = this.mesh.getVertex(vertexId);
    if (!vertex) return [];

    const neighbors = new Set<number>();

    // Find neighbors through edges
    vertex.edges.forEach(edgeKey => {
      const edge = this.mesh.edges.get(edgeKey);
      if (edge) {
        if (edge.v0.id === vertexId) {
          neighbors.add(edge.v1.id);
        } else if (edge.v1.id === vertexId) {
          neighbors.add(edge.v0.id);
        }
      }
    });

    return Array.from(neighbors);
  }

  /**
   * Checks if a vertex is on the UV boundary.
   * @param vertexId - The vertex ID.
   * @returns True if the vertex is on the UV boundary.
   */
  private isUVBoundaryVertex(vertexId: number): boolean {
    const vertex = this.mesh.getVertex(vertexId);
    if (!vertex || !vertex.uv) return false;

    // A simple heuristic: vertices at UV boundaries (0, 1) or with few UV neighbors
    const u = vertex.uv.u;
    const v = vertex.uv.v;
    
    const isAtUVEdge = (u <= 0.001 || u >= 0.999 || v <= 0.001 || v >= 0.999);
    
    if (isAtUVEdge) return true;

    // Also check if vertex has fewer UV neighbors than 3D neighbors (indicates UV seam)
    const neighbors3D = this.getVertexNeighbors(vertexId);
    const neighborsUV = this.getUVNeighbors(vertexId);
    
    return neighborsUV.length < neighbors3D.length * 0.8; // Some threshold
  }

  /**
   * Updates the final UV coordinates in relaxationData after all iterations.
   * @param vertexIds - Array of vertex IDs that were relaxed.
   */
  private updateFinalUVCoordinates(vertexIds: number[]): void {
    vertexIds.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      const dataEntry = this.relaxationData.find(d => d.vertexId === vertexId);
      if (vertex && vertex.uv && dataEntry) {
        dataEntry.newU = vertex.uv.u;
        dataEntry.newV = vertex.uv.v;
      }
    });
  }

  /**
   * Gets statistics about the UV relaxation operation.
   * @returns Object with relaxation statistics.
   */
  getRelaxationStats(): {
    verticesRelaxed: number;
    boundaryVerticesPreserved: number;
    averageUVChange: number;
    maxUVChange: number;
    method: string;
    iterations: number;
  } {
    const boundaryPreserved = this.relaxationData.filter(data => {
      if (!this.preserveBoundary || !this.isUVBoundaryVertex(data.vertexId)) return false;
      const du = data.newU - data.originalU;
      const dv = data.newV - data.originalV;
      const distance = Math.sqrt(du * du + dv * dv);
      return distance < 0.001;
    }).length;

    const uvChanges = this.relaxationData.map(data => {
      const du = data.newU - data.originalU;
      const dv = data.newV - data.originalV;
      return Math.sqrt(du * du + dv * dv);
    });

    const averageUVChange = uvChanges.length > 0 
      ? uvChanges.reduce((sum, change) => sum + change, 0) / uvChanges.length 
      : 0;

    const maxUVChange = uvChanges.length > 0 
      ? Math.max(...uvChanges) 
      : 0;

    return {
      verticesRelaxed: this.relaxationData.length,
      boundaryVerticesPreserved: boundaryPreserved,
      averageUVChange,
      maxUVChange,
      method: this.method,
      iterations: this.iterations
    };
  }
} 