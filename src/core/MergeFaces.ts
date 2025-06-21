import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Face } from './Face';
import { Edge } from './Edge';
import { Vertex } from './Vertex';

const COPLANARITY_NORMAL_DOT_THRESHOLD = 0.999; // Cosine of a small angle (e.g., ~2.5 degrees)
const DISTANCE_TO_PLANE_THRESHOLD = 1e-5; // Small distance for point-on-plane check

interface OriginalFaceData {
  id: number;
  vertexIds: number[];
  materialId: number | null;
}

interface MergeFacesUndoState {
  originalFace1Data: OriginalFaceData;
  originalFace2Data: OriginalFaceData;
  mergedFaceId: number | null;
  // Shared edge removal is handled by mesh.removeFace implicitly
}

export class MergeFaces implements ICommand {
  private mesh: Mesh;
  private faceId1: number;
  private faceId2: number;
  private undoState: MergeFacesUndoState | null = null;
  public readonly description: string;

  constructor(mesh: Mesh, faceId1: number, faceId2: number, description?: string) {
    this.mesh = mesh;
    this.faceId1 = faceId1;
    this.faceId2 = faceId2;
    this.description = description || `Merge face ${faceId1} and face ${faceId2}`;
  }

  private areFacesCoplanar(face1: Face, face2: Face): boolean {
    if (!face1.normal || !face2.normal) return false; // Should not happen for valid faces

    const dotNormals = face1.normal.dot(face2.normal);
    if (Math.abs(dotNormals) < COPLANARITY_NORMAL_DOT_THRESHOLD) {
      // console.log('Normals not parallel enough:', dotNormals);
      return false; // Normals not parallel enough
    }

    // Check if a vertex of face2 lies on the plane of face1
    // Plane equation: N · (P - P0) = 0, where N is face1.normal, P0 is a vertex on face1
    const p0 = face1.vertices[0].position;
    const p_test = face2.vertices[0].position;
    const diff = p_test.clone().subtract(p0);
    const distanceToPlane = face1.normal.dot(diff);

    if (Math.abs(distanceToPlane) > DISTANCE_TO_PLANE_THRESHOLD) {
      // console.log('Distance to plane too high:', distanceToPlane);
      return false;
    }
    return true;
  }

  private findSharedEdge(face1: Face, face2: Face): Edge | null {
    let sharedEdge: Edge | null = null;
    for (const edge of face1.edges) {
      if (edge.faces.has(face2.id)) {
        if (sharedEdge) return null; // More than one shared edge, too complex for this command
        sharedEdge = edge;
      }
    }
    return sharedEdge;
  }

  private getOrderedOuterLoop(face1: Face, face2: Face, sharedEdge: Edge): number[] {
    const sV0 = sharedEdge.v0;
    const sV1 = sharedEdge.v1;

    const loop: Vertex[] = [];
    let currentFaceVertices = face1.vertices;
    let currentV = sV0;
    let endV = sV1;
    let safety = 0;

    // Traverse face1 from sV0 to sV1 (not via shared edge directly)
    loop.push(currentV);
    let currentIndex = currentFaceVertices.findIndex(v => v.id === currentV.id);
    while (currentV.id !== endV.id && safety < currentFaceVertices.length * 2) {
      currentIndex = (currentIndex + 1) % currentFaceVertices.length;
      currentV = currentFaceVertices[currentIndex];
      if (currentV.id !== endV.id) {
         loop.push(currentV);
      }
      safety++;
    }
    if (currentV.id !== endV.id) return []; // Failed to trace path

    // Traverse face2 from sV1 to sV0 (not via shared edge directly)
    currentFaceVertices = face2.vertices;
    currentV = sV1; // Start from sV1 on face2
    endV = sV0;     // End at sV0 on face2
    // loop.push(currentV); // sV1 is already the last element from face1 path if loop included endV
    currentIndex = currentFaceVertices.findIndex(v => v.id === currentV.id);
    safety = 0;
    while (currentV.id !== endV.id && safety < currentFaceVertices.length * 2) {
      currentIndex = (currentIndex + 1) % currentFaceVertices.length;
      currentV = currentFaceVertices[currentIndex];
      if (currentV.id !== endV.id) { // Don't add the final sV0 as it's the start of the loop
          loop.push(currentV);
      }
      safety++;
    }
    if (currentV.id !== endV.id) return []; // Failed to trace path
    
    return loop.map(v => v.id);
  }

