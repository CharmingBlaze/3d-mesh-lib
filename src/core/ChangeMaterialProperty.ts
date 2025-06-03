import { Mesh } from './Mesh';
import { Material } from './Material';
import { ICommand } from './ICommand';
import { Vector3D } from '../utils/Vector3D';

/**
 * Command to change a property of a material.
 */
export class ChangeMaterialPropertyCommand implements ICommand {
  private oldValue: any;

  /**
   * Creates an instance of ChangeMaterialPropertyCommand.
   * @param mesh The mesh containing the material.
   * @param materialId The ID of the material to change.
   * @param propertyName The name of the material property to change.
   * @param newValue The new value for the property.
   */
  constructor(
    private mesh: Mesh,
    private materialId: number,
    private propertyName: keyof Material,
    private newValue: any
  ) {}

  public get description(): string {
    const material = this.mesh.getMaterial(this.materialId);
    const materialName = material ? material.name : `ID ${this.materialId}`;
    let valueStr = this.newValue;
    if (this.newValue instanceof Vector3D) {
      valueStr = this.newValue.toString();
    }
    return `Change material '${materialName}' property '${String(this.propertyName)}' to '${valueStr}'`;
  }

  public execute(): boolean {
    const material = this.mesh.getMaterial(this.materialId);
    if (!material) {
      console.warn(`ChangeMaterialPropertyCommand: Material with ID ${this.materialId} not found.`);
      return false;
    }

    // Type assertion to allow property access
    const mat = material as any;
    if (!(this.propertyName in material)) {
        console.warn(`ChangeMaterialPropertyCommand: Property '${String(this.propertyName)}' does not exist on Material.`);
        return false;
    }

    // Store old value - clone if it's an object like Vector3D to prevent reference issues
    const currentValue = mat[this.propertyName];
    if (currentValue instanceof Vector3D) {
      this.oldValue = currentValue.clone();
    } else if (typeof currentValue === 'object' && currentValue !== null && 'clone' in currentValue && typeof currentValue.clone === 'function') {
      // Attempt to clone if a clone method exists (e.g., for other complex types if added later)
      this.oldValue = currentValue.clone();
    } else {
      this.oldValue = currentValue;
    }

    // Set new value - clone if it's an object like Vector3D to ensure the command holds its own copy
    if (this.newValue instanceof Vector3D) {
      mat[this.propertyName] = this.newValue.clone();
    } else {
      mat[this.propertyName] = this.newValue;
    }
    
    // Note: Unlike geometry changes, material property changes typically don't affect the mesh's bounding box.
    // If a property change *could* affect rendering in a way that requires a general scene update (e.g., opacity for sorting),
    // the HistoryManager's onChange callback could be used by the application.
    return true;
  }

  public undo(): boolean {
    const material = this.mesh.getMaterial(this.materialId);
    if (!material) {
      console.warn(`ChangeMaterialPropertyCommand: Material with ID ${this.materialId} not found during undo.`);
      return false;
    }
    
    const mat = material as any;
    if (!(this.propertyName in material)) {
        // Should not happen if execute was successful
        console.warn(`ChangeMaterialPropertyCommand: Property '${String(this.propertyName)}' does not exist on Material during undo.`);
        return false;
    }

    if (this.oldValue === undefined) {
        console.warn(`ChangeMaterialPropertyCommand: No old value stored for property '${String(this.propertyName)}'. Cannot undo.`);
        return false;
    }

    // Restore old value - clone if it's an object like Vector3D
    if (this.oldValue instanceof Vector3D) {
      mat[this.propertyName] = this.oldValue.clone();
    } else {
      mat[this.propertyName] = this.oldValue;
    }
    
    return true;
  }
}
