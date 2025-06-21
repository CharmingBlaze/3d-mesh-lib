import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vector3D } from '@/utils/Vector3D';


interface ExtrusionUndoState {
  originalFaceId: number; // ID of the face that was extruded
  originalVertexIds: number[];
  originalMaterialId: number | null;
  
  newlyCreatedVertexInfo: { id: number, originalId: number }[]; // IDs of vertices created by duplicating and moving
  extrudedCapFaceId: number | null; // ID of the new "top" face created after extrusion
  sideFaceIds: number[]; // IDs of all the new connecting side faces
}

export class ExtrudeFaces implements ICommand {
  private mesh: Mesh;
  private faceIdsToExtrude: number[];
  private extrusionDistance: number;
  private extrusionDirection: 'normal' | Vector3D; // 'normal' or a custom vector

  private undoStates: ExtrusionUndoState[] = [];
  public readonly description: string;

  constructor(
    mesh: Mesh, 
    faceIds: number[], 
    distance: number, 
    direction: 'normal' | Vector3D = 'normal', 
    description?: string
  ) {
    this.mesh = mesh;
    this.faceIdsToExtrude = [...faceIds];
    this.extrusionDistance = distance;
    this.extrusionDirection = direction;
    this.description = description || `Extrude ${faceIds.length} face${faceIds.length === 1 ? '' : 's'} by ${distance}`;
  }

