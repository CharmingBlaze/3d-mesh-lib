import { Mesh } from './Mesh';
import { ICommand } from './ICommand';

interface OriginalUVState {
  vertexId: number;
  uv: { u: number; v: number } | null;
}

/**
 * Command to intelligently unwrap UV coordinates for a mesh using angle-based projection.
 */
export class SmartUnwrapUVs implements ICommand {
  private mesh: Mesh;
  private options: {
    scaleUVs?: number;
    offsetU?: number;
    offsetV?: number;
    normalizeToUnitSquare?: boolean;
    preferredAxis?: 'x' | 'y' | 'z' | 'auto';
  };
  private originalUVs: OriginalUVState[] = [];
  public readonly description: string;

  /**
   * Creates an instance of SmartUnwrapUVs command.
   * @param mesh - The mesh to unwrap UV coordinates for.
   * @param options - Optional parameters for UV unwrapping.
   */
  constructor(
    mesh: Mesh, 
    options: {
      scaleUVs?: number;
      offsetU?: number;
      offsetV?: number;
      normalizeToUnitSquare?: boolean;
      preferredAxis?: 'x' | 'y' | 'z' | 'auto';
    } = {}
  ) {
    this.mesh = mesh;
    this.options = { ...options };
    
    const axis = options.preferredAxis || 'auto';
    const scale = options.scaleUVs || 1.0;
    this.description = `Smart UV unwrap with ${axis} projection and ${scale}x scale for ${mesh.vertices.size} vertices`;
  }

  execute(): void {
    this.originalUVs = []; // Clear previous state if re-executing
    
    // Store original UV coordinates for undo
    this.mesh.vertices.forEach(vertex => {
      this.originalUVs.push({
        vertexId: vertex.id,
        uv: vertex.uv ? { ...vertex.uv } : null
      });
    });

    // Execute the smart unwrap using the mesh's public method
    this.mesh.smartUnwrapUVs(this.options);
  }

  undo(): void {
    if (this.originalUVs.length === 0) {
      console.warn("SmartUnwrapUVs.undo: No original UVs recorded. Undo might be ineffective.");
      return;
    }

    // Restore original UV coordinates
    for (const state of this.originalUVs) {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        vertex.uv = state.uv ? { ...state.uv } : null;
      } else {
        console.warn(`SmartUnwrapUVs.undo: Vertex ID ${state.vertexId} not found in mesh. Cannot restore UVs.`);
      }
    }
    
    this.originalUVs = []; // Clear stored state after undo
  }
} 