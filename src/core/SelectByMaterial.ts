import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

export interface MaterialSelectionCriteria {
  materialId?: number | null;           // Specific material ID
  materialName?: string;               // Material name pattern
  hasNoMaterial?: boolean;             // Select faces with no material
  hasAnyMaterial?: boolean;            // Select faces with any material
  colorRange?: {                       // Select by color range
    minColor?: { r: number; g: number; b: number };
    maxColor?: { r: number; g: number; b: number };
  };
  opacityRange?: {                     // Select by opacity range
    min?: number;
    max?: number;
  };
  metallicRange?: {                    // Select by metallic range
    min?: number;
    max?: number;
  };
  roughnessRange?: {                   // Select by roughness range
    min?: number;
    max?: number;
  };
}

/**
 * Command to select faces based on their material properties.
 * Supports selection by material ID, name, properties, or lack of material.
 */
export class SelectByMaterial implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private criteria: MaterialSelectionCriteria;
  private addToSelection: boolean;
  
  // Store original selection state for undo
  private originalSelectedFaceIds: Set<number>;
  private newlySelectedFaceIds: Set<number> = new Set();
  
  public readonly description: string;

  /**
   * Creates an instance of SelectByMaterial command.
   * @param mesh - The mesh containing faces and materials.
   * @param selectionManager - The selection manager to modify.
   * @param criteria - Criteria for material-based selection.
   * @param addToSelection - If true, adds to current selection. If false, replaces selection.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    criteria: MaterialSelectionCriteria,
    addToSelection: boolean = false
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.criteria = { ...criteria };
    this.addToSelection = addToSelection;
    
    // Store original selection state
    this.originalSelectedFaceIds = new Set(selectionManager.getSelectedFaceIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.newlySelectedFaceIds.clear();
    
    if (!this.addToSelection) {
      this.selectionManager.clearFaceSelection();
    }

    // Iterate through all faces and check material criteria
    this.mesh.faces.forEach((face, faceId) => {
      if (this.faceMatchesCriteria(face)) {
        if (!this.originalSelectedFaceIds.has(faceId)) {
          this.selectionManager.selectFace(faceId, true);
          this.newlySelectedFaceIds.add(faceId);
        } else if (!this.addToSelection) {
          // Re-select faces that were originally selected if replacing selection
          this.selectionManager.selectFace(faceId, true);
        }
      }
    });
  }

  undo(): void {
    // Remove newly selected faces
    this.newlySelectedFaceIds.forEach(faceId => {
      this.selectionManager.deselectFace(faceId);
    });
    
    if (!this.addToSelection) {
      // Restore original selection if we replaced it
      this.selectionManager.clearFaceSelection();
      this.originalSelectedFaceIds.forEach(faceId => {
        this.selectionManager.selectFace(faceId, true);
      });
    }
    
    this.newlySelectedFaceIds.clear();
  }

  /**
   * Checks if a face matches the material selection criteria.
   * @param face - The face to check.
   * @returns True if the face matches criteria.
   */
  private faceMatchesCriteria(face: any): boolean {
    const materialId = face.materialIndex;
    
    // Check for no material
    if (this.criteria.hasNoMaterial && materialId === null) {
      return true;
    }
    
    // Check for any material
    if (this.criteria.hasAnyMaterial && materialId !== null) {
      return true;
    }
    
    // Check specific material ID
    if (this.criteria.materialId !== undefined) {
      return materialId === this.criteria.materialId;
    }
    
    // If no material assigned, can't check material properties
    if (materialId === null) {
      return false;
    }
    
    // Get the material object
    const material = this.mesh.materials.get(materialId);
    if (!material) {
      return false;
    }
    
    // Check material name pattern
    if (this.criteria.materialName) {
      if (!material.name || !material.name.includes(this.criteria.materialName)) {
        return false;
      }
    }
    
    // Check color range
    if (this.criteria.colorRange) {
      if (!this.checkColorRange(material.color, this.criteria.colorRange)) {
        return false;
      }
    }
    
    // Check opacity range
    if (this.criteria.opacityRange) {
      if (!this.checkNumberRange(material.opacity, this.criteria.opacityRange)) {
        return false;
      }
    }
    
    // Check metallic range
    if (this.criteria.metallicRange) {
      if (!this.checkNumberRange(material.metallic, this.criteria.metallicRange)) {
        return false;
      }
    }
    
    // Check roughness range
    if (this.criteria.roughnessRange) {
      if (!this.checkNumberRange(material.roughness, this.criteria.roughnessRange)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Checks if a color is within the specified range.
   * @param color - The color vector to check.
   * @param range - The color range criteria.
   * @returns True if color is within range.
   */
  private checkColorRange(color: any, range: NonNullable<MaterialSelectionCriteria['colorRange']>): boolean {
    if (range.minColor) {
      if (color.x < range.minColor.r || color.y < range.minColor.g || color.z < range.minColor.b) {
        return false;
      }
    }
    
    if (range.maxColor) {
      if (color.x > range.maxColor.r || color.y > range.maxColor.g || color.z > range.maxColor.b) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Checks if a number is within the specified range.
   * @param value - The value to check.
   * @param range - The range criteria.
   * @returns True if value is within range.
   */
  private checkNumberRange(value: number, range: { min?: number; max?: number }): boolean {
    if (range.min !== undefined && value < range.min) {
      return false;
    }
    
    if (range.max !== undefined && value > range.max) {
      return false;
    }
    
    return true;
  }

  /**
   * Builds a description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    let desc = 'Select faces by material';
    
    if (this.criteria.materialId !== undefined) {
      desc += ` (ID: ${this.criteria.materialId})`;
    } else if (this.criteria.materialName) {
      desc += ` (name: ${this.criteria.materialName})`;
    } else if (this.criteria.hasNoMaterial) {
      desc += ' (no material)';
    } else if (this.criteria.hasAnyMaterial) {
      desc += ' (any material)';
    } else {
      desc += ' (by properties)';
    }
    
    return desc + (this.addToSelection ? ' (add)' : ' (replace)');
  }

  /**
   * Static factory method to select faces with a specific material ID.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param materialId - The material ID to select.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectByMaterial command instance.
   */
  static selectByMaterialId(
    mesh: Mesh,
    selectionManager: SelectionManager,
    materialId: number | null,
    addToSelection: boolean = false
  ): SelectByMaterial {
    return new SelectByMaterial(mesh, selectionManager, { materialId }, addToSelection);
  }

  /**
   * Static factory method to select faces without any material.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectByMaterial command instance.
   */
  static selectFacesWithoutMaterial(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectByMaterial {
    return new SelectByMaterial(mesh, selectionManager, { hasNoMaterial: true }, addToSelection);
  }

  /**
   * Static factory method to select faces with any material.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param addToSelection - Whether to add to current selection.
   * @returns SelectByMaterial command instance.
   */
  static selectFacesWithAnyMaterial(
    mesh: Mesh,
    selectionManager: SelectionManager,
    addToSelection: boolean = false
  ): SelectByMaterial {
    return new SelectByMaterial(mesh, selectionManager, { hasAnyMaterial: true }, addToSelection);
  }
} 