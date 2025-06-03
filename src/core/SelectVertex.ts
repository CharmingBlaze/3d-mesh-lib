import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

/**
 * Command to select vertices by ID or criteria.
 * Supports single vertex selection, multiple vertex selection, and conditional selection.
 */
export class SelectVertex implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private vertexIds: number[];
  private addToSelection: boolean;
  private selectionCriteria?: (vertexId: number) => boolean;
  
  // Store original selection state for undo
  private originalSelectedVertexIds: Set<number>;
  private newlySelectedVertexIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of SelectVertex command.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager to modify.
   * @param vertexIds - Array of vertex IDs to select (or empty for criteria-based selection).
   * @param addToSelection - If true, adds to current selection. If false, replaces selection.
   * @param selectionCriteria - Optional function to determine which vertices to select.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    vertexIds: number[] = [],
    addToSelection: boolean = false,
    selectionCriteria?: (vertexId: number) => boolean
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.vertexIds = [...vertexIds];
    this.addToSelection = addToSelection;
    this.selectionCriteria = selectionCriteria;
    
    // Store original selection state
    this.originalSelectedVertexIds = new Set(selectionManager.getSelectedVertexIds());
    
    if (selectionCriteria) {
      this.description = `Select vertices by criteria ${addToSelection ? '(add to selection)' : '(replace selection)'}`;
    } else if (vertexIds.length === 1) {
      this.description = `Select vertex ${vertexIds[0]} ${addToSelection ? '(add)' : '(replace)'}`;
    } else if (vertexIds.length > 1) {
      this.description = `Select ${vertexIds.length} vertices ${addToSelection ? '(add)' : '(replace)'}`;
    } else {
      this.description = 'Select vertices (no targets specified)';
    }
  }

  execute(): void {
    this.newlySelectedVertexIds.clear();
    
    // Clear current selection if not adding
    if (!this.addToSelection) {
      this.selectionManager.clearVertexSelection();
    }

    // Select vertices based on IDs or criteria
    if (this.selectionCriteria) {
      this.selectByCriteria();
    } else {
      this.selectByIds();
    }

    console.log(`SelectVertex: Selected ${this.newlySelectedVertexIds.size} vertices. Total selection: ${this.selectionManager.getSelectedVertexIds().size}`);
  }

  undo(): void {
    if (this.addToSelection) {
      // Remove only newly selected vertices
      this.newlySelectedVertexIds.forEach(vertexId => {
        this.selectionManager.deselectVertex(vertexId);
      });
    } else {
      // Restore original selection completely
      this.selectionManager.clearVertexSelection();
      this.originalSelectedVertexIds.forEach(vertexId => {
        this.selectionManager.selectVertex(vertexId, true);
      });
    }
    
    this.newlySelectedVertexIds.clear();
  }

  /**
   * Selects vertices by their IDs.
   */
  private selectByIds(): void {
    this.vertexIds.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex) {
        // Only track as newly selected if it wasn't originally selected
        if (!this.originalSelectedVertexIds.has(vertexId)) {
          this.newlySelectedVertexIds.add(vertexId);
        }
        this.selectionManager.selectVertex(vertexId, true);
      } else {
        console.warn(`SelectVertex: Vertex ${vertexId} not found in mesh.`);
      }
    });
  }

  /**
   * Selects vertices based on criteria function.
   */
  private selectByCriteria(): void {
    if (!this.selectionCriteria) return;

    let selectedCount = 0;
    this.mesh.vertices.forEach((vertex, vertexId) => {
      if (this.selectionCriteria!(vertexId)) {
        // Only track as newly selected if it wasn't originally selected
        if (!this.originalSelectedVertexIds.has(vertexId)) {
          this.newlySelectedVertexIds.add(vertexId);
        }
        this.selectionManager.selectVertex(vertexId, true);
        selectedCount++;
      }
    });

    console.log(`SelectVertex: Applied criteria and selected ${selectedCount} vertices.`);
  }

  /**
   * Creates a SelectVertex command to select vertices by position.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param minPosition - Minimum position bounds.
   * @param maxPosition - Maximum position bounds.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectVertex command instance.
   */
  static selectByPosition(
    mesh: Mesh,
    selectionManager: SelectionManager,
    minPosition: { x: number; y: number; z: number },
    maxPosition: { x: number; y: number; z: number },
    addToSelection: boolean = false
  ): SelectVertex {
    const criteria = (vertexId: number): boolean => {
      const vertex = mesh.getVertex(vertexId);
      if (!vertex) return false;
      
      const pos = vertex.position;
      return pos.x >= minPosition.x && pos.x <= maxPosition.x &&
             pos.y >= minPosition.y && pos.y <= maxPosition.y &&
             pos.z >= minPosition.z && pos.z <= maxPosition.z;
    };

    return new SelectVertex(mesh, selectionManager, [], addToSelection, criteria);
  }

  /**
   * Creates a SelectVertex command to select vertices within a radius.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param center - Center position.
   * @param radius - Selection radius.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectVertex command instance.
   */
  static selectByRadius(
    mesh: Mesh,
    selectionManager: SelectionManager,
    center: { x: number; y: number; z: number },
    radius: number,
    addToSelection: boolean = false
  ): SelectVertex {
    const criteria = (vertexId: number): boolean => {
      const vertex = mesh.getVertex(vertexId);
      if (!vertex) return false;
      
      const pos = vertex.position;
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      const dz = pos.z - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      return distance <= radius;
    };

    return new SelectVertex(mesh, selectionManager, [], addToSelection, criteria);
  }

  /**
   * Creates a SelectVertex command to select all vertices.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @returns SelectVertex command instance.
   */
  static selectAll(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): SelectVertex {
    const allVertexIds = Array.from(mesh.vertices.keys());
    return new SelectVertex(mesh, selectionManager, allVertexIds, false);
  }

  /**
   * Creates a SelectVertex command to select vertices by index range.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param startIndex - Start index (inclusive).
   * @param endIndex - End index (inclusive).
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectVertex command instance.
   */
  static selectByRange(
    mesh: Mesh,
    selectionManager: SelectionManager,
    startIndex: number,
    endIndex: number,
    addToSelection: boolean = false
  ): SelectVertex {
    const allVertexIds = Array.from(mesh.vertices.keys()).sort((a, b) => a - b);
    const rangeVertexIds = allVertexIds.slice(startIndex, endIndex + 1);
    return new SelectVertex(mesh, selectionManager, rangeVertexIds, addToSelection);
  }
} 