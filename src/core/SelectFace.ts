import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

/**
 * Command to select faces by ID or criteria.
 * Supports single face selection, multiple face selection, and conditional selection.
 */
export class SelectFace implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  private addToSelection: boolean;
  private selectionCriteria?: (faceId: number) => boolean;
  
  // Store original selection state for undo
  private originalSelectedFaceIds: Set<number>;
  private newlySelectedFaceIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of SelectFace command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager to modify.
   * @param faceIds - Array of face IDs to select (or empty for criteria-based selection).
   * @param addToSelection - If true, adds to current selection. If false, replaces selection.
   * @param selectionCriteria - Optional function to determine which faces to select.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    faceIds: number[] = [],
    addToSelection: boolean = false,
    selectionCriteria?: (faceId: number) => boolean
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.faceIds = [...faceIds];
    this.addToSelection = addToSelection;
    this.selectionCriteria = selectionCriteria;
    
    // Store original selection state
    this.originalSelectedFaceIds = new Set(selectionManager.getSelectedFaceIds());
    
    if (selectionCriteria) {
      this.description = `Select faces by criteria ${addToSelection ? '(add to selection)' : '(replace selection)'}`;
    } else if (faceIds.length === 1) {
      this.description = `Select face ${faceIds[0]} ${addToSelection ? '(add)' : '(replace)'}`;
    } else if (faceIds.length > 1) {
      this.description = `Select ${faceIds.length} faces ${addToSelection ? '(add)' : '(replace)'}`;
    } else {
      this.description = 'Select faces (no targets specified)';
    }
  }

  execute(): void {
    this.newlySelectedFaceIds.clear();
    
    // Clear current selection if not adding
    if (!this.addToSelection) {
      this.selectionManager.clearFaceSelection();
    }

    // Select faces based on IDs or criteria
    if (this.selectionCriteria) {
      this.selectByCriteria();
    } else {
      this.selectByIds();
    }

    console.log(`SelectFace: Selected ${this.newlySelectedFaceIds.size} faces. Total selection: ${this.selectionManager.getSelectedFaceIds().size}`);
  }

  undo(): void {
    if (this.addToSelection) {
      // Remove only newly selected faces
      this.newlySelectedFaceIds.forEach(faceId => {
        this.selectionManager.deselectFace(faceId);
      });
    } else {
      // Restore original selection completely
      this.selectionManager.clearFaceSelection();
      this.originalSelectedFaceIds.forEach(faceId => {
        this.selectionManager.selectFace(faceId, true);
      });
    }
    
    this.newlySelectedFaceIds.clear();
  }

  /**
   * Selects faces by their IDs.
   */
  private selectByIds(): void {
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (face) {
        // Only track as newly selected if it wasn't originally selected
        if (!this.originalSelectedFaceIds.has(faceId)) {
          this.newlySelectedFaceIds.add(faceId);
        }
        this.selectionManager.selectFace(faceId, true);
      } else {
        console.warn(`SelectFace: Face ${faceId} not found in mesh.`);
      }
    });
  }

  /**
   * Selects faces based on criteria function.
   */
  private selectByCriteria(): void {
    if (!this.selectionCriteria) return;

    let selectedCount = 0;
    this.mesh.faces.forEach((face, faceId) => {
      if (this.selectionCriteria!(faceId)) {
        // Only track as newly selected if it wasn't originally selected
        if (!this.originalSelectedFaceIds.has(faceId)) {
          this.newlySelectedFaceIds.add(faceId);
        }
        this.selectionManager.selectFace(faceId, true);
        selectedCount++;
      }
    });

    console.log(`SelectFace: Applied criteria and selected ${selectedCount} faces.`);
  }

  /**
   * Creates a SelectFace command to select faces by material.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param materialIndex - Material index to select.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectFace command instance.
   */
  static selectByMaterial(
    mesh: Mesh,
    selectionManager: SelectionManager,
    materialIndex: number,
    addToSelection: boolean = false
  ): SelectFace {
    const criteria = (faceId: number): boolean => {
      const face = mesh.getFace(faceId);
      return face ? face.materialIndex === materialIndex : false;
    };

    return new SelectFace(mesh, selectionManager, [], addToSelection, criteria);
  }

  /**
   * Creates a SelectFace command to select faces by vertex count.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param vertexCount - Number of vertices (3 for triangles, 4 for quads, etc.).
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectFace command instance.
   */
  static selectByVertexCount(
    mesh: Mesh,
    selectionManager: SelectionManager,
    vertexCount: number,
    addToSelection: boolean = false
  ): SelectFace {
    const criteria = (faceId: number): boolean => {
      const face = mesh.getFace(faceId);
      return face ? face.vertices.length === vertexCount : false;
    };

    return new SelectFace(mesh, selectionManager, [], addToSelection, criteria);
  }

  /**
   * Creates a SelectFace command to select faces by normal direction.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param direction - Target normal direction.
   * @param tolerance - Angle tolerance in radians.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectFace command instance.
   */
  static selectByNormal(
    mesh: Mesh,
    selectionManager: SelectionManager,
    direction: { x: number; y: number; z: number },
    tolerance: number = Math.PI / 4, // 45 degrees
    addToSelection: boolean = false
  ): SelectFace {
    // Normalize target direction
    const targetMag = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    const targetNormal = {
      x: direction.x / targetMag,
      y: direction.y / targetMag,
      z: direction.z / targetMag
    };

    const criteria = (faceId: number): boolean => {
      const face = mesh.getFace(faceId);
      if (!face) return false;
      
      // Calculate face normal using basic cross product
      if (!face || face.vertices.length < 3) return false;
      
      const v0 = face.vertices[0].position;
      const v1 = face.vertices[1].position;
      const v2 = face.vertices[2].position;
      
      // Calculate edge vectors
      const edge1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
      const edge2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };
      
      // Calculate cross product for normal
      const normal = {
        x: edge1.y * edge2.z - edge1.z * edge2.y,
        y: edge1.z * edge2.x - edge1.x * edge2.z,
        z: edge1.x * edge2.y - edge1.y * edge2.x
      };
      
      // Normalize
      const magnitude = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
      if (magnitude === 0) return false;
      
      normal.x /= magnitude;
      normal.y /= magnitude;
      normal.z /= magnitude;
      
      // Calculate angle between normals
      const dot = normal.x * targetNormal.x + normal.y * targetNormal.y + normal.z * targetNormal.z;
      const angle = Math.acos(Math.max(-1, Math.min(1, Math.abs(dot))));
      
      return angle <= tolerance;
    };

    return new SelectFace(mesh, selectionManager, [], addToSelection, criteria);
  }

  /**
   * Creates a SelectFace command to select faces by area.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param minArea - Minimum face area.
   * @param maxArea - Maximum face area.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectFace command instance.
   */
  static selectByArea(
    mesh: Mesh,
    selectionManager: SelectionManager,
    minArea: number,
    maxArea: number,
    addToSelection: boolean = false
  ): SelectFace {
    const criteria = (faceId: number): boolean => {
      const face = mesh.getFace(faceId);
      if (!face || face.vertices.length < 3) return false;
      
      // Calculate face area using triangle fan method
      let area = 0;
      for (let i = 1; i < face.vertices.length - 1; i++) {
        const v0 = face.vertices[0].position;
        const v1 = face.vertices[i].position;
        const v2 = face.vertices[i + 1].position;
        
        // Calculate triangle area using cross product
        const edge1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
        const edge2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };
        
        const cross = {
          x: edge1.y * edge2.z - edge1.z * edge2.y,
          y: edge1.z * edge2.x - edge1.x * edge2.z,
          z: edge1.x * edge2.y - edge1.y * edge2.x
        };
        
        const magnitude = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
        area += magnitude * 0.5;
      }
      
      return area >= minArea && area <= maxArea;
    };

    return new SelectFace(mesh, selectionManager, [], addToSelection, criteria);
  }

  /**
   * Creates a SelectFace command to select all faces.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @returns SelectFace command instance.
   */
  static selectAll(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): SelectFace {
    const allFaceIds = Array.from(mesh.faces.keys());
    return new SelectFace(mesh, selectionManager, allFaceIds, false);
  }

  /**
   * Creates a SelectFace command to select faces containing specific vertices.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param vertexIds - Array of vertex IDs.
   * @param requireAllVertices - If true, face must contain all vertices. If false, any vertex.
   * @param addToSelection - If true, adds to current selection.
   * @returns SelectFace command instance.
   */
  static selectByVertices(
    mesh: Mesh,
    selectionManager: SelectionManager,
    vertexIds: number[],
    requireAllVertices: boolean = false,
    addToSelection: boolean = false
  ): SelectFace {
    const vertexSet = new Set(vertexIds);
    
    const criteria = (faceId: number): boolean => {
      const face = mesh.getFace(faceId);
      if (!face) return false;
      
      const faceVertexIds = face.vertices.map(v => v.id);
      
      if (requireAllVertices) {
        // Face must contain all specified vertices
        return vertexIds.every(vId => faceVertexIds.includes(vId));
      } else {
        // Face must contain at least one specified vertex
        return faceVertexIds.some(vId => vertexSet.has(vId));
      }
    };

    return new SelectFace(mesh, selectionManager, [], addToSelection, criteria);
  }
} 