import { Mesh } from './Mesh';
import { ICommand } from './ICommand';
import { Vector2D } from '@/utils/Vector2D';

interface OriginalUVState {
  vertexId: number;
  uv: { u: number; v: number };
}

/**
 * Command to translate (move) the UV coordinates of specified vertices.
 */
export class TranslateVertexUVs implements ICommand {
  private mesh: Mesh;
  private vertexIds: number[];
  private translation: Vector2D;
  private originalUVs: OriginalUVState[] = [];
  public readonly description: string;

  /**
   * Creates an instance of TranslateVertexUVs command.
   * @param mesh - The mesh containing the vertices.
   * @param vertexIds - An array of IDs of the vertices whose UVs are to be translated.
   * @param translation - The 2D vector representing the translation (du, dv).
   */
  constructor(mesh: Mesh, vertexIds: number[], translation: Vector2D) {
    this.mesh = mesh;
    this.vertexIds = [...vertexIds]; // Store a copy
    this.translation = translation.clone(); // Store a copy
    this.description = `Translate UVs for ${vertexIds.length} vertex/vertices by (${translation.x.toFixed(3)}, ${translation.y.toFixed(3)})`;
  }

  execute(): void {
    this.originalUVs = []; // Clear previous state if re-executing
    for (const vertexId of this.vertexIds) {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex && vertex.uv) {
        // Store original UVs before modification
        this.originalUVs.push({ vertexId, uv: { ...vertex.uv } });

        // Apply translation
        vertex.uv.u += this.translation.x;
        vertex.uv.v += this.translation.y;
      } else if (vertex && !vertex.uv) {
        // Optionally, initialize UVs to (0,0) then translate, or warn/skip
        console.warn(`TranslateVertexUVs.execute: Vertex ID ${vertexId} has no UV coordinates to translate. Skipping.`);
      } else {
        console.warn(`TranslateVertexUVs.execute: Vertex ID ${vertexId} not found in mesh. Skipping.`);
      }
    }
    // UV changes do not affect mesh geometry/bounding box, so no recalculation needed here.
  }

  undo(): void {
    if (this.originalUVs.length === 0) {
      console.warn("TranslateVertexUVs.undo: No original UVs recorded. Undo might be ineffective.");
      return;
    }

    for (const state of this.originalUVs) {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        // Restore original UVs
        // If vertex.uv was null when execute was called (and we chose to initialize it then),
        // this restore might set it back to a value. If it should be null, logic needs adjustment.
        // Based on current execute, we only operate if vertex.uv exists.
        vertex.uv = { ...state.uv }; 
      } else {
        console.warn(`TranslateVertexUVs.undo: Vertex ID ${state.vertexId} not found in mesh. Cannot restore UVs.`);
      }
    }
    this.originalUVs = []; // Clear stored state after undo
  }
}
