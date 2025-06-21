import { Mesh } from './Mesh';
import { ICommand } from './ICommand';

export interface VertexUVData {
  u: number;
  v: number;
}

/**
 * Command to set or update UV coordinates for specified vertices.
 */
export class SetVertexUVs implements ICommand {
  private readonly _mesh: Mesh;
  private readonly _newUVs: Map<number, VertexUVData>;
  private _originalUVs: Map<number, VertexUVData | null> = new Map();

  /**
   * Creates an instance of SetVertexUVs.
   * @param mesh The mesh containing the vertices.
   * @param vertexUVs A map where keys are vertex IDs and values are the new UV coordinates {u, v}.
   */
  constructor(mesh: Mesh, vertexUVs: Map<number, VertexUVData>) {
    this._mesh = mesh;
    // Clone the input map to prevent external modifications
    this._newUVs = new Map(vertexUVs);
  }

  execute(): void {
    this._originalUVs.clear(); // Clear previous undo state if any

    for (const [vertexId, newUv] of this._newUVs) {
      const vertex = this._mesh.getVertex(vertexId);
      if (vertex) {
        // Store the original UV, cloning if it exists, otherwise store null
        this._originalUVs.set(vertexId, vertex.uv ? { ...vertex.uv } : null);
        // Set the new UV, cloning the input to ensure it's a new object
        vertex.uv = { ...newUv };
      } else {
        console.warn(`SetVertexUVs: Vertex with ID ${vertexId} not found.`);
        // Store null for original UV if vertex not found, though this shouldn't happen if IDs are validated upstream
        this._originalUVs.set(vertexId, null); 
      }
    }
    // Note: Changing UVs does not affect the mesh's geometric bounding box.
    // No need to call this._mesh.computeBoundingBox();
  }

  undo(): void {
    for (const [vertexId, originalUv] of this._originalUVs) {
      const vertex = this._mesh.getVertex(vertexId);
      if (vertex) {
        // Restore the original UV, cloning if it was an object, otherwise set to null
        vertex.uv = originalUv ? { ...originalUv } : null;
      } else {
        // This case should ideally not be reached if execute handled it, 
        // but included for robustness if vertex was deleted post-execute.
        console.warn(`SetVertexUVs (undo): Vertex with ID ${vertexId} not found.`);
      }
    }
    // Clear the stored original UVs after undoing to free memory and prevent re-undo issues
    this._originalUVs.clear(); 
  }

  get description(): string {
    return `Set UV coordinates for ${this._newUVs.size} vertex/vertices.`;
  }
}
