import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Edge } from './Edge';

interface CollapsedEdgeState {
  originalEdgeKey: string;
  originalV0Id: number;
  originalV1Id: number;
  mergedVertexId: number;
  removedFaceIds: number[];
  updatedFaceIds: number[];
  mergePosition: Vector3D;
}

/**
 * Command to collapse edges by merging their two endpoints into a single vertex.
 * This operation simplifies mesh topology and can be used for mesh reduction.
 */
export class CollapseEdge implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private edgeIds: number[];
  private mergeMode: 'midpoint' | 'first' | 'second' | 'weighted';
  private preserveShape: boolean;
  
  // Store original state for undo
  private collapsedStates: CollapsedEdgeState[] = [];
  private originalSelectedEdges: Set<number>;
  
  public readonly description: string;

  /**
   * Creates an instance of CollapseEdge command.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param mergeMode - How to position the merged vertex.
   * @param preserveShape - Whether to try preserving mesh shape during collapse.
   * @param edgeIds - Optional specific edge IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    mergeMode: 'midpoint' | 'first' | 'second' | 'weighted' = 'midpoint',
    preserveShape: boolean = true,
    edgeIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.mergeMode = mergeMode;
    this.preserveShape = preserveShape;
    
    // Use provided edge IDs or get from selection
    this.edgeIds = edgeIds || Array.from(selectionManager.getSelectedEdgeIds());
    this.originalSelectedEdges = new Set(this.edgeIds);
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.collapsedStates = [];
    
    if (this.edgeIds.length === 0) {
      console.warn('CollapseEdge: No edges selected or specified.');
      return;
    }

    // Process each edge for collapse
    this.edgeIds.forEach(edgeId => {
      const edge = this.findEdgeById(edgeId);
      if (!edge) {
        console.warn(`CollapseEdge: Edge with ID ${edgeId} not found.`);
        return;
      }

      const collapsedState = this.collapseSingleEdge(edge);
      if (collapsedState) {
        this.collapsedStates.push(collapsedState);
        
        // Remove original edge from selection
        this.selectionManager.deselectEdge(edgeId);
        
        // Select the merged vertex
        this.selectionManager.selectVertex(collapsedState.mergedVertexId, true);
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Note: Full undo is complex due to topology changes
    console.warn('CollapseEdge: Undo is not fully implemented. Edge collapse is currently irreversible.');
    
    // Clear stored state
    this.collapsedStates = [];
  }

  /**
   * Collapses a single edge.
   * @param edge - The edge to collapse.
   * @returns Collapsed state or null if failed.
   */
  private collapseSingleEdge(edge: Edge): CollapsedEdgeState | null {
    const originalKey = edge.key;
    const v0 = edge.v0;
    const v1 = edge.v1;

    // Check if collapse would create invalid topology
    if (this.preserveShape && this.wouldCreateInvalidTopology(edge)) {
      console.warn(`CollapseEdge: Collapsing edge ${originalKey} would create invalid topology.`);
      return null;
    }

    // Calculate merge position
    const mergePosition = this.calculateMergePosition(v0, v1);
    
    // Get faces that will be affected
    const affectedFaces = Array.from(edge.faces);
    const removedFaceIds: number[] = [];
    const updatedFaceIds: number[] = [];

    // Create merged vertex
    const mergedVertex = this.mesh.addVertex(
      mergePosition.x,
      mergePosition.y,
      mergePosition.z,
      this.calculateMergedNormal(v0, v1),
      this.calculateMergedUV(v0, v1)
    );

    // Process affected faces
    affectedFaces.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      const faceVertexIds = face.vertices.map(v => v.id);
      const hasV0 = faceVertexIds.includes(v0.id);
      const hasV1 = faceVertexIds.includes(v1.id);

      if (hasV0 && hasV1) {
        // Face uses both vertices of the collapsed edge - remove it
        this.mesh.removeFace(faceId);
        removedFaceIds.push(faceId);
      } else if (hasV0 || hasV1) {
        // Face uses one vertex - update it to use merged vertex
        const updatedVertexIds = faceVertexIds.map(vertexId => {
          if (vertexId === v0.id || vertexId === v1.id) {
            return mergedVertex.id;
          }
          return vertexId;
        });

        // Remove old face and create updated face
        const materialIndex = face.materialIndex;
        this.mesh.removeFace(faceId);
        
        // Check for degenerate faces (same vertex repeated)
        const uniqueVertexIds = [...new Set(updatedVertexIds)];
        if (uniqueVertexIds.length >= 3) {
          const newFace = this.mesh.addFace(uniqueVertexIds, materialIndex ?? undefined);
          updatedFaceIds.push(newFace.id);
        }
      }
    });

    // Remove original vertices and edge
    this.mesh.removeVertex(v0.id);
    this.mesh.removeVertex(v1.id);
    this.mesh.removeEdge(v0.id, v1.id);

    return {
      originalEdgeKey: originalKey,
      originalV0Id: v0.id,
      originalV1Id: v1.id,
      mergedVertexId: mergedVertex.id,
      removedFaceIds,
      updatedFaceIds,
      mergePosition: mergePosition.clone()
    };
  }

  /**
   * Calculates the position for the merged vertex.
   * @param v0 - First vertex.
   * @param v1 - Second vertex.
   * @returns Merge position.
   */
  private calculateMergePosition(v0: any, v1: any): Vector3D {
    switch (this.mergeMode) {
      case 'first':
        return v0.position.clone();
      case 'second':
        return v1.position.clone();
      case 'weighted':
        // Weight based on vertex connectivity (more connected vertex has more influence)
        const weight0 = v0.faces.size + v0.edges.size;
        const weight1 = v1.faces.size + v1.edges.size;
        const totalWeight = weight0 + weight1;
        
        if (totalWeight === 0) {
          return v0.position.add(v1.position).multiplyScalar(0.5);
        }
        
        const factor0 = weight0 / totalWeight;
        const factor1 = weight1 / totalWeight;
        return v0.position.multiplyScalar(factor0).add(v1.position.multiplyScalar(factor1));
      case 'midpoint':
      default:
        return v0.position.add(v1.position).multiplyScalar(0.5);
    }
  }

  /**
   * Calculates merged normal from two vertices.
   * @param v0 - First vertex.
   * @param v1 - Second vertex.
   * @returns Merged normal or undefined.
   */
  private calculateMergedNormal(v0: any, v1: any): Vector3D | undefined {
    if (!v0.normal && !v1.normal) return undefined;
    if (!v0.normal) return v1.normal?.clone();
    if (!v1.normal) return v0.normal?.clone();
    
    return v0.normal.add(v1.normal).normalize();
  }

  /**
   * Calculates merged UV coordinates from two vertices.
   * @param v0 - First vertex.
   * @param v1 - Second vertex.
   * @returns Merged UV or undefined.
   */
  private calculateMergedUV(v0: any, v1: any): { u: number; v: number } | undefined {
    if (!v0.uv && !v1.uv) return undefined;
    if (!v0.uv) return v1.uv ? { ...v1.uv } : undefined;
    if (!v1.uv) return v0.uv ? { ...v0.uv } : undefined;
    
    return {
      u: (v0.uv.u + v1.uv.u) * 0.5,
      v: (v0.uv.v + v1.uv.v) * 0.5
    };
  }

  /**
   * Checks if collapsing this edge would create invalid topology.
   * @param edge - The edge to check.
   * @returns True if collapse would be invalid.
   */
  private wouldCreateInvalidTopology(edge: Edge): boolean {
    const v0 = edge.v0;
    const v1 = edge.v1;

    // Check for triangular faces that would become degenerate
    let triangularFacesUsingBothVertices = 0;
    
    edge.faces.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (face && face.vertices.length === 3) {
        const faceVertexIds = face.vertices.map(v => v.id);
        if (faceVertexIds.includes(v0.id) && faceVertexIds.includes(v1.id)) {
          triangularFacesUsingBothVertices++;
        }
      }
    });

    // If more than 2 triangular faces use both vertices, collapse might be problematic
    if (triangularFacesUsingBothVertices > 2) {
      return true;
    }

    // Check if vertices share other common neighbors (would create duplicate edges)
    const v0Neighbors = new Set<number>();
    const v1Neighbors = new Set<number>();

    v0.edges.forEach(edgeKey => {
      const neighborEdge = this.mesh.edges.get(edgeKey);
      if (neighborEdge) {
        const otherVertex = neighborEdge.v0.id === v0.id ? neighborEdge.v1 : neighborEdge.v0;
        v0Neighbors.add(otherVertex.id);
      }
    });

    v1.edges.forEach(edgeKey => {
      const neighborEdge = this.mesh.edges.get(edgeKey);
      if (neighborEdge) {
        const otherVertex = neighborEdge.v0.id === v1.id ? neighborEdge.v1 : neighborEdge.v0;
        v1Neighbors.add(otherVertex.id);
      }
    });

    // Remove the vertices themselves from their neighbor sets
    v0Neighbors.delete(v1.id);
    v1Neighbors.delete(v0.id);

    // Check for common neighbors (excluding each other)
    for (const neighborId of v0Neighbors) {
      if (v1Neighbors.has(neighborId)) {
        // Common neighbor found - collapse might create duplicate edges
        // This is not always invalid, but requires careful handling
        return false; // Allow for now, but could be made more strict
      }
    }

    return false;
  }

  /**
   * Finds an edge by its ID.
   * @param edgeId - The edge ID to find.
   * @returns The edge or null if not found.
   */
  private findEdgeById(edgeId: number): Edge | null {
    for (const edge of this.mesh.edges.values()) {
      if (edge.id === edgeId) {
        return edge;
      }
    }
    return null;
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const edgeCount = this.edgeIds.length;
    return `Collapse ${edgeCount} edge${edgeCount === 1 ? '' : 's'} (${this.mergeMode} merge)`;
  }

  /**
   * Gets collapse statistics.
   * @returns Statistics object.
   */
  getCollapseStats(): {
    edgesCollapsed: number;
    verticesRemoved: number;
    facesRemoved: number;
    facesUpdated: number;
  } {
    const facesRemoved = this.collapsedStates.reduce((sum, state) => 
      sum + state.removedFaceIds.length, 0);
    const facesUpdated = this.collapsedStates.reduce((sum, state) => 
      sum + state.updatedFaceIds.length, 0);

    return {
      edgesCollapsed: this.collapsedStates.length,
      verticesRemoved: this.collapsedStates.length * 2, // Each collapse removes 2 vertices
      facesRemoved,
      facesUpdated
    };
  }

  /**
   * Static factory method to collapse edges to midpoint.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @returns CollapseEdge command instance.
   */
  static collapseToMidpoint(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): CollapseEdge {
    return new CollapseEdge(mesh, selectionManager, 'midpoint', true);
  }

  /**
   * Static factory method to collapse edges with weighted merge.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @returns CollapseEdge command instance.
   */
  static collapseWeighted(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): CollapseEdge {
    return new CollapseEdge(mesh, selectionManager, 'weighted', true);
  }
} 