import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vector3D } from '@/utils/Vector3D';

/**
 * Command to mirror a set of vertices in a mesh across a defined plane.
 */
export class MirrorVerticesCommand implements ICommand {
  private _vertexIds: number[];
  private _planeNormal: Vector3D;
  private _planePoint: Vector3D;
  private originalPositions: Map<number, Vector3D> = new Map();

  public description: string;

  constructor(
    private mesh: Mesh,
    vertexIds: number[],
    planeNormal: Vector3D,
    planePoint: Vector3D
  ) {
    this._vertexIds = [...vertexIds];
    this._planeNormal = planeNormal.clone().normalize(); // Ensure normal is a unit vector
    this._planePoint = planePoint.clone();

    this.description = `Mirror ${this._vertexIds.length} vertice(s) across plane (normal: ${this._planeNormal.toString()}, point: ${this._planePoint.toString()})`;
  }

  execute(): void {
    this.originalPositions.clear();
    let mirroredSomething = false;

    for (const vertexId of this._vertexIds) {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex) {
        this.originalPositions.set(vertexId, vertex.position.clone());

        const P = vertex.position;
        const Q = this._planePoint;
        const N = this._planeNormal;

        const vecPQ = P.clone().subtract(Q);
        const dotProduct = vecPQ.dot(N);
        const reflectionVector = N.clone().multiplyScalar(2 * dotProduct);
        const newPosition = P.clone().subtract(reflectionVector);

        vertex.position.copy(newPosition);
        mirroredSomething = true;
      }
    }

    if (mirroredSomething) {
      this.mesh.computeBoundingBox();
    }
  }

  undo(): void {
    if (this.originalPositions.size === 0) {
      console.warn('MirrorVerticesCommand: No original positions stored for undo.');
      return;
    }

    let revertedSomething = false;
    for (const [vertexId, originalPos] of this.originalPositions) {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex) {
        vertex.position.copy(originalPos);
        revertedSomething = true;
      }
    }

    if (revertedSomething) {
      this.mesh.computeBoundingBox();
    }
    this.originalPositions.clear();
  }
}
