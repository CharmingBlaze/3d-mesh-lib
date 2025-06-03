import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vector3D } from '@/utils/Vector3D';


interface SubdivisionUndoState {
  originalFaceId: number;
  originalVertexIds: number[];
  originalMaterialId: number | null;
  centroidVertexId: number | null; // ID of the new vertex created at the centroid
  newTriangleFaceIds: number[]; // IDs of the new triangular faces
}

export class SubdivideFaces implements ICommand {
  private mesh: Mesh;
  private faceIdsToSubdivide: number[];
  private undoStates: SubdivisionUndoState[] = [];
  public readonly description: string;

  constructor(mesh: Mesh, faceIds: number[], description?: string) {
    this.mesh = mesh;
    this.faceIdsToSubdivide = [...faceIds];
    this.description = description || `Subdivide ${faceIds.length} face${faceIds.length === 1 ? '' : 's'}`;
  }

  execute(): void {
    this.undoStates = [];

    for (const faceId of this.faceIdsToSubdivide) {
      const originalFace = this.mesh.getFace(faceId);
      if (!originalFace) {
        console.warn(`SubdivideFaces: Face with ID ${faceId} not found.`);
        continue;
      }
      if (originalFace.vertices.length < 3) {
        console.warn(`SubdivideFaces: Face ${faceId} has less than 3 vertices, cannot subdivide.`);
        continue;
      }

      const currentUndoState: SubdivisionUndoState = {
        originalFaceId: faceId,
        originalVertexIds: originalFace.vertices.map(v => v.id),
        originalMaterialId: originalFace.materialIndex,
        centroidVertexId: null,
        newTriangleFaceIds: [],
      };

      // 1. Calculate centroid and add new vertex
      const centroidPos = new Vector3D(0, 0, 0);
      let averageUV = { u: 0, v: 0 };
      let hasUVs = false;
      originalFace.vertices.forEach(v => {
        centroidPos.add(v.position);
        if (v.uv) {
          averageUV.u += v.uv.u;
          averageUV.v += v.uv.v;
          hasUVs = true;
        }
      });
      centroidPos.divideScalar(originalFace.vertices.length);
      if (hasUVs) {
        averageUV.u /= originalFace.vertices.length;
        averageUV.v /= originalFace.vertices.length;
      }

      const centroidVertex = this.mesh.addVertex(
        centroidPos.x, centroidPos.y, centroidPos.z,
        originalFace.normal ? originalFace.normal.clone() : undefined, // Use face normal for new vertex
        hasUVs ? averageUV : undefined
      );

      if (!centroidVertex) {
        console.error(`SubdivideFaces: Failed to create centroid vertex for face ${faceId}. Skipping.`);
        continue;
      }
      currentUndoState.centroidVertexId = centroidVertex.id;

      // 2. Remove original face
      const removedOriginal = this.mesh.removeFace(faceId);
      if (!removedOriginal) {
        console.error(`SubdivideFaces: Failed to remove original face ${faceId}. Cleaning up centroid vertex and skipping.`);
        this.mesh.removeVertex(centroidVertex.id); // Cleanup
        currentUndoState.centroidVertexId = null;
        continue;
      }

      // 3. Create new triangular faces
      const originalVertices = originalFace.vertices; // Vertices in order
      let allTrianglesCreated = true;
      for (let i = 0; i < originalVertices.length; i++) {
        const v0_id = originalVertices[i].id;
        const v1_id = originalVertices[(i + 1) % originalVertices.length].id;
        
        const triangleVertexIds = [v0_id, v1_id, centroidVertex.id];
        const newTriangle = this.mesh.addFace(triangleVertexIds, currentUndoState.originalMaterialId === null ? undefined : currentUndoState.originalMaterialId);

        if (newTriangle) {
          currentUndoState.newTriangleFaceIds.push(newTriangle.id);
        } else {
          console.error(`SubdivideFaces: Failed to create triangle for face ${faceId} using edge ${v0_id}-${v1_id}.`);
          allTrianglesCreated = false;
          break; // Stop creating triangles for this face
        }
      }

      if (allTrianglesCreated) {
        this.undoStates.push(currentUndoState);
      } else {
        // Rollback: remove already created triangles, remove centroid, re-add original face
        console.warn(`SubdivideFaces: Rollback due to triangle creation failure for face ${faceId}.`);
        currentUndoState.newTriangleFaceIds.forEach(triId => this.mesh.removeFace(triId));
        if (currentUndoState.centroidVertexId) this.mesh.removeVertex(currentUndoState.centroidVertexId);
        this.mesh.addFace(currentUndoState.originalVertexIds, currentUndoState.originalMaterialId === null ? undefined : currentUndoState.originalMaterialId); // Try to restore
      }
    }
  }

  undo(): void {
    if (this.undoStates.length === 0) return;

    for (let i = this.undoStates.length - 1; i >= 0; i--) {
      const state = this.undoStates[i];

      // Remove new triangles
      for (const triangleId of state.newTriangleFaceIds) {
        this.mesh.removeFace(triangleId);
      }

      // Remove centroid vertex
      if (state.centroidVertexId !== null) {
        this.mesh.removeVertex(state.centroidVertexId);
      }

      // Re-add original face
      const restoredFace = this.mesh.addFace(state.originalVertexIds, state.originalMaterialId === null ? undefined : state.originalMaterialId);
      if (!restoredFace) {
        console.error(`SubdivideFaces (undo): Failed to restore original face (was ID ${state.originalFaceId}).`);
      }
    }
    this.undoStates = [];
  }
}
