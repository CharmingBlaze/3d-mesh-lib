import { Mesh } from './Mesh';
import { ICommand } from './ICommand';

/**
 * Command to assign a material to a specified set of faces in a mesh.
 */
export class AssignMaterialToFaces implements ICommand {
  private mesh: Mesh;
  private faceIds: number[];
  private newMaterialIndex: number | null;
  private originalMaterialIndices: Map<number, number | null>; // Stores faceId -> originalMaterialIndex
  public readonly description: string;

  /**
   * Creates an instance of AssignMaterialToFaces command.
   * @param mesh - The mesh containing the faces.
   * @param faceIds - An array of IDs of the faces to modify.
   * @param materialIndex - The new material index to assign. Can be null to remove material assignment.
   */
  constructor(mesh: Mesh, faceIds: number[], materialIndex: number | null) {
    this.mesh = mesh;
    this.faceIds = [...faceIds]; // Store a copy
    this.newMaterialIndex = materialIndex;
    this.originalMaterialIndices = new Map<number, number | null>();

    if (this.newMaterialIndex !== null && (this.newMaterialIndex < 0 || this.newMaterialIndex >= this.mesh.materialArray.length)) {
        console.warn(`AssignMaterialToFaces: Material index ${this.newMaterialIndex} is out of bounds for mesh materials array (length ${this.mesh.materialArray.length}). It will be treated as an invalid assignment if not corrected before execution.`);
        // Depending on strictness, could throw an error here or let execute handle it.
    }

    this.description = `Assign Material (Index: ${materialIndex === null ? 'None' : materialIndex}) to ${faceIds.length} face(s)`;
  }

  execute(): void {
    this.originalMaterialIndices.clear();
    for (const faceId of this.faceIds) {
      const face = this.mesh.faces.get(faceId);
      if (face) {
        this.originalMaterialIndices.set(faceId, face.materialIndex);
        face.materialIndex = this.newMaterialIndex;
      } else {
        console.warn(`AssignMaterialToFaces.execute: Face with ID ${faceId} not found in mesh.`);
      }
    }
    // Note: Changing material index doesn't typically require bounding box or geometry recalculation.
    // However, if rendering or other systems depend on this, they might need notification.
  }

  undo(): void {
    if (this.originalMaterialIndices.size === 0) {
        // This can happen if execute was never called or if faceIds was empty.
        // Or if all faceIds provided were invalid.
        console.warn("AssignMaterialToFaces.undo: No original material indices recorded. Undo might not be possible or effective.");
        return;
    }
    for (const [faceId, originalIndex] of this.originalMaterialIndices) {
      const face = this.mesh.faces.get(faceId);
      if (face) {
        face.materialIndex = originalIndex;
      } else {
        // This case should ideally not happen if execute found the face, 
        // unless the face was deleted between execute and undo by another means.
        console.warn(`AssignMaterialToFaces.undo: Face with ID ${faceId} not found in mesh. Cannot restore material index.`);
      }
    }
  }
}
