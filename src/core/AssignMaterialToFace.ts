import { Mesh } from './Mesh';
import { ICommand } from './ICommand';

/**
 * Command to assign or change the material of a specific face.
 */
export class AssignMaterialToFaceCommand implements ICommand {
  private oldMaterialIndex: number | null | undefined;

  /**
   * Creates an instance of AssignMaterialToFaceCommand.
   * @param mesh The mesh containing the face.
   * @param faceId The ID of the face whose material is to be changed.
   * @param newMaterialIndex The index of the new material to assign (from mesh.materials array), or null to remove material assignment.
   */
  constructor(
    private mesh: Mesh,
    private faceId: number,
    private newMaterialIndex: number | null
  ) {}

  public get description(): string {
    const face = this.mesh.getFace(this.faceId);
    const newMatIdxStr = this.newMaterialIndex === null ? 'none' : `index ${this.newMaterialIndex}`;
    if (!face) {
      return `Assign material ${newMatIdxStr} to non-existent face ID ${this.faceId}`;
    }
    const currentMatIdxStr = face.materialIndex === null ? 'none' : `index ${face.materialIndex}`;
    // Description reflects state *before* execute for clarity if logged immediately
    return `Assign material ${newMatIdxStr} to face ID ${this.faceId} (was ${this.oldMaterialIndex === undefined ? currentMatIdxStr : (this.oldMaterialIndex === null ? 'none' : `index ${this.oldMaterialIndex}`)})`;
  }

  public execute(): boolean {
    const face = this.mesh.getFace(this.faceId);
    if (!face) {
      console.warn(`AssignMaterialToFaceCommand: Face with ID ${this.faceId} not found.`);
      return false;
    }

    // Check if the new material index is valid (exists in mesh.materials array or is null)
    if (this.newMaterialIndex !== null && 
        (this.newMaterialIndex < 0 || this.newMaterialIndex >= this.mesh.materialArray.length)) {
      console.warn(`AssignMaterialToFaceCommand: New material index ${this.newMaterialIndex} is out of bounds for mesh materials array.`);
      // Depending on desired strictness, could return false here.
      // For now, allow assigning an out-of-bounds index, though it will likely cause issues.
    }

    this.oldMaterialIndex = face.materialIndex;
    face.materialIndex = this.newMaterialIndex;
    
    // Material assignment changes do not typically affect bounding box.
    // Application might need to trigger a redraw or update based on material changes.
    return true;
  }

  public undo(): boolean {
    const face = this.mesh.getFace(this.faceId);
    if (!face) {
      console.warn(`AssignMaterialToFaceCommand: Face with ID ${this.faceId} not found during undo.`);
      return false;
    }

    if (this.oldMaterialIndex === undefined) {
      console.warn(`AssignMaterialToFaceCommand: No old material index stored for face ID ${this.faceId}. Cannot undo.`);
      return false;
    }

    // Check if the old material index is valid (exists in mesh.materials array or is null)
    if (this.oldMaterialIndex !== null && 
        (this.oldMaterialIndex < 0 || this.oldMaterialIndex >= this.mesh.materialArray.length)) {
      console.warn(`AssignMaterialToFaceCommand: Old material index ${this.oldMaterialIndex} is out of bounds for mesh materials array during undo. Restoring anyway.`);
    }

    face.materialIndex = this.oldMaterialIndex;
    this.oldMaterialIndex = undefined; // Clear after undo
    return true;
  }
}
