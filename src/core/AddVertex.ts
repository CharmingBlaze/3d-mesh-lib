import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vector3D } from '@/utils/Vector3D';

export interface AddVertexCommandParams {
  x: number;
  y: number;
  z: number;
  normal?: Vector3D;
  uv?: { u: number; v: number };
}

export class AddVertexCommand implements ICommand {
  private mesh: Mesh;
  private params: AddVertexCommandParams;
  private createdVertexId: number | null = null;
  public description: string;

  constructor(mesh: Mesh, params: AddVertexCommandParams, description?: string) {
    this.mesh = mesh;
    this.params = params;
    this.description = description || `Add Vertex (${params.x.toFixed(2)}, ${params.y.toFixed(2)}, ${params.z.toFixed(2)})`;
  }

  execute(): void {
    const newVertex = this.mesh.addVertex(
      this.params.x,
      this.params.y,
      this.params.z,
      this.params.normal ? this.params.normal.clone() : undefined,
      this.params.uv ? { ...this.params.uv } : undefined
    );
    this.createdVertexId = newVertex.id;
    // Note: Mesh.addVertex already calls computeBoundingBox if necessary
  }

  undo(): void {
    if (this.createdVertexId !== null) {
      const success = this.mesh.removeVertex(this.createdVertexId);
      if (!success) {
        console.warn(`AddVertexCommand.undo: Failed to remove vertex with ID ${this.createdVertexId}. It might have been removed by another operation.`);
      }
      this.createdVertexId = null;
      // Note: Mesh.removeVertex already calls computeBoundingBox if necessary
    } else {
      console.warn('AddVertexCommand.undo: No vertex ID to remove. Execute might not have been called or failed.');
    }
  }
}
