import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vector3D } from '@/utils/Vector3D';

interface OriginalNormalState {
  vertexId: number;
  normal: Vector3D; // We only store if it's non-null
}

export class FlipVertexNormals implements ICommand {
  private mesh: Mesh;
  private vertexIds: number[];
  private originalNormals: OriginalNormalState[] = []; // Stores original normals of vertices that were actually flipped
  public readonly description: string;

  constructor(mesh: Mesh, vertexIds: number[], description?: string) {
    this.mesh = mesh;
    this.vertexIds = [...vertexIds];
    this.description = description || `Flip normals for ${vertexIds.length} vertex${vertexIds.length === 1 ? '' : 'es'}`;
  }

  execute(): void {
    this.originalNormals = []; // Clear previous state

    for (const vertexId of this.vertexIds) {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex) {
        if (vertex.normal) {
          // Store a clone of the original normal before negating
          this.originalNormals.push({
            vertexId,
            normal: vertex.normal.clone(),
          });
          vertex.normal.negate(); // Negate in-place
        } else {
          console.warn(`FlipVertexNormals: Vertex with ID ${vertexId} has no normal to flip.`);
        }
      } else {
        console.warn(`FlipVertexNormals: Vertex with ID ${vertexId} not found.`);
      }
    }
  }

  undo(): void {
    if (this.originalNormals.length === 0) {
      return; // Nothing was flipped or undo already performed
    }

    for (const state of this.originalNormals) {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        // Restore the original normal. 
        // If vertex.normal was somehow set to null after execute, this restores it.
        // If it was modified, this also restores it to pre-execute state.
        vertex.normal = state.normal.clone(); // Restore a clone of the original
      } else {
        console.warn(`FlipVertexNormals (undo): Vertex with ID ${state.vertexId} not found.`);
      }
    }
    this.originalNormals = []; // Clear state after undo
  }
}
