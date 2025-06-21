import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vector3D } from '@/utils/Vector3D';

export class TranslateVerticesCommand implements ICommand {
  private mesh: Mesh;
  private vertexIds: number[];
  private translation: Vector3D;
  public description: string;

  constructor(mesh: Mesh, vertexIds: number[], translation: Vector3D, description?: string) {
    this.mesh = mesh;
    this.vertexIds = [...vertexIds]; // Store a copy
    this.translation = translation.clone(); // Store a clone
    this.description = description || `Translate Vertices (${vertexIds.length} vertices by ${translation.toString()})`;
  }

  execute(): void {
    let verticesMoved = 0;
    this.vertexIds.forEach(id => {
      const vertex = this.mesh.getVertex(id);
      if (vertex) {
        vertex.position.add(this.translation);
        verticesMoved++;
      }
    });

    if (verticesMoved > 0) {
      this.mesh.computeBoundingBox(); // Update bounding box after all vertices are moved
    }
  }

  undo(): void {
    let verticesReverted = 0;
    const inverseTranslation = this.translation.clone().negate();
    this.vertexIds.forEach(id => {
      const vertex = this.mesh.getVertex(id);
      if (vertex) {
        vertex.position.add(inverseTranslation);
        verticesReverted++;
      }
    });

    if (verticesReverted > 0) {
      this.mesh.computeBoundingBox(); // Update bounding box after reverting positions
    }
  }
}
