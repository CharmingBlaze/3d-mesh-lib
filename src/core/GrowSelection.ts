import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

type SelectionType = 'vertices' | 'edges' | 'faces';

/**
 * Command to grow the current selection by including neighboring elements.
 * Can grow vertex, edge, or face selections.
 */
export class GrowSelection implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private selectionType: SelectionType;
  private iterations: number;
  
  // Store original state for undo
  private originalVertexIds: Set<number>;
  private originalEdgeIds: Set<number>;
  private originalFaceIds: Set<number>;
  
  // Store newly added elements
  private newlySelectedVertexIds: Set<number> = new Set();
  private newlySelectedEdgeIds: Set<number> = new Set();
  private newlySelectedFaceIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of GrowSelection command.
   * @param mesh - The mesh containing the elements.
   * @param selectionManager - The selection manager to modify.
   * @param selectionType - The type of selection to grow ('vertices', 'edges', or 'faces').
   * @param iterations - Number of growth iterations (default: 1).
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
    
    // Store original selection state
    this.originalVertexIds = new Set(selectionManager.getSelectedVertexIds());
    this.originalEdgeIds = new Set(selectionManager.getSelectedEdgeIds());
    this.originalFaceIds = new Set(selectionManager.getSelectedFaceIds());
    
    this.description = `Grow ${selectionType} selection ${iterations} iteration${iterations === 1 ? '' : 's'}`;
  }

  execute(): void {
    // Clear newly selected sets
    this.newlySelectedVertexIds.clear();
    this.newlySelectedEdgeIds.clear();
    this.newlySelectedFaceIds.clear();

    for (let i = 0; i < this.iterations; i++) {
      switch (this.selectionType) {
        case 'vertices':
          this.growVertexSelection();
          break;
        case 'edges':
          this.growEdgeSelection();
          break;
        case 'faces':
          this.growFaceSelection();
          break;
      }
    }
  }

  undo(): void {
    // Remove newly selected elements
    this.newlySelectedVertexIds.forEach(id => this.selectionManager.deselectVertex(id));
    this.newlySelectedEdgeIds.forEach(id => this.selectionManager.deselectEdge(id));
    this.newlySelectedFaceIds.forEach(id => this.selectionManager.deselectFace(id));
    
    // Clear the newly selected sets
    this.newlySelectedVertexIds.clear();
    this.newlySelectedEdgeIds.clear();
    this.newlySelectedFaceIds.clear();
  }

  /**
   * Grows vertex selection to include vertices connected by edges.
   */
  private growVertexSelection(): void {
    const currentSelection = new Set(this.selectionManager.getSelectedVertexIds());
    const toAdd = new Set<number>();

    currentSelection.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) return;

      // Find all vertices connected by edges
      vertex.edges.forEach(edgeKey => {
        const edge = this.mesh.edges.get(edgeKey);
        if (!edge) return;

        // Add both vertices of the edge
        if (!currentSelection.has(edge.v0.id)) {
          toAdd.add(edge.v0.id);
        }
        if (!currentSelection.has(edge.v1.id)) {
          toAdd.add(edge.v1.id);
        }
      });
    });

    // Add new vertices to selection
    toAdd.forEach(vertexId => {
      this.selectionManager.selectVertex(vertexId, true);
      this.newlySelectedVertexIds.add(vertexId);
    });
  }

  /**
   * Grows edge selection to include edges sharing vertices with selected edges.
   */
  private growEdgeSelection(): void {
    const currentSelection = new Set(this.selectionManager.getSelectedEdgeIds());
    const toAdd = new Set<number>();

    currentSelection.forEach(edgeId => {
      const edge = this.mesh.edges.get(edgeId.toString()); // Edge IDs might be stored as strings
      if (!edge) return;

      // Find all edges connected to the vertices of this edge
      [edge.v0, edge.v1].forEach(vertex => {
        vertex.edges.forEach(connectedEdgeKey => {
          const connectedEdge = this.mesh.edges.get(connectedEdgeKey);
          if (connectedEdge && !currentSelection.has(connectedEdge.id)) {
            toAdd.add(connectedEdge.id);
          }
        });
      });
    });

    // Add new edges to selection
    toAdd.forEach(edgeId => {
      this.selectionManager.selectEdge(edgeId, true);
      this.newlySelectedEdgeIds.add(edgeId);
    });
  }

  /**
   * Grows face selection to include faces sharing edges with selected faces.
   */
  private growFaceSelection(): void {
    const currentSelection = new Set(this.selectionManager.getSelectedFaceIds());
    const toAdd = new Set<number>();

    currentSelection.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      // Find all faces that share an edge with this face
      face.edges.forEach(edge => {
        edge.faces.forEach(neighborFaceId => {
          if (neighborFaceId !== faceId && !currentSelection.has(neighborFaceId)) {
            toAdd.add(neighborFaceId);
          }
        });
      });
    });

    // Add new faces to selection
    toAdd.forEach(faceId => {
      this.selectionManager.selectFace(faceId, true);
      this.newlySelectedFaceIds.add(faceId);
    });
  }
} 