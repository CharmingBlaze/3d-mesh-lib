import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

/**
 * Command to select edges by ID or criteria.
 * Supports single edge selection, multiple edge selection, and conditional selection.
 */
export class SelectEdge implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private edgeIds: number[];
  private addToSelection: boolean;
  private selectionCriteria?: (edgeId: number) => boolean;
  
  // Store original selection state for undo
  private originalSelectedEdgeIds: Set<number>;
  private newlySelectedEdgeIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of SelectEdge command.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager to modify.
   * @param edgeIds - Array of edge IDs to select (or empty for criteria-based selection).
   * @param addToSelection - If true, adds to current selection. If false, replaces selection.
   * @param selectionCriteria - Optional function to determine which edges to select.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    edgeIds: number[] = [],
    addToSelection: boolean = false,
    selectionCriteria?: (edgeId: number) => boolean
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.edgeIds = [...edgeIds];
    this.addToSelection = addToSelection;
    this.selectionCriteria = selectionCriteria;
    
    // Store original selection state
    this.originalSelectedEdgeIds = new Set(selectionManager.getSelectedEdgeIds());
    
    if (selectionCriteria) {
      this.description = `Select edges by criteria ${addToSelection ? '(add to selection)' : '(replace selection)'}`;
    } else if (edgeIds.length === 1) {
      this.description = `Select edge ${edgeIds[0]} ${addToSelection ? '(add)' : '(replace)'}`;
    } else if (edgeIds.length > 1) {
      this.description = `Select ${edgeIds.length} edges ${addToSelection ? '(add)' : '(replace)'}`;
    } else {
      this.description = 'Select edges (no targets specified)';
    }
  }

  execute(): void {
    this.newlySelectedEdgeIds.clear();
    
    // Clear current selection if not adding
    if (!this.addToSelection) {
      this.selectionManager.clearEdgeSelection();
    }

    // Select edges based on IDs or criteria
    if (this.selectionCriteria) {
      this.selectByCriteria();
    } else {
      this.selectByIds();
    }

    console.log(`SelectEdge: Selected ${this.newlySelectedEdgeIds.size} edges. Total selection: ${this.selectionManager.getSelectedEdgeIds().size}`);
  }

  undo(): void {
    if (this.addToSelection) {
      // Remove only newly selected edges
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
   * Selects edges by their IDs.
   */
  private selectByIds(): void {
    this.edgeIds.forEach(edgeId => {
      const edge = this.mesh.edges.get(edgeId.toString());
      if (edge) {
        // Only track as newly selected if it wasn't originally selected
        if (!this.originalSelectedEdgeIds.has(edgeId)) {
          this.newlySelectedEdgeIds.add(edgeId);
        }
        this.selectionManager.selectEdge(edgeId, true);
      } else {
        console.warn(`SelectEdge: Edge ${edgeId} not found in mesh.`);
      }
    });
  }

  /**
   * Selects edges based on criteria function.
   */
  private selectByCriteria(): void {
    if (!this.selectionCriteria) return;

    let selectedCount = 0;
    this.mesh.edges.forEach((edge, edgeKey) => {
      if (this.selectionCriteria!(edge.id)) {
        // Only track as newly selected if it wasn't originally selected
        if (!this.originalSelectedEdgeIds.has(edge.id)) {
          this.newlySelectedEdgeIds.add(edge.id);
        }
        this.selectionManager.selectEdge(edge.id, true);
        selectedCount++;
      }
    });

    console.log(`SelectEdge: Applied criteria and selected ${selectedCount} edges.`);
  }

  /**
   * Creates a SelectEdge command to select boundary edges.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectEdge command instance.
   */
  static selectBoundaryEdges(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectEdge {
    const criteria = (edgeId: number): boolean => {
      const edge = mesh.edges.get(edgeId.toString());
      return edge ? edge.faces.size < 2 : false;
    };

    return new SelectEdge(mesh, selectionManager, [], addToSelection, criteria);
  }

  /**
   * Creates a SelectEdge command to select edges by length.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param minLength - Minimum edge length.
   * @param maxLength - Maximum edge length.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectEdge command instance.
   */
  static selectByLength(
    mesh: Mesh,
    selectionManager: SelectionManager,
    minLength: number,
    maxLength: number,
    addToSelection: boolean = false
  ): SelectEdge {
    const criteria = (edgeId: number): boolean => {
      const edge = mesh.edges.get(edgeId.toString());
      if (!edge) return false;
      
      const v0 = edge.v0.position;
      const v1 = edge.v1.position;
      const dx = v1.x - v0.x;
      const dy = v1.y - v0.y;
      const dz = v1.z - v0.z;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      return length >= minLength && length <= maxLength;
    };

    return new SelectEdge(mesh, selectionManager, [], addToSelection, criteria);
  }

  /**
   * Creates a SelectEdge command to select all edges.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @returns SelectEdge command instance.
   */
  static selectAll(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): SelectEdge {
    const allEdgeIds = Array.from(mesh.edges.values()).map(edge => edge.id);
    return new SelectEdge(mesh, selectionManager, allEdgeIds, false);
  }

  /**
   * Creates a SelectEdge command to select edges connected to specific vertices.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param vertexIds - Array of vertex IDs.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectEdge command instance.
   */
  static selectByVertices(
    mesh: Mesh,
    selectionManager: SelectionManager,
    vertexIds: number[],
    addToSelection: boolean = false
  ): SelectEdge {
    const vertexSet = new Set(vertexIds);
    const criteria = (edgeId: number): boolean => {
      const edge = mesh.edges.get(edgeId.toString());
      return edge ? (vertexSet.has(edge.v0.id) || vertexSet.has(edge.v1.id)) : false;
    };

    return new SelectEdge(mesh, selectionManager, [], addToSelection, criteria);
  }
} 