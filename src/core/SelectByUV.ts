import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

export interface UVSelectionCriteria {
  hasUV?: boolean;                     // Select vertices with UV coordinates
  hasNoUV?: boolean;                   // Select vertices without UV coordinates
  uvRange?: {                          // Select by UV coordinate range
    minU?: number;
    maxU?: number;
    minV?: number;
    maxV?: number;
  };
  uvValue?: {                          // Select vertices with specific UV values (with tolerance)
    u: number;
    v: number;
    tolerance?: number;
  };
  uvArea?: {                           // Select vertices within UV rectangular area
    topLeft: { u: number; v: number };
    bottomRight: { u: number; v: number };
  };
  uvDistance?: {                       // Select vertices within distance from UV point
    center: { u: number; v: number };
    radius: number;
  };
  uvBoundary?: boolean;                // Select vertices at UV boundaries (0, 1)
}

/**
 * Command to select vertices based on their UV coordinates.
 * Supports selection by UV presence, ranges, specific values, areas, and boundaries.
 */
export class SelectByUV implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private criteria: UVSelectionCriteria;
  private addToSelection: boolean;
  
  // Store original selection state for undo
  private originalSelectedVertexIds: Set<number>;
  private newlySelectedVertexIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of SelectByUV command.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager to modify.
   * @param criteria - Criteria for UV-based selection.
   * @param addToSelection - If true, adds to current selection. If false, replaces selection.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    criteria: UVSelectionCriteria,
    addToSelection: boolean = false
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.criteria = { ...criteria };
    this.addToSelection = addToSelection;
    
    // Store original selection state
    this.originalSelectedVertexIds = new Set(selectionManager.getSelectedVertexIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.newlySelectedVertexIds.clear();
    
    if (!this.addToSelection) {
      this.selectionManager.clearVertexSelection();
    }

    // Iterate through all vertices and check UV criteria
    this.mesh.vertices.forEach((vertex, vertexId) => {
      if (this.vertexMatchesCriteria(vertex)) {
        if (!this.originalSelectedVertexIds.has(vertexId)) {
          this.selectionManager.selectVertex(vertexId, true);
          this.newlySelectedVertexIds.add(vertexId);
        } else if (!this.addToSelection) {
          // Re-select vertices that were originally selected if replacing selection
          this.selectionManager.selectVertex(vertexId, true);
        }
      }
    });
  }

  undo(): void {
    // Remove newly selected vertices
    this.newlySelectedVertexIds.forEach(vertexId => {
      this.selectionManager.deselectVertex(vertexId);
    });
    
    if (!this.addToSelection) {
      // Restore original selection if we replaced it
      this.selectionManager.clearVertexSelection();
      this.originalSelectedVertexIds.forEach(vertexId => {
        this.selectionManager.selectVertex(vertexId, true);
      });
    }
    
    this.newlySelectedVertexIds.clear();
  }

  /**
   * Checks if a vertex matches the UV selection criteria.
   * @param vertex - The vertex to check.
   * @returns True if the vertex matches criteria.
   */
  private vertexMatchesCriteria(vertex: any): boolean {
    const hasUV = vertex.uv !== null && vertex.uv !== undefined;
    
    // Check for vertices with UV coordinates
    if (this.criteria.hasUV && hasUV) {
      return true;
    }
    
    // Check for vertices without UV coordinates
    if (this.criteria.hasNoUV && !hasUV) {
      return true;
    }
    
    // If no UV coordinates, can't check UV-based criteria
    if (!hasUV) {
      return false;
    }
    
    const uv = vertex.uv;
    
    // Check UV range
    if (this.criteria.uvRange) {
      if (!this.checkUVRange(uv, this.criteria.uvRange)) {
        return false;
      }
    }
    
    // Check specific UV value
    if (this.criteria.uvValue) {
      if (!this.checkUVValue(uv, this.criteria.uvValue)) {
        return false;
      }
    }
    
    // Check UV area
    if (this.criteria.uvArea) {
      if (!this.checkUVArea(uv, this.criteria.uvArea)) {
        return false;
      }
    }
    
    // Check UV distance
    if (this.criteria.uvDistance) {
      if (!this.checkUVDistance(uv, this.criteria.uvDistance)) {
        return false;
      }
    }
    
    // Check UV boundary
    if (this.criteria.uvBoundary) {
      if (!this.checkUVBoundary(uv)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Checks if UV coordinates are within the specified range.
   * @param uv - The UV coordinates to check.
   * @param range - The UV range criteria.
   * @returns True if UV is within range.
   */
  private checkUVRange(uv: { u: number; v: number }, range: NonNullable<UVSelectionCriteria['uvRange']>): boolean {
    if (range.minU !== undefined && uv.u < range.minU) {
      return false;
    }
    if (range.maxU !== undefined && uv.u > range.maxU) {
      return false;
    }
    if (range.minV !== undefined && uv.v < range.minV) {
      return false;
    }
    if (range.maxV !== undefined && uv.v > range.maxV) {
      return false;
    }
    return true;
  }

  /**
   * Checks if UV coordinates match a specific value within tolerance.
   * @param uv - The UV coordinates to check.
   * @param valueSpec - The UV value specification.
   * @returns True if UV matches the specified value.
   */
  private checkUVValue(uv: { u: number; v: number }, valueSpec: NonNullable<UVSelectionCriteria['uvValue']>): boolean {
    const tolerance = valueSpec.tolerance || 0.001;
    const uDiff = Math.abs(uv.u - valueSpec.u);
    const vDiff = Math.abs(uv.v - valueSpec.v);
    return uDiff <= tolerance && vDiff <= tolerance;
  }

  /**
   * Checks if UV coordinates are within a rectangular area.
   * @param uv - The UV coordinates to check.
   * @param area - The UV area specification.
   * @returns True if UV is within the area.
   */
  private checkUVArea(uv: { u: number; v: number }, area: NonNullable<UVSelectionCriteria['uvArea']>): boolean {
    const { topLeft, bottomRight } = area;
    return uv.u >= topLeft.u && uv.u <= bottomRight.u &&
           uv.v >= topLeft.v && uv.v <= bottomRight.v;
  }

  /**
   * Checks if UV coordinates are within distance from a center point.
   * @param uv - The UV coordinates to check.
   * @param distSpec - The UV distance specification.
   * @returns True if UV is within the specified distance.
   */
  private checkUVDistance(uv: { u: number; v: number }, distSpec: NonNullable<UVSelectionCriteria['uvDistance']>): boolean {
    const { center, radius } = distSpec;
    const uDiff = uv.u - center.u;
    const vDiff = uv.v - center.v;
    const distance = Math.sqrt(uDiff * uDiff + vDiff * vDiff);
    return distance <= radius;
  }

  /**
   * Checks if UV coordinates are at the UV boundary (0 or 1).
   * @param uv - The UV coordinates to check.
   * @returns True if UV is at boundary.
   */
  private checkUVBoundary(uv: { u: number; v: number }): boolean {
    const tolerance = 0.001;
    const atUBoundary = Math.abs(uv.u) <= tolerance || Math.abs(uv.u - 1) <= tolerance;
    const atVBoundary = Math.abs(uv.v) <= tolerance || Math.abs(uv.v - 1) <= tolerance;
    return atUBoundary || atVBoundary;
  }

  /**
   * Builds a description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    let desc = 'Select vertices by UV';
    
    if (this.criteria.hasUV) {
      desc += ' (with UVs)';
    } else if (this.criteria.hasNoUV) {
      desc += ' (without UVs)';
    } else if (this.criteria.uvValue) {
      desc += ` (UV=${this.criteria.uvValue.u.toFixed(2)},${this.criteria.uvValue.v.toFixed(2)})`;
    } else if (this.criteria.uvRange) {
      desc += ' (by range)';
    } else if (this.criteria.uvArea) {
      desc += ' (by area)';
    } else if (this.criteria.uvDistance) {
      desc += ' (by distance)';
    } else if (this.criteria.uvBoundary) {
      desc += ' (at boundary)';
    } else {
      desc += ' (by criteria)';
    }
    
    return desc + (this.addToSelection ? ' (add)' : ' (replace)');
  }

  /**
   * Static factory method to select vertices with UV coordinates.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectByUV command instance.
   */
  static selectVerticesWithUV(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectByUV {
    return new SelectByUV(mesh, selectionManager, { hasUV: true }, addToSelection);
  }

  /**
   * Static factory method to select vertices without UV coordinates.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectByUV command instance.
   */
  static selectVerticesWithoutUV(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectByUV {
    return new SelectByUV(mesh, selectionManager, { hasNoUV: true }, addToSelection);
  }

  /**
   * Static factory method to select vertices at UV boundaries.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectByUV command instance.
   */
  static selectUVBoundaryVertices(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectByUV {
    return new SelectByUV(mesh, selectionManager, { uvBoundary: true }, addToSelection);
  }

  /**
   * Static factory method to select vertices within UV range.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param minU - Minimum U coordinate.
   * @param maxU - Maximum U coordinate.
   * @param minV - Minimum V coordinate.
   * @param maxV - Maximum V coordinate.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectByUV command instance.
   */
  static selectByUVRange(
    mesh: Mesh,
    selectionManager: SelectionManager,
    minU?: number,
    maxU?: number,
    minV?: number,
    maxV?: number,
    addToSelection: boolean = false
  ): SelectByUV {
    return new SelectByUV(mesh, selectionManager, { 
      uvRange: { minU, maxU, minV, maxV } 
    }, addToSelection);
  }
} 