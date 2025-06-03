import { ICommand } from './ICommand';
import { Mesh } from './Mesh';

interface RemovedFaceData {
  vertexIds: number[];
  materialId?: number;
  originalId: number; // Store original ID for potential re-linking if strict ID restoration is ever needed
                      // For now, addFace will assign a new ID on undo.
}

export class RemoveFaceCommand implements ICommand {
  private mesh: Mesh;
  private faceIdToRemove: number;
  private removedFaceData: RemovedFaceData | null = null;
  public description: string;

  constructor(mesh: Mesh, faceIdToRemove: number, description?: string) {
    this.mesh = mesh;
    this.faceIdToRemove = faceIdToRemove;
    this.description = description || `Remove Face (ID: ${faceIdToRemove})`;
  }

  execute(): void {
    const faceToRemove = this.mesh.getFace(this.faceIdToRemove);
    if (faceToRemove) {
      this.removedFaceData = {
        vertexIds: faceToRemove.vertices.map(v => v.id),
        materialId: faceToRemove.materialIndex === null ? undefined : faceToRemove.materialIndex,
        originalId: faceToRemove.id
      };
      const success = this.mesh.removeFace(this.faceIdToRemove);
      if (!success) {
        // Should not happen if getFace returned a face, but as a safeguard:
        console.warn(`RemoveFaceCommand.execute: Mesh.removeFace failed for ID ${this.faceIdToRemove}.`);
        this.removedFaceData = null; // Invalidate data if removal failed
      }
    } else {
      console.warn(`RemoveFaceCommand.execute: Face with ID ${this.faceIdToRemove} not found.`);
      this.removedFaceData = null;
    }
  }

  undo(): void {
    if (this.removedFaceData) {
      try {
        // addFace will create a new face with a new ID.
        // Edges and vertex face-links are handled by mesh.addFace()
        this.mesh.addFace(this.removedFaceData.vertexIds, this.removedFaceData.materialId);
        // Optionally, if we needed to restore the exact same ID (more complex, requires ID management in Mesh):
        // (this.mesh.faces as Map<number, Face>).delete(newFace.id); // remove the one just added
        // newFace.id = this.removedFaceData.originalId; // force old ID
        // (this.mesh.faces as Map<number, Face>).set(newFace.id, newFace);
        // And then update Face.nextId if (this.removedFaceData.originalId >= Face.getStaticNextId())
        // For now, accepting a new ID on undo is simpler and generally fine.
      } catch (error) {
        console.error('RemoveFaceCommand.undo: Failed to re-add face.', error);
      }
      this.removedFaceData = null; // Clear data after attempting undo
    } else {
      console.warn('RemoveFaceCommand.undo: No face data to restore. Execute might not have been called or failed.');
    }
  }
}
