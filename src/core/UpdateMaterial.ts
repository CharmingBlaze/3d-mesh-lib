import { Mesh } from './Mesh';
import { Material, MaterialOptions, TextureInput } from './Material';
import { ICommand } from './ICommand';
import { Texture, TextureOptions as CoreTextureOptions } from './Texture';

// Define a type for the serialized original material state for clarity
type SerializedMaterialState = ReturnType<Material['toJSON']>;

/**
 * Command to update properties of an existing material in a mesh's material list.
 */
export class UpdateMaterial implements ICommand {
  private mesh: Mesh;
  private materialIdToUpdate: number;
  private newOptions: Partial<MaterialOptions>;
  private originalMaterialJSON: SerializedMaterialState | null = null;
  public readonly description: string;

  constructor(mesh: Mesh, materialIdToUpdate: number, newOptions: Partial<MaterialOptions>) {
    this.mesh = mesh;
    this.materialIdToUpdate = materialIdToUpdate;
    this.newOptions = { ...newOptions }; // Store a copy of the options

    const material = this.mesh.materials.get(this.materialIdToUpdate);
    let matName = 'Invalid Material / ID Not Found';
    if (material) {
      matName = material.name || 'Unnamed Material';
    }
    this.description = `Update Material (ID: ${this.materialIdToUpdate}, Name: ${matName})`;
  }

  private _createTextureFromInput(input?: TextureInput | null): Texture | null {
    if (!input) return null;
    if (input instanceof Texture) {
      return input.clone(); // Clone to ensure the command/material owns its instance
    }
    if (typeof input === 'string') {
      return new Texture(input);
    }
    // Assuming it's CoreTextureOptions
    const source = input.source || '';
    return new Texture(source, input as CoreTextureOptions);
  }

  execute(): void {
    const materialToUpdate = this.mesh.materials.get(this.materialIdToUpdate);

    if (!materialToUpdate) {
      console.warn(`UpdateMaterial.execute: Material with ID ${this.materialIdToUpdate} not found. No material updated.`);
      this.originalMaterialJSON = null;
      return;
    }

    this.originalMaterialJSON = materialToUpdate.toJSON(); // Store original state

    // Apply new options (name is not part of MaterialOptions and should not be updated here)
    if (this.newOptions.color !== undefined) materialToUpdate.color = this.newOptions.color.clone();
    if (this.newOptions.emissiveColor !== undefined) materialToUpdate.emissiveColor = this.newOptions.emissiveColor.clone();
    if (this.newOptions.opacity !== undefined) materialToUpdate.opacity = this.newOptions.opacity;
    if (this.newOptions.transparent !== undefined) materialToUpdate.transparent = this.newOptions.transparent;
    if (this.newOptions.metallic !== undefined) materialToUpdate.metallic = this.newOptions.metallic;
    if (this.newOptions.roughness !== undefined) materialToUpdate.roughness = this.newOptions.roughness;
    if (this.newOptions.metadata !== undefined) materialToUpdate.metadata = JSON.parse(JSON.stringify(this.newOptions.metadata));

    // Handle texture updates
    if (this.newOptions.albedoTexture !== undefined) {
      materialToUpdate.albedoTexture?.dispose();
      materialToUpdate.albedoTexture = this._createTextureFromInput(this.newOptions.albedoTexture);
    }
    if (this.newOptions.metallicRoughnessTexture !== undefined) {
      materialToUpdate.metallicRoughnessTexture?.dispose();
      materialToUpdate.metallicRoughnessTexture = this._createTextureFromInput(this.newOptions.metallicRoughnessTexture);
    }
    if (this.newOptions.normalTexture !== undefined) {
      materialToUpdate.normalTexture?.dispose();
      materialToUpdate.normalTexture = this._createTextureFromInput(this.newOptions.normalTexture);
    }
    if (this.newOptions.occlusionTexture !== undefined) {
      materialToUpdate.occlusionTexture?.dispose();
      materialToUpdate.occlusionTexture = this._createTextureFromInput(this.newOptions.occlusionTexture);
    }
    if (this.newOptions.emissiveTexture !== undefined) {
      materialToUpdate.emissiveTexture?.dispose();
      materialToUpdate.emissiveTexture = this._createTextureFromInput(this.newOptions.emissiveTexture);
    }
  }

  undo(): void {
    if (!this.originalMaterialJSON) {
      console.warn("UpdateMaterial.undo: No original material state recorded. Cannot undo.");
      return;
    }

    const currentMaterial = this.mesh.materials.get(this.materialIdToUpdate);
    if (!currentMaterial) {
      // This could happen if the material was removed by another command after this command's execute
      console.warn(`UpdateMaterial.undo: Material with ID ${this.materialIdToUpdate} not found. Cannot restore material.`);
      this.originalMaterialJSON = null; // Prevent further undo attempts
      return;
    }

    // Dispose of textures that might have been created by the execute step on the current material instance
    currentMaterial.albedoTexture?.dispose();
    currentMaterial.metallicRoughnessTexture?.dispose();
    currentMaterial.normalTexture?.dispose();
    currentMaterial.occlusionTexture?.dispose();
    currentMaterial.emissiveTexture?.dispose();

    // Restore the material from the stored JSON.
    const restoredMaterial = Material.fromJSON(this.originalMaterialJSON);
    // The ID is set by fromJSON based on the originalMaterialJSON.id, which matches this.materialIdToUpdate
    this.mesh.materials.set(restoredMaterial.id, restoredMaterial);

    this.originalMaterialJSON = null; // Clear stored state
  }
}
