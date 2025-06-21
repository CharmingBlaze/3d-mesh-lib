import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
// Face class is used via mesh.getFace()

export class FlipFaces implements ICommand {
  private mesh: Mesh;
  private faceIdsToFlip: number[]; // Store IDs of faces that were successfully found and flipped
  public readonly description: string;

  constructor(mesh: Mesh, faceIds: number[], description?: string) {
    this.mesh = mesh;
    // Store a copy of the IDs to ensure the command has its own list
    this.faceIdsToFlip = [...faceIds]; 
    this.description = description || `Flip ${faceIds.length} face${faceIds.length === 1 ? '' : 's'}`;
  }

  execute(): void {
    const successfullyFlippedIds: number[] = [];
    for (const faceId of this.faceIdsToFlip) {
      const face = this.mesh.getFace(faceId);
      if (face) {
        face.flip();
        successfullyFlippedIds.push(faceId); // Track successfully flipped faces
      } else {
        console.warn(`FlipFaces: Face with ID ${faceId} not found, cannot flip.`);
      }
    }
    // Update faceIdsToFlip to only include those that were actually processed
    // This ensures undo only acts on faces that were indeed flipped.
    this.faceIdsToFlip = successfullyFlippedIds;
  }

  undo(): void {
    if (this.faceIdsToFlip.length === 0) {
      // This can happen if execute found no faces or if undo was already called.
      return;
    }

    for (const faceId of this.faceIdsToFlip) {
      const face = this.mesh.getFace(faceId);
      if (face) {
        face.flip(); // Flipping again restores the original orientation
      } else {
        // This should ideally not happen if the face was found during execute
        console.warn(`FlipFaces (undo): Face with ID ${faceId} not found, cannot un-flip.`);
      }
    }
    // It's good practice to clear or mark as undone if the command is not meant to be re-executed without state reset.
    // For this command, re-executing after undo would flip them again, which is fine.
    // If we wanted to prevent re-undoing, we could clear faceIdsToFlip here.
    // For now, let's assume it can be toggled.
  }
}
