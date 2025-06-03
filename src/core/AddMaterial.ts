import { Mesh } from './Mesh';
import { Material, MaterialOptions } from './Material';
import { ICommand } from './ICommand';

/**
 * Command to add a new material to a mesh's material list.
 */
export class AddMaterial implements ICommand {
  private mesh: Mesh;
  private materialInstance: Material | null = null; // The actual material instance, either provided or created
  private optionsForNewMaterial?: Partial<MaterialOptions> & { name?: string }; // Allow name in options for convenience
  private addedMaterialId: number = -1; // Stores the ID of the added/created material
  private wasInstanceProvided: boolean = false;
  private originalMaterialIfReplaced: Material | null = null; // If adding an instance with an ID that already exists

  public readonly description: string;

  constructor(mesh: Mesh, materialOrOptions: Material | (Partial<MaterialOptions> & { name?: string })) {
    this.mesh = mesh;

    if (materialOrOptions instanceof Material) {
      this.materialInstance = materialOrOptions;
      this.wasInstanceProvided = true;
      this.description = `Add Material (instance): ${this.materialInstance.name} (ID: ${this.materialInstance.id})`;
    } else {
      // materialOrOptions is Partial<MaterialOptions> & { name?: string }
      this.optionsForNewMaterial = materialOrOptions;
      this.wasInstanceProvided = false;
      const potentialName = this.optionsForNewMaterial.name ? ` (Name hint: ${this.optionsForNewMaterial.name})` : '';
      this.description = `Add Material (new from options)${potentialName}`;
    }
  }

  execute(): void {
    if (this.wasInstanceProvided && this.materialInstance) {
      // Adding an existing Material instance
      this.addedMaterialId = this.materialInstance.id;
      if (this.mesh.materials.has(this.addedMaterialId)) {
        this.originalMaterialIfReplaced = this.mesh.materials.get(this.addedMaterialId)!;
      }
      this.mesh.materials.set(this.addedMaterialId, this.materialInstance);
    } else if (this.optionsForNewMaterial) {
      // Creating a new Material from options. Material constructor needs a name.
      // Creating a new Material from options. Material constructor needs a name.
      const newMaterialName = this.optionsForNewMaterial.name || `Material_${Material.getNextId()}`; // Use Material's ID counter for unique name
      // Create a new options object excluding the 'name' property if it exists, as Material constructor takes name separately.
      const { name, ...restOptions } = this.optionsForNewMaterial;
      this.materialInstance = new Material(newMaterialName, restOptions);
      this.addedMaterialId = this.materialInstance.id;

      // Check if this new ID accidentally conflicts (highly unlikely with auto-increment IDs if Material.nextId is robust)
      if (this.mesh.materials.has(this.addedMaterialId) && this.mesh.materials.get(this.addedMaterialId) !== this.materialInstance) {
         this.originalMaterialIfReplaced = this.mesh.materials.get(this.addedMaterialId)!;
      }
      this.mesh.materials.set(this.addedMaterialId, this.materialInstance);
    } else {
      console.error('AddMaterial.execute: No material instance or options provided.');
      return;
    }
  }

  undo(): void {
    if (this.addedMaterialId !== -1) {
      // Check if the material at the stored ID is indeed the one we added.
      // This is a safety check, especially if other operations could modify the materials map.
      if (this.mesh.materials.has(this.addedMaterialId) && this.mesh.materials.get(this.addedMaterialId) === this.materialInstance) {
        this.mesh.materials.delete(this.addedMaterialId);
        
        // Important: If any faces were using this material ID, they now point to an invalid (or different) material.
        // A more robust undo might need to find such faces and reset their material ID (e.g., to null or a default).
        // For now, this command only handles adding/removing from the list.
        // The `AssignMaterialToFaces` command would be used to fix assignments.
        // Alternatively, the mesh could have a method like `cleanInvalidMaterialIndices()`
        // that could be called after such operations.
        this.mesh.cleanMaterialIndices(); // Call the existing utility to clean up references

        if (this.originalMaterialIfReplaced) {
          this.mesh.materials.set(this.addedMaterialId, this.originalMaterialIfReplaced);
        }
      } else {
        console.warn(`AddMaterial.undo: Material at ID ${this.addedMaterialId} is not the one added by this command. Undo might be incorrect.`);
        // Attempt to remove by object instance if the ID is wrong but object exists elsewhere (less likely for simple add/remove)
        // This case (material not found by ID but instance matches another) should be rare if IDs are unique.
        // However, if it occurs, it implies a complex state. For now, log a warning.
        console.warn(`AddMaterial.undo: Material with ID ${this.addedMaterialId} was expected but not found, or instance mismatch.`);
      }
      // this.addedMaterialId = -1; // Keep for re-execution, or reset if command is single-use.
      // For now, let's assume it can be re-executed, so don't reset addedMaterialId.
      // If originalMaterialIfReplaced was used, it's already nulled in the if block.
    } else if (this.addedMaterialId === -1) { // Check if ID was never set (execute didn't run properly)
      console.warn("AddMaterial.undo: No material ID recorded. Execute might not have been called or was ineffective.");
    }
    // If originalMaterialIfReplaced was set and used, it's cleared. If not used, it remains null.
  }
}
