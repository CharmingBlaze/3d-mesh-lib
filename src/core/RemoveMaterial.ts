import { Mesh } from './Mesh';
import { Material } from './Material';
import { ICommand } from './ICommand';
import { Face } from './Face';

interface FaceMaterialIndexChange {
  faceId: number;
  originalMaterialId: number | null;
}

/**
 * Command to remove a material from a mesh's material list and update face references.
 */
export class RemoveMaterial implements ICommand {
  private mesh: Mesh;
  private materialIdToRemove: number;
  private removedMaterial: Material | null = null;
  // Stores face IDs that were pointing to the removed material and their original material ID (which is materialIdToRemove)
  private facesToUpdate: FaceMaterialIndexChange[] = []; 
  public readonly description: string;

  /**
   * Creates an instance of RemoveMaterial command.
   * @param mesh - The mesh to remove the material from.
   * @param materialIdToRemove - The ID of the material to remove from mesh.materials.
   */
  constructor(mesh: Mesh, materialIdToRemove: number) {
    this.mesh = mesh;
    this.materialIdToRemove = materialIdToRemove;
    const material = this.mesh.materials.get(this.materialIdToRemove);

    if (!material) {
      this.description = `Remove Material: Invalid ID (${materialIdToRemove})`;
    } else {
      this.description = `Remove Material (ID: ${materialIdToRemove}, Name: ${material.name || 'Unnamed Material'})`;
    }
  }

  execute(): void {
    this.removedMaterial = this.mesh.materials.get(this.materialIdToRemove) || null;

    if (!this.removedMaterial) {
      console.warn(`RemoveMaterial.execute: Material with ID ${this.materialIdToRemove} not found. No material removed.`);
      this.facesToUpdate = [];
      return;
    }

    this.mesh.materials.delete(this.materialIdToRemove);
    this.facesToUpdate = []; // Clear previous changes if any

    this.mesh.faces.forEach((face: Face) => {
      if (face.materialIndex === this.materialIdToRemove) {
        this.facesToUpdate.push({ faceId: face.id, originalMaterialId: face.materialIndex });
        face.materialIndex = null; // Material removed, so faces using it lose assignment
      }
    });
    // No need to shift other material indices as Map keys (IDs) don't change.
  }

  undo(): void {
    if (!this.removedMaterial) {
      console.warn("RemoveMaterial.undo: No material was recorded as removed. Cannot undo.");
      return;
    }

    // Re-insert the material with its original ID
    this.mesh.materials.set(this.removedMaterial.id, this.removedMaterial);

    // Revert face material indices for those faces that were pointing to the removed material
    for (const change of this.facesToUpdate) {
      const face = this.mesh.getFace(change.faceId); // Use getFace
      if (face) {
        // The originalMaterialId stored was the ID of the material that was removed.
        // So, when undoing, these faces should point back to this material's ID.
        face.materialIndex = change.originalMaterialId; 
      } else {
        console.warn(`RemoveMaterial.undo: Face with ID ${change.faceId} not found. Cannot restore material index.`);
      }
    }

    this.removedMaterial = null; // Clear removed material once undone
    this.facesToUpdate = []; // Clear changes
  }
}
