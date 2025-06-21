import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import type { Face } from './Face'; // For type, though Mesh methods return it

interface TriangulationUndoState {
  originalFaceId: number; // For reference, though it's removed
  originalVertexIds: number[];
  originalMaterialId: number | null;
  newlyCreatedTriangleIds: number[];
}

export class TriangulateFaces implements ICommand {
  private mesh: Mesh;
  private faceIdsToTriangulate: number[];
  private undoStates: TriangulationUndoState[] = [];
  public readonly description: string;

  constructor(mesh: Mesh, faceIds: number[], description?: string) {
    this.mesh = mesh;
    this.faceIdsToTriangulate = [...faceIds];
    this.description = description || `Triangulate ${faceIds.length} face${faceIds.length === 1 ? '' : 's'}`;
  }

  execute(): void {
    this.undoStates = []; // Clear previous undo states

    for (const faceId of this.faceIdsToTriangulate) {
      const originalFace = this.mesh.getFace(faceId);

      if (!originalFace) {
        console.warn(`TriangulateFaces: Original face with ID ${faceId} not found.`);
        continue;
      }

      if (originalFace.vertices.length <= 3) {
        // Already a triangle or invalid, skip
        console.log(`TriangulateFaces: Face ${faceId} is already a triangle or has too few vertices, skipping.`);
        continue;
      }

      const originalVertexIds = originalFace.vertices.map(v => v.id);
      const originalMaterialId = originalFace.materialIndex;
      const newlyCreatedTriangleIds: number[] = [];

      const v0_id = originalFace.vertices[0].id;

      // Fan triangulation
      for (let i = 1; i < originalFace.vertices.length - 1; i++) {
        const v_i_id = originalFace.vertices[i].id;
        const v_i_plus_1_id = originalFace.vertices[i + 1].id;
        
        const newTriangle = this.mesh.addFace(
          [v0_id, v_i_id, v_i_plus_1_id],
          originalMaterialId === null ? undefined : originalMaterialId
        );

        if (newTriangle) {
          newlyCreatedTriangleIds.push(newTriangle.id);
        } else {
          console.error(`TriangulateFaces: Failed to create triangle for face ${faceId}.`);
          // If a triangle fails, we might have a partial triangulation.
          // This needs robust error handling: either revert changes for this face or stop.
          // For now, log error and continue, which might leave mesh in intermediate state for this face.
        }
      }

      // If all triangles were created successfully (or if we proceed despite errors)
      if (newlyCreatedTriangleIds.length === originalFace.vertices.length - 2) {
        const removed = this.mesh.removeFace(faceId);
        if (!removed) {
          console.error(`TriangulateFaces: Failed to remove original face ${faceId} after triangulation.`);
          // This is problematic. The original face might still exist alongside new triangles.
        }
        this.undoStates.push({
          originalFaceId: faceId,
          originalVertexIds,
          originalMaterialId,
          newlyCreatedTriangleIds,
        });
      } else {
        // Not all triangles created, attempt to clean up any new triangles for this original face
        console.warn(`TriangulateFaces: Not all triangles created for face ${faceId}. Attempting to remove partial triangles.`);
        for (const newTriId of newlyCreatedTriangleIds) {
          this.mesh.removeFace(newTriId);
        }
        // Do not add to undoStates as the operation for this face was not fully successful
      }
    }
  }

  undo(): void {
    if (this.undoStates.length === 0) {
      return;
    }

    // Iterate in reverse to handle potential ID changes or dependencies better, though less critical here.
    for (let i = this.undoStates.length - 1; i >= 0; i--) {
      const state = this.undoStates[i];
      
      // Remove the newly created triangles
      for (const triangleId of state.newlyCreatedTriangleIds) {
        const removed = this.mesh.removeFace(triangleId);
        if (!removed) {
          console.warn(`TriangulateFaces (undo): Failed to remove triangle ${triangleId}.`);
        }
      }

      // Re-add the original face
      // Note: This will create a face with a new ID.
      const restoredFace = this.mesh.addFace(state.originalVertexIds, state.originalMaterialId === null ? undefined : state.originalMaterialId);
      if (!restoredFace) {
        console.error(`TriangulateFaces (undo): Failed to restore original face (was ID ${state.originalFaceId}).`);
      }
    }

    this.undoStates = []; // Clear undo states after processing
  }
}
