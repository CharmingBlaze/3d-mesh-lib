import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vector3D } from '@/utils/Vector3D';
// Vertex class might be implicitly used via mesh.getVertex() returning its type

interface OriginalNormalState {
  vertexId: number;
  normal: Vector3D | null;
}

export class SetVertexNormal implements ICommand {
  private mesh: Mesh;
  private vertexIds: number[];
  private newNormal: Vector3D;
  private originalNormals: OriginalNormalState[] = [];
  public readonly description: string;

  constructor(mesh: Mesh, vertexIds: number[], newNormal: Vector3D, description?: string) {
    this.mesh = mesh;
    this.vertexIds = [...vertexIds]; // Store a copy
    this.newNormal = newNormal.clone(); // Store a clone to prevent external modification
    this.description = description || `Set normal for ${vertexIds.length} vertex${vertexIds.length === 1 ? '' : 'es'}`;
  }

  execute(): void {
    this.originalNormals = []; // Clear previous state if re-executing

    for (const vertexId of this.vertexIds) {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex) {
        this.originalNormals.push({
          vertexId,
          normal: vertex.normal ? vertex.normal.clone() : null,
        });
        vertex.normal = this.newNormal.clone();
      } else {
        console.warn(`SetVertexNormal: Vertex with ID ${vertexId} not found.`);
      }
    }
  }

  undo(): void {
    if (this.originalNormals.length === 0) {
      // This can happen if execute wasn't called or found no vertices
      // Or if undo was already called.
      // console.warn("SetVertexNormal: Nothing to undo or undo already performed.");
      return;
    }

    for (const state of this.originalNormals) {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        vertex.normal = state.normal ? state.normal.clone() : null;
      } else {
        // This case should ideally not happen if execute found the vertex
        console.warn(`SetVertexNormal (undo): Vertex with ID ${state.vertexId} not found during undo.`);
      }
    }
    // Clear state after undo to prevent re-undoing without re-executing
    this.originalNormals = [];
  }
}
