import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

export type SelectionMode = 'all' | 'vertices' | 'edges' | 'faces';

export interface ObjectSelectionCriteria {
  mode?: SelectionMode;                // What components to select
  clearOthers?: boolean;               // Clear other component types when selecting
}

/**
 * Command to select entire objects or all components of specific types.
 * This is useful for selecting everything in a mesh or all of a specific component type.
 */
export class SelectObject implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private mode: SelectionMode;
  private clearOthers: boolean;
  private addToSelection: boolean;
  
  // Store original selection state for undo
  private originalSelectedVertexIds: Set<number>;
  private originalSelectedEdgeIds: Set<number>;
  private originalSelectedFaceIds: Set<number>;
  
  // Store newly selected elements
  private newlySelectedVertexIds: Set<number> = new Set();
  private newlySelectedEdgeIds: Set<number> = new Set();
  private newlySelectedFaceIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of SelectObject command.
   * @param mesh - The mesh containing the objects/components.
   * @param selectionManager - The selection manager to modify.
   * @param mode - What type of components to select ('all', 'vertices', 'edges', 'faces').
   * @param addToSelection - If true, adds to current selection. If false, replaces selection.
   * @param clearOthers - If true, clears selection of other component types.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    mode: SelectionMode = 'all',
    addToSelection: boolean = false,
    clearOthers: boolean = false
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.mode = mode;
    this.addToSelection = addToSelection;
    this.clearOthers = clearOthers;
    
    // Store original selection state
    this.originalSelectedVertexIds = new Set(selectionManager.getSelectedVertexIds());
    this.originalSelectedEdgeIds = new Set(selectionManager.getSelectedEdgeIds());
    this.originalSelectedFaceIds = new Set(selectionManager.getSelectedFaceIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    // Clear newly selected sets
    this.newlySelectedVertexIds.clear();
    this.newlySelectedEdgeIds.clear();
    this.newlySelectedFaceIds.clear();

    // Clear other component types if requested
    if (this.clearOthers) {
      if (this.mode !== 'vertices') {
        this.selectionManager.clearVertexSelection();
      }
      if (this.mode !== 'edges') {
        this.selectionManager.clearEdgeSelection();
      }
      if (this.mode !== 'faces') {
        this.selectionManager.clearFaceSelection();
      }
    }

    // Clear current selection if not adding
    if (!this.addToSelection) {
      if (this.mode === 'all' || this.mode === 'vertices') {
        this.selectionManager.clearVertexSelection();
      }
      if (this.mode === 'all' || this.mode === 'edges') {
        this.selectionManager.clearEdgeSelection();
      }
      if (this.mode === 'all' || this.mode === 'faces') {
        this.selectionManager.clearFaceSelection();
      }
    }

    // Select vertices
    if (this.mode === 'all' || this.mode === 'vertices') {
      this.mesh.vertices.forEach((vertex, vertexId) => {
        if (!this.originalSelectedVertexIds.has(vertexId) || !this.addToSelection) {
          this.selectionManager.selectVertex(vertexId, true);
          if (!this.originalSelectedVertexIds.has(vertexId)) {
            this.newlySelectedVertexIds.add(vertexId);
          }
        }
      });
    }

    // Select edges
    if (this.mode === 'all' || this.mode === 'edges') {
      this.mesh.edges.forEach((edge, edgeKey) => {
        const edgeId = edge.id;
        if (!this.originalSelectedEdgeIds.has(edgeId) || !this.addToSelection) {
          this.selectionManager.selectEdge(edgeId, true);
          if (!this.originalSelectedEdgeIds.has(edgeId)) {
            this.newlySelectedEdgeIds.add(edgeId);
          }
        }
      });
    }

    // Select faces
    if (this.mode === 'all' || this.mode === 'faces') {
      this.mesh.faces.forEach((face, faceId) => {
        if (!this.originalSelectedFaceIds.has(faceId) || !this.addToSelection) {
          this.selectionManager.selectFace(faceId, true);
          if (!this.originalSelectedFaceIds.has(faceId)) {
            this.newlySelectedFaceIds.add(faceId);
          }
        }
      });
    }
  }

  undo(): void {
    // Remove newly selected elements
    this.newlySelectedVertexIds.forEach(vertexId => {
      this.selectionManager.deselectVertex(vertexId);
    });
    this.newlySelectedEdgeIds.forEach(edgeId => {
      this.selectionManager.deselectEdge(edgeId);
    });
    this.newlySelectedFaceIds.forEach(faceId => {
      this.selectionManager.deselectFace(faceId);
    });

    if (!this.addToSelection) {
      // Restore original selection if we replaced it
      if (this.mode === 'all' || this.mode === 'vertices') {
        this.selectionManager.clearVertexSelection();
        this.originalSelectedVertexIds.forEach(vertexId => {
          this.selectionManager.selectVertex(vertexId, true);
        });
      }
      if (this.mode === 'all' || this.mode === 'edges') {
        this.selectionManager.clearEdgeSelection();
        this.originalSelectedEdgeIds.forEach(edgeId => {
          this.selectionManager.selectEdge(edgeId, true);
        });
      }
      if (this.mode === 'all' || this.mode === 'faces') {
        this.selectionManager.clearFaceSelection();
        this.originalSelectedFaceIds.forEach(faceId => {
          this.selectionManager.selectFace(faceId, true);
        });
      }
    }

    // Clear newly selected sets
    this.newlySelectedVertexIds.clear();
    this.newlySelectedEdgeIds.clear();
    this.newlySelectedFaceIds.clear();
  }

  /**
   * Builds a description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    let desc: string;
    
    switch (this.mode) {
      case 'vertices':
        desc = 'Select all vertices';
        break;
      case 'edges':
        desc = 'Select all edges';
        break;
      case 'faces':
        desc = 'Select all faces';
        break;
      case 'all':
      default:
        desc = 'Select entire object';
        break;
    }
    
    if (this.addToSelection) {
      desc += ' (add)';
    } else {
      desc += ' (replace)';
    }
    
    if (this.clearOthers) {
      desc += ' (clear others)';
    }
    
    return desc;
  }

  /**
   * Gets statistics about the selection operation.
   * @returns Object containing counts of selected components.
   */
  getSelectionStats(): {
    verticesSelected: number;
    edgesSelected: number;
    facesSelected: number;
    totalComponents: number;
  } {
    const verticesSelected = (this.mode === 'all' || this.mode === 'vertices') ? this.mesh.vertices.size : 0;
    const edgesSelected = (this.mode === 'all' || this.mode === 'edges') ? this.mesh.edges.size : 0;
    const facesSelected = (this.mode === 'all' || this.mode === 'faces') ? this.mesh.faces.size : 0;
    
    return {
      verticesSelected,
      edgesSelected,
      facesSelected,
      totalComponents: verticesSelected + edgesSelected + facesSelected
    };
  }

  /**
   * Static factory method to select all vertices.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectObject command instance.
   */
  static selectAllVertices(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectObject {
    return new SelectObject(mesh, selectionManager, 'vertices', addToSelection);
  }

  /**
   * Static factory method to select all edges.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectObject command instance.
   */
  static selectAllEdges(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectObject {
    return new SelectObject(mesh, selectionManager, 'edges', addToSelection);
  }

  /**
   * Static factory method to select all faces.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectObject command instance.
   */
  static selectAllFaces(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectObject {
    return new SelectObject(mesh, selectionManager, 'faces', addToSelection);
  }

  /**
   * Static factory method to select entire object (all components).
   * @param mesh - The mesh to select entirely.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectObject command instance.
   */
  static selectEntireObject(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectObject {
    return new SelectObject(mesh, selectionManager, 'all', addToSelection);
  }

  /**
   * Static factory method to select specific component type and clear others.
   * @param mesh - The mesh containing components.
   * @param selectionManager - The selection manager.
   * @param mode - The type of components to select.
   * @returns SelectObject command instance.
   */
  static selectComponentTypeOnly(
    mesh: Mesh,
    selectionManager: SelectionManager,
    mode: Exclude<SelectionMode, 'all'>
  ): SelectObject {
    return new SelectObject(mesh, selectionManager, mode, false, true);
  }
} 