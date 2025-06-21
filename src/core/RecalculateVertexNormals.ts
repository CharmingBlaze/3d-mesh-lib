import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vector3D } from '@/utils/Vector3D';

interface OriginalNormalState {
  vertexId: number;
  normal: Vector3D | null;
}

export class RecalculateVertexNormals implements ICommand {
  private mesh: Mesh;
  private targetVertexIds: number[]; // IDs of vertices to process
  private originalNormals: OriginalNormalState[] = [];
  public readonly description: string;
  private operateOnAllVertices: boolean;

  constructor(mesh: Mesh, vertexIds?: number[], description?: string) {
    this.mesh = mesh;
    this.operateOnAllVertices = !vertexIds || vertexIds.length === 0;
    this.targetVertexIds = this.operateOnAllVertices ? [] : [...vertexIds!];
    
    if (description) {
      this.description = description;
    } else {
      if (this.operateOnAllVertices) {
        this.description = 'Recalculate normals for all vertices';
      } else {
        this.description = `Recalculate normals for ${this.targetVertexIds.length} vertex${this.targetVertexIds.length === 1 ? '' : 'es'}`;
      }
    }
  }

  execute(): void {
    this.originalNormals = []; // Clear previous state

    const vertexIdsToProcess = this.operateOnAllVertices 
      ? Array.from(this.mesh.vertices.keys()) 
      : this.targetVertexIds;

    if (this.operateOnAllVertices) {
        // Update targetVertexIds if we are operating on all, so undo knows who was affected.
        this.targetVertexIds = [...vertexIdsToProcess];
    }

    for (const vertexId of vertexIdsToProcess) {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) {
        console.warn(`RecalculateVertexNormals: Vertex with ID ${vertexId} not found.`);
        continue;
      }

      this.originalNormals.push({
        vertexId,
        normal: vertex.normal ? vertex.normal.clone() : null,
      });

      const sumFaceNormals = new Vector3D(0, 0, 0);
      let contributingFaces = 0;

      for (const faceId of vertex.faces) {
        const face = this.mesh.getFace(faceId);
        if (face && face.normal) {
          sumFaceNormals.add(face.normal);
          contributingFaces++;
        }
      }

      if (contributingFaces > 0) {
        // Normalize the sum to get the average normal
        // Vector3D.add modifies in place, so clone if sumFaceNormals is reused or if normalize modifies in place and you need original sum.
        // Current Vector3D.normalize() returns a new Vector3D, so direct assignment is fine.
        vertex.normal = sumFaceNormals.normalize(); 
      } else {
        // No contributing faces, or all contributing faces had null normals
        vertex.normal = null; // Or a default, e.g., new Vector3D(0, 0, 1), or keep original.
                               // Setting to null if no geometric info is available.
      }
    }
  }

  undo(): void {
    if (this.originalNormals.length === 0) {
      return;
    }

    for (const state of this.originalNormals) {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        vertex.normal = state.normal ? state.normal.clone() : null;
      } else {
        console.warn(`RecalculateVertexNormals (undo): Vertex with ID ${state.vertexId} not found.`);
      }
    }
    this.originalNormals = [];
  }
}