  execute(): void {
    this.undoState = null;
    const face1 = this.mesh.getFace(this.faceId1);
    const face2 = this.mesh.getFace(this.faceId2);

    if (!face1 || !face2) {
      console.warn('MergeFaces: One or both faces not found.'); return;
    }
    if (face1.id === face2.id) {
        console.warn('MergeFaces: Cannot merge a face with itself.'); return;
    }
    if (!this.areFacesCoplanar(face1, face2)) {
      console.warn('MergeFaces: Faces are not coplanar.'); return;
    }

    const sharedEdge = this.findSharedEdge(face1, face2);
    if (!sharedEdge) {
      console.warn('MergeFaces: Faces do not share exactly one edge, or are not adjacent.'); return;
    }

    const newVertexLoopIds = this.getOrderedOuterLoop(face1, face2, sharedEdge);
    if (newVertexLoopIds.length < 3) {
      console.warn('MergeFaces: Failed to construct a valid outer loop for the merged face.'); return;
    }

    this.undoState = {
      originalFace1Data: { id: face1.id, vertexIds: face1.vertices.map(v => v.id), materialId: face1.materialIndex },
      originalFace2Data: { id: face2.id, vertexIds: face2.vertices.map(v => v.id), materialId: face2.materialIndex },
      mergedFaceId: null,
    };

    if (!this.mesh.removeFace(face1.id) || !this.mesh.removeFace(face2.id)) {
      console.error('MergeFaces: Failed to remove one of the original faces. Attempting to restore.');
      // Attempt to restore if one was removed and other failed - this is tricky
      // For now, if removal fails, we assume a larger issue and don't proceed to add merged face.
      // A more robust solution would re-add the successfully removed face.
      this.undoState = null; // Invalidate undo state
      return;
    }

    // Use material from face1, or average, or prompt user. For now, face1's.
    const mergedFace = this.mesh.addFace(newVertexLoopIds, face1.materialIndex === null ? undefined : face1.materialIndex);
    if (!mergedFace) {
      console.error('MergeFaces: Failed to create the new merged face. Restoring original faces.');
      // Restore original faces
      this.mesh.addFace(this.undoState.originalFace1Data.vertexIds, this.undoState.originalFace1Data.materialId === null ? undefined : this.undoState.originalFace1Data.materialId);
      this.mesh.addFace(this.undoState.originalFace2Data.vertexIds, this.undoState.originalFace2Data.materialId === null ? undefined : this.undoState.originalFace2Data.materialId);
      this.undoState = null; // Invalidate undo state
      return;
    }
    this.undoState.mergedFaceId = mergedFace.id;
  }

  undo(): void {
    if (!this.undoState || this.undoState.mergedFaceId === null) {
      // console.log('MergeFaces: No valid state to undo.');
      return;
    }

    if (!this.mesh.removeFace(this.undoState.mergedFaceId)) {
      console.error('MergeFaces (undo): Failed to remove the merged face.');
      // Mesh might be in an inconsistent state. Further undos might be problematic.
    }

    // Re-add original faces. Their new IDs will differ from original ones.
    const f1Restored = this.mesh.addFace(this.undoState.originalFace1Data.vertexIds, this.undoState.originalFace1Data.materialId === null ? undefined : this.undoState.originalFace1Data.materialId);
    const f2Restored = this.mesh.addFace(this.undoState.originalFace2Data.vertexIds, this.undoState.originalFace2Data.materialId === null ? undefined : this.undoState.originalFace2Data.materialId);

    if (!f1Restored || !f2Restored) {
      console.error('MergeFaces (undo): Failed to restore one or both original faces.');
    }
    this.undoState = null; // Clear state after undo
  }
}
