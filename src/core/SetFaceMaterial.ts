import { ICommand } from './ICommand';
import { Mesh } from './Mesh';

interface OriginalMaterialState {
  faceId: number;
  materialId: number | null;
}

export class SetFaceMaterial implements ICommand {
  private mesh: Mesh;
  private faceIds: number[];
  private newMaterialId: number | null;
  private originalMaterialStates: OriginalMaterialState[] = [];
  public readonly description: string;

  constructor(mesh: Mesh, faceIds: number[], newMaterialId: number | null, description?: string) {
    this.mesh = mesh;
    this.faceIds = [...faceIds];
    this.newMaterialId = newMaterialId;
    
    if (description) {
      this.description = description;
    } else {
      const target = `${faceIds.length} face${faceIds.length === 1 ? '' : 's'}`;
      const materialDesc = newMaterialId === null ? 'no material' : `material ID ${newMaterialId}`;
      this.description = `Set ${target} to ${materialDesc}`;
    }
  }

  execute(): void {
    this.originalMaterialStates = []; // Clear previous state

    if (this.newMaterialId !== null && !this.mesh.materials.has(this.newMaterialId)) {
      console.warn(`SetFaceMaterial: Material with ID ${this.newMaterialId} not found in mesh. Aborting operation for all faces.`);
      // Optionally, one might choose to proceed for faces where newMaterialId is null, 
      // or handle this as a global failure. For now, fail all if new ID is invalid.
      return; 
    }

    for (const faceId of this.faceIds) {
      const face = this.mesh.getFace(faceId);
      if (face) {
        this.originalMaterialStates.push({
          faceId,
          materialId: face.materialIndex,
        });
        face.materialIndex = this.newMaterialId;
      } else {
        console.warn(`SetFaceMaterial: Face with ID ${faceId} not found.`);
      }
    }
  }

  undo(): void {
    if (this.originalMaterialStates.length === 0) {
      return; // Nothing was changed or undo already performed
    }

    for (const state of this.originalMaterialStates) {
      const face = this.mesh.getFace(state.faceId);
      if (face) {
        face.materialIndex = state.materialId;
      } else {
        console.warn(`SetFaceMaterial (undo): Face with ID ${state.faceId} not found.`);
      }
    }
    this.originalMaterialStates = []; // Clear state after undo
  }
}
