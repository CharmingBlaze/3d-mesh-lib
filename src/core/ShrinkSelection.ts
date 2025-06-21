import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

type SelectionType = 'vertices' | 'edges' | 'faces';

/**
 * Command to shrink the current selection by removing elements on the boundary of the selection.
 * This is the opposite of GrowSelection.
 */
export class ShrinkSelection implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private selectionType: SelectionType;
  private iterations: number;
  
  // Store elements to remove for undo
  private removedVertexIds: Set<number> = new Set();
  private removedEdgeIds: Set<number> = new Set();
  private removedFaceIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of ShrinkSelection command.
   * @param mesh - The mesh containing the elements.
   * @param selectionManager - The selection manager to modify.
   * @param selectionType - The type of selection to shrink ('vertices', 'edges', or 'faces').
   * @param iterations - Number of shrink iterations (default: 1).
   */
  constructor(
    mesh: Mesh, 
    selectionManager: SelectionManager, 
    selectionType: SelectionType = 'faces',
    iterations: number = 1
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.selectionType = selectionType;
    this.iterations = Math.max(1, iterations);
    
    this.description = `Shrink ${selectionType} selection ${iterations} iteration${iterations === 1 ? '' : 's'}`;
  }

  execute(): void {
    // Clear removed sets
    this.removedVertexIds.clear();
    this.removedEdgeIds.clear();
    this.removedFaceIds.clear();

    for (let i = 0; i < this.iterations; i++) {
      switch (this.selectionType) {
        case 'vertices':
          this.shrinkVertexSelection();
          break;
        case 'edges':
          this.shrinkEdgeSelection();
          break;
        case 'faces':
          this.shrinkFaceSelection();
          break;
      }
    }
  }

  undo(): void {
    // Restore removed elements to selection
    this.removedVertexIds.forEach(id => this.selectionManager.selectVertex(id, true));
    this.removedEdgeIds.forEach(id => this.selectionManager.selectEdge(id, true));
    this.removedFaceIds.forEach(id => this.selectionManager.selectFace(id, true));
    
    // Clear the removed sets
    this.removedVertexIds.clear();
    this.removedEdgeIds.clear();
    this.removedFaceIds.clear();
  }

  /**
   * Shrinks vertex selection by removing vertices that have unselected neighbors.
   */
  private shrinkVertexSelection(): void {
    const currentSelection = new Set(this.selectionManager.getSelectedVertexIds());
    const toRemove = new Set<number>();

    currentSelection.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) return;

      // Check if this vertex has any unselected neighbors
      let hasUnselectedNeighbor = false;
      vertex.edges.forEach(edgeKey => {
        const edge = this.mesh.edges.get(edgeKey);
        if (!edge) return;

        // Check both vertices of the edge
        const otherVertex = (edge.v0.id === vertexId) ? edge.v1 : edge.v0;
        if (!currentSelection.has(otherVertex.id)) {
          hasUnselectedNeighbor = true;
        }
      });

      // If this vertex is on the boundary of the selection, mark it for removal
      if (hasUnselectedNeighbor) {
        toRemove.add(vertexId);
      }
    });

    // Remove boundary vertices from selection
    toRemove.forEach(vertexId => {
      this.selectionManager.deselectVertex(vertexId);
      this.removedVertexIds.add(vertexId);
    });
  }

  /**
   * Shrinks edge selection by removing edges that have unselected neighboring edges.
   */
  private shrinkEdgeSelection(): void {
    const currentSelection = new Set(this.selectionManager.getSelectedEdgeIds());
    const toRemove = new Set<number>();

    currentSelection.forEach(edgeId => {
      const edge = this.mesh.edges.get(edgeId.toString());
      if (!edge) return;

      // Check if this edge has any unselected neighboring edges
      let hasUnselectedNeighbor = false;
      [edge.v0, edge.v1].forEach(vertex => {
        vertex.edges.forEach(connectedEdgeKey => {
          const connectedEdge = this.mesh.edges.get(connectedEdgeKey);
          if (connectedEdge && 
              connectedEdge.id !== edgeId && 
              !currentSelection.has(connectedEdge.id)) {
            hasUnselectedNeighbor = true;
          }
        });
      });

      // If this edge is on the boundary of the selection, mark it for removal
      if (hasUnselectedNeighbor) {
        toRemove.add(edgeId);
      }
    });

    // Remove boundary edges from selection
    toRemove.forEach(edgeId => {
      this.selectionManager.deselectEdge(edgeId);
      this.removedEdgeIds.add(edgeId);
    });
  }

  /**
   * Shrinks face selection by removing faces that have unselected neighboring faces.
   */
  private shrinkFaceSelection(): void {
    const currentSelection = new Set(this.selectionManager.getSelectedFaceIds());
    const toRemove = new Set<number>();

    currentSelection.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      // Check if this face has any unselected neighboring faces
      let hasUnselectedNeighbor = false;
      face.edges.forEach(edge => {
        edge.faces.forEach(neighborFaceId => {
          if (neighborFaceId !== faceId && !currentSelection.has(neighborFaceId)) {
            hasUnselectedNeighbor = true;
          }
        });
      });

      // If this face is on the boundary of the selection, mark it for removal
      if (hasUnselectedNeighbor) {
        toRemove.add(faceId);
      }
    });

    // Remove boundary faces from selection
    toRemove.forEach(faceId => {
      this.selectionManager.deselectFace(faceId);
      this.removedFaceIds.add(faceId);
    });
  }
} 