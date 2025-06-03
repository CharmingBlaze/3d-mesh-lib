import { Mesh } from './Mesh';
import { ICommand } from './ICommand';
import { Vector2D } from '@/utils/Vector2D';

interface OriginalUVState {
  vertexId: number;
  uv: { u: number; v: number };
}

/**
 * Command to scale the UV coordinates of specified vertices around a pivot point.
 */
export class ScaleVertexUVs implements ICommand {
  private mesh: Mesh;
  private vertexIds: number[];
  private scaleFactor: Vector2D;
  private pivotUV: Vector2D;
  private originalUVs: OriginalUVState[] = [];
  public readonly description: string;

  /**
   * Creates an instance of ScaleVertexUVs command.
   * @param mesh - The mesh containing the vertices.
   * @param vertexIds - An array of IDs of the vertices whose UVs are to be scaled.
   * @param scaleFactor - The 2D vector representing the scaling factors (scaleU, scaleV).
   * @param pivotUV - The 2D pivot point for scaling. Defaults to (0,0) if not provided.
   */
  constructor(mesh: Mesh, vertexIds: number[], scaleFactor: Vector2D, pivotUV?: Vector2D) {
    this.mesh = mesh;
    this.vertexIds = [...vertexIds]; // Store a copy
    this.scaleFactor = scaleFactor.clone(); // Store a copy
    this.pivotUV = pivotUV?.clone() ?? new Vector2D(0, 0); // Default pivot to (0,0)
    this.description = `Scale UVs for ${vertexIds.length} vertex/vertices by (${scaleFactor.x.toFixed(3)}, ${scaleFactor.y.toFixed(3)}) around (${this.pivotUV.x.toFixed(3)}, ${this.pivotUV.y.toFixed(3)})`;
  }

  execute(): void {
    this.originalUVs = []; // Clear previous state if re-executing
    for (const vertexId of this.vertexIds) {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex && vertex.uv) {
        // Store original UVs before modification
        this.originalUVs.push({ vertexId, uv: { ...vertex.uv } });

        // Apply scaling relative to the pivot
        const u = vertex.uv.u;
        const v = vertex.uv.v;

        vertex.uv.u = this.pivotUV.x + (u - this.pivotUV.x) * this.scaleFactor.x;
        vertex.uv.v = this.pivotUV.y + (v - this.pivotUV.y) * this.scaleFactor.y;
      } else if (vertex && !vertex.uv) {
        console.warn(`ScaleVertexUVs.execute: Vertex ID ${vertexId} has no UV coordinates to scale. Skipping.`);
      } else {
        console.warn(`ScaleVertexUVs.execute: Vertex ID ${vertexId} not found in mesh. Skipping.`);
      }
    }
  }

  undo(): void {
    if (this.originalUVs.length === 0) {
      console.warn("ScaleVertexUVs.undo: No original UVs recorded. Undo might be ineffective.");
      return;
    }

    for (const state of this.originalUVs) {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        vertex.uv = { ...state.uv }; 
      } else {
        console.warn(`ScaleVertexUVs.undo: Vertex ID ${state.vertexId} not found in mesh. Cannot restore UVs.`);
      }
    }
    this.originalUVs = []; // Clear stored state after undo
  }
}