  execute(): void {
    this.undoStates = [];

    for (const faceId of this.faceIdsToExtrude) {
      const originalFace = this.mesh.getFace(faceId);
      if (!originalFace) {
        console.warn(`ExtrudeFaces: Face with ID ${faceId} not found.`);
        continue;
      }

      if (originalFace.vertices.length < 3) {
        console.warn(`ExtrudeFaces: Face with ID ${faceId} has fewer than 3 vertices.`);
        continue;
      }

      let extrudeVector: Vector3D;
      if (this.extrusionDirection === 'normal') {
        if (!originalFace.normal) {
          console.warn(`ExtrudeFaces: Face ${faceId} has no normal. Cannot extrude along normal.`);
          // Fallback: attempt to calculate normal, or skip, or use a default
          // For now, if it's null, we might try to recalculate it or skip.
          // Let's try a quick recalculation for robustness, though ideally it should exist.
          const calculatedNormal = originalFace.calculateNormal();
          if (!calculatedNormal) {
            console.warn(`ExtrudeFaces: Could not calculate normal for face ${faceId}. Skipping extrusion.`);
            continue;
          }
          extrudeVector = calculatedNormal.clone().multiplyScalar(this.extrusionDistance);
        } else {
          extrudeVector = originalFace.normal.clone().multiplyScalar(this.extrusionDistance);
        }
      } else {
        extrudeVector = this.extrusionDirection.clone().normalize().multiplyScalar(this.extrusionDistance);
      }

      const currentUndoState: ExtrusionUndoState = {
        originalFaceId: faceId,
        originalVertexIds: originalFace.vertices.map(v => v.id),
        originalMaterialId: originalFace.materialIndex,
        newlyCreatedVertexInfo: [],
        extrudedCapFaceId: null,
        sideFaceIds: [],
      };

      const originalVertexObjects = originalFace.vertices;
      const newVertexIdMap = new Map<number, number>(); // Map from originalVertex.id to newClonedVertex.id

      // 1. Duplicate vertices and move them
      for (const originalVertex of originalVertexObjects) {
        const newPosition = originalVertex.position.clone().add(extrudeVector);
        // Normals and UVs for new vertices could be copied or recalculated.
        // Copying original normal and UV is a common starting point.
        const newVertex = this.mesh.addVertex(
          newPosition.x, newPosition.y, newPosition.z,
          originalVertex.normal ? originalVertex.normal.clone() : undefined,
          originalVertex.uv ? { ...originalVertex.uv } : undefined
        );
        if (newVertex) {
          currentUndoState.newlyCreatedVertexInfo.push({ id: newVertex.id, originalId: originalVertex.id });
          newVertexIdMap.set(originalVertex.id, newVertex.id);
        } else {
          console.error(`ExtrudeFaces: Failed to create new vertex for original vertex ${originalVertex.id} of face ${faceId}.`);
          // Abort extrusion for this face if a vertex fails
          // Cleanup any already created new vertices for this face before continuing to next faceId
          currentUndoState.newlyCreatedVertexInfo.forEach(vInfo => this.mesh.removeVertex(vInfo.id));
          continue; // to the next faceId
        }
      }
      
      // Check if all new vertices were created for this face
      if (currentUndoState.newlyCreatedVertexInfo.length !== originalVertexObjects.length) {
        console.error(`ExtrudeFaces: Vertex duplication failed for face ${faceId}. Cleaning up and skipping.`);
        currentUndoState.newlyCreatedVertexInfo.forEach(vInfo => this.mesh.removeVertex(vInfo.id));
        continue; // to the next faceId
      }

      const newCapVertexIds = originalVertexObjects.map(ov => newVertexIdMap.get(ov.id)!);

      // 2. Remove original face
      const removedOriginal = this.mesh.removeFace(faceId);
      if (!removedOriginal) {
        console.error(`ExtrudeFaces: Failed to remove original face ${faceId}. Aborting extrusion for this face.`);
        currentUndoState.newlyCreatedVertexInfo.forEach(vInfo => this.mesh.removeVertex(vInfo.id));
        continue; // to the next faceId
      }

      // 3. Add extruded cap face (replaces original face)
      const extrudedCapFace = this.mesh.addFace(newCapVertexIds, currentUndoState.originalMaterialId === null ? undefined : currentUndoState.originalMaterialId);
      if (!extrudedCapFace) {
        console.error(`ExtrudeFaces: Failed to create extruded cap face for original face ${faceId}. Attempting to restore original face.`);
        this.mesh.addFace(currentUndoState.originalVertexIds, currentUndoState.originalMaterialId === null ? undefined : currentUndoState.originalMaterialId); // Try to restore
        currentUndoState.newlyCreatedVertexInfo.forEach(vInfo => this.mesh.removeVertex(vInfo.id));
        continue; // to the next faceId
      }
      currentUndoState.extrudedCapFaceId = extrudedCapFace.id;

      // 4. Create side faces
      for (let i = 0; i < originalVertexObjects.length; i++) {
        const v0_orig_id = originalVertexObjects[i].id;
        const v1_orig_id = originalVertexObjects[(i + 1) % originalVertexObjects.length].id;
        
        const v0_new_id = newVertexIdMap.get(v0_orig_id)!;
        const v1_new_id = newVertexIdMap.get(v1_orig_id)!;

        // Side face vertices: [original_v0, original_v1, new_v1, new_v0]
        // This order should make the normal point outwards if original face was CCW.
        const sideFaceVertexIds = [v0_orig_id, v1_orig_id, v1_new_id, v0_new_id];
        const sideFace = this.mesh.addFace(sideFaceVertexIds, currentUndoState.originalMaterialId === null ? undefined : currentUndoState.originalMaterialId);
        
        if (sideFace) {
          currentUndoState.sideFaceIds.push(sideFace.id);
        } else {
          console.error(`ExtrudeFaces: Failed to create side face for original face ${faceId}. Catastrophic failure, mesh state inconsistent.`);
          // This is a bad state. We should try to undo everything for this face.
          this.mesh.removeFace(extrudedCapFace.id); // Remove cap
          currentUndoState.sideFaceIds.forEach(sfid => this.mesh.removeFace(sfid)); // Remove any successful side faces
          currentUndoState.newlyCreatedVertexInfo.forEach(vInfo => this.mesh.removeVertex(vInfo.id)); // Remove new verts
          this.mesh.addFace(currentUndoState.originalVertexIds, currentUndoState.originalMaterialId === null ? undefined : currentUndoState.originalMaterialId); // Restore original
          currentUndoState.extrudedCapFaceId = null; // Mark as failed
          currentUndoState.sideFaceIds = [];
          break; // Stop processing this original face
        }
      }
      
      // If side face creation failed mid-way and we broke, check if cap face is null (our error flag)
      if (currentUndoState.extrudedCapFaceId === null) {
          continue; // Move to next faceId, current one failed and was (hopefully) reverted
      }

      this.undoStates.push(currentUndoState);
    }
  }

  undo(): void {
    if (this.undoStates.length === 0) return;

    for (let i = this.undoStates.length - 1; i >= 0; i--) {
      const state = this.undoStates[i];

      // Remove side faces
      for (const sideFaceId of state.sideFaceIds) {
        this.mesh.removeFace(sideFaceId);
      }

      // Remove extruded cap face
      if (state.extrudedCapFaceId !== null) {
        this.mesh.removeFace(state.extrudedCapFaceId);
      }

      // Remove newly created vertices
      for (const vertexInfo of state.newlyCreatedVertexInfo) {
        this.mesh.removeVertex(vertexInfo.id);
      }

      // Re-add the original face
      // This will get a new ID, but geometry and material are restored.
      const restoredFace = this.mesh.addFace(state.originalVertexIds, state.originalMaterialId === null ? undefined : state.originalMaterialId);
      if (!restoredFace) {
        console.error(`ExtrudeFaces (undo): Failed to restore original face (was ID ${state.originalFaceId}).`);
      }
    }
    this.undoStates = [];
  }
}
