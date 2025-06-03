import { ICommand } from './ICommand';
import { Mesh } from './Mesh';

export interface AddFaceCommandParams {
  vertexIds: number[];
  materialId?: number;
}

export class AddFaceCommand implements ICommand {
  private mesh: Mesh;
  private params: AddFaceCommandParams;
  private createdFaceId: number | null = null;
  public description: string;

  constructor(mesh: Mesh, params: AddFaceCommandParams, description?: string) {
    this.mesh = mesh;
    this.params = params;
    this.description = description || `Add Face (${params.vertexIds.join(', ')})`;
  }

  execute(): void {
    try {
      const newFace = this.mesh.addFace(this.params.vertexIds, this.params.materialId);
      this.createdFaceId = newFace.id;
      // Mesh.addFace handles bounding box updates and edge creation/linking.
    } catch (error) {
      console.error('AddFaceCommand.execute: Failed to add face.', error);
      // If execute fails, we shouldn't be able to undo, so ensure createdFaceId is null.
      this.createdFaceId = null;
      // Optionally re-throw or handle more gracefully depending on application needs.
      throw error;
    }
  }

  undo(): void {
    if (this.createdFaceId !== null) {
      const success = this.mesh.removeFace(this.createdFaceId);
      if (!success) {
        console.warn(`AddFaceCommand.undo: Failed to remove face with ID ${this.createdFaceId}. It might have been removed by another operation.`);
      }
      this.createdFaceId = null;
      // Mesh.removeFace handles bounding box updates and edge updates.
    } else {
      console.warn('AddFaceCommand.undo: No face ID to remove. Execute might not have been called or failed.');
    }
  }
}
