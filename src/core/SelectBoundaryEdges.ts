import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

/**
 * Command to select all boundary edges in the mesh.
 * Boundary edges are edges that are connected to only one face (or no faces),
 * indicating holes or open boundaries in the mesh.
 */
export class SelectBoundaryEdges implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private addToSelection: boolean;
  
  // Store original state for undo
  private originalSelectedEdgeIds: Set<number>;
  private newlySelectedEdgeIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of SelectBoundaryEdges command.
   * @param mesh - The mesh to analyze for boundary edges.
   * @param selectionManager - The selection manager to modify.
   * @param addToSelection - If true, adds to current selection. If false, replaces current selection.
   */
  constructor(mesh: Mesh, selectionManager: SelectionManager, addToSelection: boolean = false) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.addToSelection = addToSelection;
    
    // Store original selection state
    this.originalSelectedEdgeIds = new Set(selectionManager.getSelectedEdgeIds());
    
    this.description = addToSelection 
      ? 'Add boundary edges to selection' 
      : 'Select all boundary edges';
  }

  execute(): void {
    this.newlySelectedEdgeIds.clear();
    
    // Clear current edge selection if not adding to selection
    if (!this.addToSelection) {
      this.selectionManager.clearEdgeSelection();
    }

    // Find all boundary edges
    const boundaryEdges = this.findBoundaryEdges();
    
    // Select the boundary edges
    boundaryEdges.forEach(edgeId => {
      // Only track as newly selected if it wasn't originally selected
      if (!this.originalSelectedEdgeIds.has(edgeId)) {
        this.newlySelectedEdgeIds.add(edgeId);
      }
      this.selectionManager.selectEdge(edgeId, true);
    });

    console.log(`SelectBoundaryEdges: Found and selected ${boundaryEdges.length} boundary edge${boundaryEdges.length === 1 ? '' : 's'}`);
  }

  undo(): void {
    if (this.addToSelection) {
      // Remove only newly selected boundary edges
      this.newlySelectedEdgeIds.forEach(edgeId => {
        this.selectionManager.deselectEdge(edgeId);
      });
    } else {
      // Restore original selection completely
      this.selectionManager.clearEdgeSelection();
      this.originalSelectedEdgeIds.forEach(edgeId => {
        this.selectionManager.selectEdge(edgeId, true);
      });
    }
    
    this.newlySelectedEdgeIds.clear();
  }

  /**
   * Finds all boundary edges in the mesh.
   * @returns Array of edge IDs that are boundary edges.
   */
  private findBoundaryEdges(): number[] {
    const boundaryEdgeIds: number[] = [];

    this.mesh.edges.forEach((edge, edgeKey) => {
      // An edge is a boundary edge if it's connected to fewer than 2 faces
      if (edge.faces.size < 2) {
        boundaryEdgeIds.push(edge.id);
      }
    });

    return boundaryEdgeIds;
  }

  /**
   * Gets information about the boundary edges for analysis.
   * @returns Object with boundary edge statistics.
   */
  getBoundaryInfo(): {
    totalEdges: number;
    boundaryEdges: number;
    manifoldEdges: number;
    nonManifoldEdges: number;
    boundaryLoops: number;
  } {
    let boundaryCount = 0;
    let manifoldCount = 0;
    let nonManifoldCount = 0;

    this.mesh.edges.forEach(edge => {
      if (edge.faces.size === 1) {
        boundaryCount++;
      } else if (edge.faces.size === 2) {
        manifoldCount++;
      } else {
        nonManifoldCount++;
      }
    });

    // Estimate boundary loops (this is a simplified estimate)
    const boundaryLoops = this.estimateBoundaryLoops();

    return {
      totalEdges: this.mesh.edges.size,
      boundaryEdges: boundaryCount,
      manifoldEdges: manifoldCount,
      nonManifoldEdges: nonManifoldCount,
      boundaryLoops
    };
  }

  /**
   * Estimates the number of boundary loops by analyzing connectivity.
   * This is a simplified implementation.
   */
  private estimateBoundaryLoops(): number {
    const boundaryEdges = this.findBoundaryEdges();
    const visited = new Set<number>();
    let loops = 0;

    boundaryEdges.forEach(edgeId => {
      if (visited.has(edgeId)) return;

      // Start a new loop traversal
      const loopEdges = this.traceBoundaryLoop(edgeId, visited);
      if (loopEdges.length > 2) { // Valid loop needs at least 3 edges
        loops++;
      }
    });

    return loops;
  }

  /**
   * Traces a boundary loop starting from a given edge.
   * @param startEdgeId - The edge to start tracing from.
   * @param visited - Set of already visited edge IDs.
   * @returns Array of edge IDs forming the loop.
   */
  private traceBoundaryLoop(startEdgeId: number, visited: Set<number>): number[] {
    const loop: number[] = [];
    const queue = [startEdgeId];
    
    while (queue.length > 0) {
      const currentEdgeId = queue.shift()!;
      if (visited.has(currentEdgeId)) continue;
      
      visited.add(currentEdgeId);
      loop.push(currentEdgeId);
      
      const edge = this.mesh.edges.get(currentEdgeId.toString());
      if (!edge || edge.faces.size >= 2) continue;
      
      // Find connected boundary edges through shared vertices
      [edge.v0, edge.v1].forEach(vertex => {
        vertex.edges.forEach(connectedEdgeKey => {
          const connectedEdge = this.mesh.edges.get(connectedEdgeKey);
          if (connectedEdge && 
              connectedEdge.id !== currentEdgeId && 
              connectedEdge.faces.size < 2 && 
              !visited.has(connectedEdge.id)) {
            queue.push(connectedEdge.id);
          }
        });
      });
    }
    
    return loop;
  }
} 