import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Edge } from './Edge';

interface EdgeLoopRingState {
  selectedEdgeIds: number[];
  selectionType: 'loop' | 'ring';
  originalSelection: Set<number>;
}

/**
 * Command to select edge loops or rings.
 * Edge Loop: follows connected edges through quad faces.
 * Edge Ring: selects parallel edges across quad strips.
 */
export class SelectEdgeLoopRing implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private startEdgeId: number;
  private selectionType: 'loop' | 'ring';
  private extend: boolean; // Whether to extend current selection or replace it
  
  // Store original state for undo
  private loopRingState: EdgeLoopRingState | null = null;
  
  public readonly description: string;

  /**
   * Creates an instance of SelectEdgeLoopRing command.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param startEdgeId - ID of the edge to start loop/ring from.
   * @param selectionType - Type of selection ('loop' or 'ring').
   * @param extend - Whether to extend current selection.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    startEdgeId: number,
    selectionType: 'loop' | 'ring' = 'loop',
    extend: boolean = false
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.startEdgeId = startEdgeId;
    this.selectionType = selectionType;
    this.extend = extend;
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.loopRingState = null;
    
    const startEdge = this.findEdgeById(this.startEdgeId);
    if (!startEdge) {
      console.warn(`SelectEdgeLoopRing: Edge with ID ${this.startEdgeId} not found.`);
      return;
    }

    // Store original selection
    const originalSelection = new Set(this.selectionManager.getSelectedEdgeIds());

    // Get loop or ring
    const selectedEdges = this.selectionType === 'loop' ? 
      this.getEdgeLoop(startEdge) : this.getEdgeRing(startEdge);

    if (selectedEdges.length === 0) {
      console.warn(`SelectEdgeLoopRing: No ${this.selectionType} found from edge ${this.startEdgeId}.`);
      return;
    }

    // Update selection
    if (!this.extend) {
      this.selectionManager.clearEdgeSelection();
    }

    selectedEdges.forEach(edgeId => {
      this.selectionManager.selectEdge(edgeId, true);
    });

    this.loopRingState = {
      selectedEdgeIds: selectedEdges,
      selectionType: this.selectionType,
      originalSelection
    };
  }

  undo(): void {
    if (!this.loopRingState) return;

    // Clear current selection
    this.selectionManager.clearEdgeSelection();

    // Restore original selection
    this.loopRingState.originalSelection.forEach(edgeId => {
      this.selectionManager.selectEdge(edgeId, true);
    });

    this.loopRingState = null;
  }

  /**
   * Gets an edge loop starting from the given edge.
   * @param startEdge - The edge to start the loop from.
   * @returns Array of edge IDs in the loop.
   */
  private getEdgeLoop(startEdge: Edge): number[] {
    const loopEdges: number[] = [];
    const visitedEdges = new Set<string>();
    
    // Start with the initial edge
    let currentEdge = startEdge;
    
    // Follow the loop in both directions
    const directions = [1, -1];
    
    for (const direction of directions) {
      let edge = currentEdge;
      
      while (edge && !visitedEdges.has(edge.key)) {
        if (direction === 1 || edge === startEdge) {
          loopEdges.push(edge.id);
          visitedEdges.add(edge.key);
        }
        
        // Find next edge in loop
        const nextEdge = this.getNextLoopEdge(edge, visitedEdges);
        if (!nextEdge || nextEdge === startEdge) break;
        
        edge = nextEdge;
      }
    }

    return loopEdges;
  }

  /**
   * Gets an edge ring starting from the given edge.
   * @param startEdge - The edge to start the ring from.
   * @returns Array of edge IDs in the ring.
   */
  private getEdgeRing(startEdge: Edge): number[] {
    const ringEdges: number[] = [startEdge.id];
    const visitedEdges = new Set<string>([startEdge.key]);
    
    // Find parallel edges across quad strips
    const queue = [startEdge];
    
    while (queue.length > 0) {
      const currentEdge = queue.shift()!;
      
      // Find parallel edges through adjacent quads
      const parallelEdges = this.getParallelEdges(currentEdge);
      
      for (const parallelEdge of parallelEdges) {
        if (!visitedEdges.has(parallelEdge.key)) {
          ringEdges.push(parallelEdge.id);
          visitedEdges.add(parallelEdge.key);
          queue.push(parallelEdge);
        }
      }
    }

    return ringEdges;
  }

  /**
   * Finds the next edge in a loop by traversing through quad faces.
   * @param currentEdge - Current edge in the loop.
   * @param visitedEdges - Set of already visited edge keys.
   * @returns Next edge in the loop or null.
   */
  private getNextLoopEdge(currentEdge: Edge, visitedEdges: Set<string>): Edge | null {
    // Look at adjacent faces to find continuation of loop
    for (const faceId of currentEdge.faces) {
      const face = this.mesh.getFace(faceId);
      if (!face || face.vertices.length !== 4) continue; // Only work with quads
      
      const faceEdges = Array.from(face.edges);
      const currentEdgeIndex = faceEdges.findIndex(e => e.key === currentEdge.key);
      
      if (currentEdgeIndex === -1) continue;
      
      // In a quad, the opposite edge continues the loop
      const oppositeEdgeIndex = (currentEdgeIndex + 2) % 4;
      const oppositeEdge = faceEdges[oppositeEdgeIndex];
      
      if (!visitedEdges.has(oppositeEdge.key)) {
        return oppositeEdge;
      }
    }
    
    return null;
  }

  /**
   * Finds parallel edges across quad strips for ring selection.
   * @param currentEdge - Current edge to find parallels for.
   * @returns Array of parallel edges.
   */
  private getParallelEdges(currentEdge: Edge): Edge[] {
    const parallelEdges: Edge[] = [];
    
    // Check both adjacent faces
    for (const faceId of currentEdge.faces) {
      const face = this.mesh.getFace(faceId);
      if (!face || face.vertices.length !== 4) continue; // Only work with quads
      
      const faceEdges = Array.from(face.edges);
      const currentEdgeIndex = faceEdges.findIndex(e => e.key === currentEdge.key);
      
      if (currentEdgeIndex === -1) continue;
      
      // Find adjacent edges (perpendicular to current)
      const adjacentIndices = [
        (currentEdgeIndex + 1) % 4,
        (currentEdgeIndex + 3) % 4
      ];
      
      for (const adjIndex of adjacentIndices) {
        const adjacentEdge = faceEdges[adjIndex];
        
        // Follow this edge to find the parallel edge on the other side
        const parallelEdge = this.findParallelAcrossEdge(adjacentEdge, currentEdge);
        if (parallelEdge) {
          parallelEdges.push(parallelEdge);
        }
      }
    }
    
    return parallelEdges;
  }

  /**
   * Finds the parallel edge across an adjacent edge.
   * @param adjacentEdge - The edge to cross over.
   * @param originalEdge - The original edge we're finding parallels for.
   * @returns Parallel edge or null.
   */
  private findParallelAcrossEdge(adjacentEdge: Edge, originalEdge: Edge): Edge | null {
    // Find the other face that shares the adjacent edge
    for (const faceId of adjacentEdge.faces) {
      // Skip the face we came from
      if (originalEdge.faces.has(faceId)) continue;
      
      const otherFace = this.mesh.getFace(faceId);
      if (!otherFace || otherFace.vertices.length !== 4) continue;
      
      const otherFaceEdges = Array.from(otherFace.edges);
      const adjacentEdgeIndex = otherFaceEdges.findIndex(e => e.key === adjacentEdge.key);
      
      if (adjacentEdgeIndex === -1) continue;
      
      // The parallel edge is opposite to the adjacent edge in this face
      const parallelEdgeIndex = (adjacentEdgeIndex + 2) % 4;
      return otherFaceEdges[parallelEdgeIndex];
    }
    
    return null;
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
    const action = this.extend ? 'Extend' : 'Select';
    return `${action} edge ${this.selectionType} from edge ${this.startEdgeId}`;
  }

  /**
   * Gets selection statistics.
   * @returns Statistics object.
   */
  getSelectionStats(): {
    edgesSelected: number;
    selectionType: 'loop' | 'ring';
    extended: boolean;
  } {
    return {
      edgesSelected: this.loopRingState?.selectedEdgeIds.length || 0,
      selectionType: this.selectionType,
      extended: this.extend
    };
  }

  /**
   * Static factory method to select edge loop.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param startEdgeId - Starting edge ID.
   * @param extend - Whether to extend selection.
   * @returns SelectEdgeLoopRing command instance.
   */
  static selectLoop(
    mesh: Mesh,
    selectionManager: SelectionManager,
    startEdgeId: number,
    extend: boolean = false
  ): SelectEdgeLoopRing {
    return new SelectEdgeLoopRing(mesh, selectionManager, startEdgeId, 'loop', extend);
  }

  /**
   * Static factory method to select edge ring.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param startEdgeId - Starting edge ID.
   * @param extend - Whether to extend selection.
   * @returns SelectEdgeLoopRing command instance.
   */
  static selectRing(
    mesh: Mesh,
    selectionManager: SelectionManager,
    startEdgeId: number,
    extend: boolean = false
  ): SelectEdgeLoopRing {
    return new SelectEdgeLoopRing(mesh, selectionManager, startEdgeId, 'ring', extend);
  }
} 