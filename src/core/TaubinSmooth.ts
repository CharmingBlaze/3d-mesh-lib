import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';

interface TaubinSmoothingData {
  vertexId: number;
  originalPosition: Vector3D;
  newPosition: Vector3D;
}

/**
 * Command to apply Taubin smoothing to selected vertices or entire mesh.
 * Taubin smoothing is an improved version of Laplacian smoothing that better preserves volume
 * by applying alternating positive and negative smoothing steps.
 */
export class TaubinSmooth implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private iterations: number;
  private lambda: number; // Positive smoothing factor (0.0 to 1.0)
  private mu: number; // Negative smoothing factor (negative value)
  private smoothSelectedOnly: boolean;
  private preserveBoundary: boolean;
  
  // Store data for undo
  private smoothingData: TaubinSmoothingData[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of TaubinSmooth command.
   * @param mesh - The mesh to smooth.
   * @param selectionManager - The selection manager.
   * @param iterations - Number of smoothing iterations (default: 5).
   * @param lambda - Positive smoothing factor 0.0-1.0 (default: 0.5).
   * @param mu - Negative smoothing factor, should be negative (default: -0.53).
   * @param smoothSelectedOnly - If true, only smooth selected vertices (default: false).
   * @param preserveBoundary - If true, don't move boundary vertices (default: true).
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    iterations: number = 5,
    lambda: number = 0.5,
    mu: number = -0.53,
    smoothSelectedOnly: boolean = false,
    preserveBoundary: boolean = true
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.iterations = Math.max(1, iterations);
    this.lambda = Math.max(0.0, Math.min(1.0, lambda));
    this.mu = Math.min(0.0, mu); // Ensure mu is negative
    this.smoothSelectedOnly = smoothSelectedOnly;
    this.preserveBoundary = preserveBoundary;
    
    const targetDesc = smoothSelectedOnly ? 'selected vertices' : 'entire mesh';
    this.description = `Taubin smooth ${targetDesc} (${iterations} iteration${iterations === 1 ? '' : 's'}, λ=${lambda.toFixed(2)}, μ=${mu.toFixed(2)})`;
  }

  execute(): void {
    this.smoothingData = [];
    
    const verticesToSmooth = this.getVerticesToSmooth();
    if (verticesToSmooth.length === 0) {
      console.warn('TaubinSmooth: No vertices to smooth.');
      return;
    }

    // Store original positions for undo
    verticesToSmooth.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex) {
        this.smoothingData.push({
          vertexId: vertexId,
          originalPosition: new Vector3D(vertex.position.x, vertex.position.y, vertex.position.z),
          newPosition: new Vector3D(vertex.position.x, vertex.position.y, vertex.position.z)
        });
      }
    });

    // Perform Taubin smoothing iterations
    for (let i = 0; i < this.iterations; i++) {
      // Step 1: Apply positive smoothing (lambda)
      this.performSmoothingStep(verticesToSmooth, this.lambda);
      
      // Step 2: Apply negative smoothing (mu) to counteract shrinkage
      this.performSmoothingStep(verticesToSmooth, this.mu);
    }

    // Update final positions in smoothingData
    this.updateFinalPositions(verticesToSmooth);

    console.log(`TaubinSmooth: Smoothed ${verticesToSmooth.length} vertices over ${this.iterations} iteration${this.iterations === 1 ? '' : 's'}.`);
  }

  undo(): void {
    // Restore original positions
    this.smoothingData.forEach(data => {
      const vertex = this.mesh.getVertex(data.vertexId);
      if (vertex) {
        vertex.position.x = data.originalPosition.x;
        vertex.position.y = data.originalPosition.y;
        vertex.position.z = data.originalPosition.z;
      }
    });
    
    this.smoothingData = [];
  }

  /**
   * Gets the list of vertices to smooth based on selection and settings.
   * @returns Array of vertex IDs to smooth.
   */
  private getVerticesToSmooth(): number[] {
    if (this.smoothSelectedOnly) {
      const selectedVertices = this.selectionManager.getSelectedVertexIds();
      if (selectedVertices.size === 0) {
        console.warn('TaubinSmooth: No vertices selected for smoothing.');
        return [];
      }
      return Array.from(selectedVertices);
    } else {
      return Array.from(this.mesh.vertices.keys());
    }
  }

  /**
   * Performs one smoothing step with the given factor.
   * @param verticesToSmooth - Array of vertex IDs to smooth.
   * @param factor - Smoothing factor (lambda or mu).
   */
  private performSmoothingStep(verticesToSmooth: number[], factor: number): void {
    const newPositions = new Map<number, Vector3D>();

    // Calculate new positions for all vertices
    verticesToSmooth.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) return;

      // Skip boundary vertices if preserveBoundary is enabled
      if (this.preserveBoundary && this.isBoundaryVertex(vertexId)) {
        newPositions.set(vertexId, new Vector3D(vertex.position.x, vertex.position.y, vertex.position.z));
        return;
      }

      const laplacian = this.calculateLaplacian(vertexId);
      if (laplacian) {
        const scaledLaplacian = new Vector3D(
          laplacian.x * factor,
          laplacian.y * factor,
          laplacian.z * factor
        );
        const newPos = Vector3D.add(vertex.position, scaledLaplacian);
        newPositions.set(vertexId, newPos);
      }
    });

    // Apply new positions
    newPositions.forEach((position, vertexId) => {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex) {
        vertex.position.x = position.x;
        vertex.position.y = position.y;
        vertex.position.z = position.z;
      }
    });
  }

  /**
   * Updates the final positions in smoothingData after all iterations.
   * @param verticesToSmooth - Array of vertex IDs that were smoothed.
   */
  private updateFinalPositions(verticesToSmooth: number[]): void {
    verticesToSmooth.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      const dataEntry = this.smoothingData.find(d => d.vertexId === vertexId);
      if (vertex && dataEntry) {
        dataEntry.newPosition = new Vector3D(vertex.position.x, vertex.position.y, vertex.position.z);
      }
    });
  }

  /**
   * Calculates the Laplacian vector for a vertex.
   * @param vertexId - The vertex ID.
   * @returns The Laplacian vector or null if calculation fails.
   */
  private calculateLaplacian(vertexId: number): Vector3D | null {
    const vertex = this.mesh.getVertex(vertexId);
    if (!vertex) return null;

    const neighbors = this.getVertexNeighbors(vertexId);
    if (neighbors.length === 0) return null;

    // Calculate centroid of neighbors (uniform weights)
    let centroid = new Vector3D(0, 0, 0);
    neighbors.forEach(neighborId => {
      const neighbor = this.mesh.getVertex(neighborId);
      if (neighbor) {
        centroid = Vector3D.add(centroid, neighbor.position);
      }
    });

    centroid = new Vector3D(
      centroid.x / neighbors.length,
      centroid.y / neighbors.length,
      centroid.z / neighbors.length
    );

    // Laplacian is the difference between centroid and current position
    return Vector3D.subtract(centroid, vertex.position);
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
   * Checks if a vertex is on the boundary of the mesh.
   * @param vertexId - The vertex ID.
   * @returns True if the vertex is on the boundary.
   */
  private isBoundaryVertex(vertexId: number): boolean {
    const vertex = this.mesh.getVertex(vertexId);
    if (!vertex) return false;

    // A vertex is on the boundary if any of its edges are boundary edges
    for (const edgeKey of vertex.edges) {
      const edge = this.mesh.edges.get(edgeKey);
      if (edge && edge.faces.size < 2) {
        return true; // This edge has fewer than 2 faces, so it's a boundary edge
      }
    }

    return false;
  }

  /**
   * Gets statistics about the Taubin smoothing operation.
   * @returns Object with smoothing statistics.
   */
  getSmoothingStats(): {
    verticesSmoothed: number;
    boundaryVerticesPreserved: number;
    averageDisplacement: number;
    maxDisplacement: number;
    volumePreservationRatio: number;
  } {
    const boundaryPreserved = this.smoothingData.filter(data => {
      if (!this.preserveBoundary || !this.isBoundaryVertex(data.vertexId)) return false;
      const dx = data.newPosition.x - data.originalPosition.x;
      const dy = data.newPosition.y - data.originalPosition.y;
      const dz = data.newPosition.z - data.originalPosition.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return distance < 0.001;
    }).length;

    const displacements = this.smoothingData.map(data => {
      const dx = data.newPosition.x - data.originalPosition.x;
      const dy = data.newPosition.y - data.originalPosition.y;
      const dz = data.newPosition.z - data.originalPosition.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    });

    const averageDisplacement = displacements.length > 0 
      ? displacements.reduce((sum, d) => sum + d, 0) / displacements.length 
      : 0;

    const maxDisplacement = displacements.length > 0 
      ? Math.max(...displacements) 
      : 0;

    // Estimate volume preservation (simplified)
    const volumePreservationRatio = this.estimateVolumePreservation();

    return {
      verticesSmoothed: this.smoothingData.length,
      boundaryVerticesPreserved: boundaryPreserved,
      averageDisplacement,
      maxDisplacement,
      volumePreservationRatio
    };
  }

  /**
   * Estimates volume preservation ratio (simplified calculation).
   * @returns Ratio of final to original volume (1.0 = perfect preservation).
   */
  private estimateVolumePreservation(): number {
    // This is a simplified estimation based on average vertex displacement
    // A more accurate calculation would require computing actual mesh volume
    const totalDisplacement = this.smoothingData.reduce((sum, data) => {
      const dx = data.newPosition.x - data.originalPosition.x;
      const dy = data.newPosition.y - data.originalPosition.y;
      const dz = data.newPosition.z - data.originalPosition.z;
      return sum + Math.sqrt(dx * dx + dy * dy + dz * dz);
    }, 0);

    const averageDisplacement = totalDisplacement / this.smoothingData.length;
    
    // Heuristic: smaller displacement suggests better volume preservation
    // This is a rough approximation - real volume calculation would be more complex
    return Math.max(0.0, Math.min(1.0, 1.0 - (averageDisplacement * 10)));
  }
} 