import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

type SelectionType = 'vertices' | 'edges' | 'faces' | 'all';

/**
 * Command to invert the current selection.
 * Selects all unselected elements and deselects all selected elements.
 */
export class InvertSelection implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private selectionType: SelectionType;
  
  // Store original state for undo
  private originalVertexIds: Set<number>;
  private originalEdgeIds: Set<number>;
  private originalFaceIds: Set<number>;
  
  public readonly description: string;

  /**
   * Creates an instance of InvertSelection command.
   * @param mesh - The mesh containing the elements.
   * @param selectionManager - The selection manager to modify.
   * @param selectionType - The type of selection to invert ('vertices', 'edges', 'faces', or 'all').
   */
  constructor(
    mesh: Mesh, 
    selectionManager: SelectionManager, 
    selectionType: SelectionType = 'all'
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.selectionType = selectionType;
    
    // Store original selection state
    this.originalVertexIds = new Set(selectionManager.getSelectedVertexIds());
    this.originalEdgeIds = new Set(selectionManager.getSelectedEdgeIds());
    this.originalFaceIds = new Set(selectionManager.getSelectedFaceIds());
    
    this.description = `Invert ${selectionType} selection`;
  }

  execute(): void {
    switch (this.selectionType) {
      case 'vertices':
        this.invertVertexSelection();
        break;
      case 'edges':
        this.invertEdgeSelection();
        break;
      case 'faces':
        this.invertFaceSelection();
        break;
      case 'all':
        this.invertVertexSelection();
        this.invertEdgeSelection();
        this.invertFaceSelection();
        break;
    }
  }

  undo(): void {
    // Restore original selection state
    if (this.selectionType === 'vertices' || this.selectionType === 'all') {
      this.selectionManager.clearVertexSelection();
      this.originalVertexIds.forEach(id => {
        this.selectionManager.selectVertex(id, true);
      });
    }

    if (this.selectionType === 'edges' || this.selectionType === 'all') {
      this.selectionManager.clearEdgeSelection();
      this.originalEdgeIds.forEach(id => {
        this.selectionManager.selectEdge(id, true);
      });
    }

    if (this.selectionType === 'faces' || this.selectionType === 'all') {
      this.selectionManager.clearFaceSelection();
      this.originalFaceIds.forEach(id => {
        this.selectionManager.selectFace(id, true);
      });
    }
  }

  /**
   * Inverts vertex selection.
   */
  private invertVertexSelection(): void {
    const currentlySelected = new Set(this.selectionManager.getSelectedVertexIds());
    
    // Clear current selection
    this.selectionManager.clearVertexSelection();
    
    // Select all unselected vertices
    this.mesh.vertices.forEach((vertex, vertexId) => {
      if (!currentlySelected.has(vertexId)) {
        this.selectionManager.selectVertex(vertexId, true);
      }
    });
  }

  /**
   * Inverts edge selection.
   */
  private invertEdgeSelection(): void {
    const currentlySelected = new Set(this.selectionManager.getSelectedEdgeIds());
    
    // Clear current selection
    this.selectionManager.clearEdgeSelection();
    
    // Select all unselected edges
    this.mesh.edges.forEach((edge, edgeKey) => {
      if (!currentlySelected.has(edge.id)) {
        this.selectionManager.selectEdge(edge.id, true);
      }
    });
  }

  /**
   * Inverts face selection.
   */
  private invertFaceSelection(): void {
    const currentlySelected = new Set(this.selectionManager.getSelectedFaceIds());
    
    // Clear current selection
    this.selectionManager.clearFaceSelection();
    
    // Select all unselected faces
    this.mesh.faces.forEach((face, faceId) => {
      if (!currentlySelected.has(faceId)) {
        this.selectionManager.selectFace(faceId, true);
      }
    });
  }

  /**
   * Gets statistics about the selection inversion.
   * @returns Object with selection statistics.
   */
  getInversionStats(): {
    vertices: { before: number; after: number; total: number };
    edges: { before: number; after: number; total: number };
    faces: { before: number; after: number; total: number };
  } {
    const currentVertices = this.selectionManager.getSelectedVertexIds().size;
    const currentEdges = this.selectionManager.getSelectedEdgeIds().size;
    const currentFaces = this.selectionManager.getSelectedFaceIds().size;

    return {
      vertices: {
        before: this.originalVertexIds.size,
        after: currentVertices,
        total: this.mesh.vertices.size
      },
      edges: {
        before: this.originalEdgeIds.size,
        after: currentEdges,
        total: this.mesh.edges.size
      },
      faces: {
        before: this.originalFaceIds.size,
        after: currentFaces,
        total: this.mesh.faces.size
      }
    };
  }
} 