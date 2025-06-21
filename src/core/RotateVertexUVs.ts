import { Mesh } from './Mesh';
import { ICommand } from './ICommand';
import { Vector2D } from '@/utils/Vector2D';

interface OriginalUVState {
  vertexId: number;
  uv: { u: number; v: number };
}

/**
 * Command to rotate the UV coordinates of specified vertices around a pivot point.
 */
export class RotateVertexUVs implements ICommand {
  private mesh: Mesh;
  private vertexIds: number[];
  private rotationAngle: number; // In radians
  private pivotUV: Vector2D;
  private originalUVs: OriginalUVState[] = [];
  public readonly description: string;

  /**
   * Creates an instance of RotateVertexUVs command.
   * @param mesh - The mesh containing the vertices.
   * @param vertexIds - An array of IDs of the vertices whose UVs are to be rotated.
   * @param rotationAngle - The angle of rotation in radians.
   * @param pivotUV - The 2D pivot point for rotation. Defaults to (0,0) if not provided.
   */
  constructor(mesh: Mesh, vertexIds: number[], rotationAngle: number, pivotUV?: Vector2D) {
    this.mesh = mesh;
    this.vertexIds = [...vertexIds]; // Store a copy
    this.rotationAngle = rotationAngle;
    this.pivotUV = pivotUV?.clone() ?? new Vector2D(0, 0); // Default pivot to (0,0)
    const angleDeg = (rotationAngle * 180 / Math.PI).toFixed(2);
    this.description = `Rotate UVs for ${vertexIds.length} vertex/vertices by ${angleDeg}° around (${this.pivotUV.x.toFixed(3)}, ${this.pivotUV.y.toFixed(3)})`;
  }

  execute(): void {
    this.originalUVs = []; // Clear previous state if re-executing
    const cosAngle = Math.cos(this.rotationAngle);
    const sinAngle = Math.sin(this.rotationAngle);

    for (const vertexId of this.vertexIds) {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex && vertex.uv) {
        // Store original UVs before modification
        this.originalUVs.push({ vertexId, uv: { ...vertex.uv } });

        // Translate UV to origin relative to pivot
        const uTranslated = vertex.uv.u - this.pivotUV.x;
        const vTranslated = vertex.uv.v - this.pivotUV.y;

        // Rotate
        const uRotated = uTranslated * cosAngle - vTranslated * sinAngle;
        const vRotated = uTranslated * sinAngle + vTranslated * cosAngle;

        // Translate back to pivot
        vertex.uv.u = uRotated + this.pivotUV.x;
        vertex.uv.v = vRotated + this.pivotUV.y;
      } else if (vertex && !vertex.uv) {
        console.warn(`RotateVertexUVs.execute: Vertex ID ${vertexId} has no UV coordinates to rotate. Skipping.`);
      } else {
        console.warn(`RotateVertexUVs.execute: Vertex ID ${vertexId} not found in mesh. Skipping.`);
      }
    }
  }

  undo(): void {
    if (this.originalUVs.length === 0) {
      console.warn("RotateVertexUVs.undo: No original UVs recorded. Undo might be ineffective.");
      return;
    }

    for (const state of this.originalUVs) {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        vertex.uv = { ...state.uv }; 
      } else {
        console.warn(`RotateVertexUVs.undo: Vertex ID ${state.vertexId} not found in mesh. Cannot restore UVs.`);
      }
    }
    this.originalUVs = []; // Clear stored state after undo
  }
}
