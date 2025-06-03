import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Vertex } from './Vertex';
import { Vector3D } from '@/utils/Vector3D';

interface StoredFaceData {
  originalFaceId: number;
  vertexIds: number[]; // Original vertex IDs
  materialId?: number;
}

interface RemovedVertexState {
  originalVertexId: number;
  x: number;
  y: number;
  z: number;
  normalArray: [number, number, number] | null;
  uv: { u: number; v: number } | null;
  incidentFacesData: StoredFaceData[];
}

export class RemoveVertexCommand implements ICommand {
  private mesh: Mesh;
  private vertexIdToRemove: number;
  private removedVertexState: RemovedVertexState | null = null;
  public description: string;

  constructor(mesh: Mesh, vertexIdToRemove: number, description?: string) {
    this.mesh = mesh;
    this.vertexIdToRemove = vertexIdToRemove;
    this.description = description || `Remove Vertex (ID: ${vertexIdToRemove})`;
  }

  execute(): void {
    const vertexToRemove = this.mesh.getVertex(this.vertexIdToRemove);
    if (!vertexToRemove) {
      console.warn(`RemoveVertexCommand.execute: Vertex with ID ${this.vertexIdToRemove} not found.`);
      return;
    }

    const incidentFacesData: StoredFaceData[] = [];
    // Important: Collect face data BEFORE modifying the mesh structure by removing the vertex
    // or its incident faces, as vertex.faces will change.
    // We iterate over a copy of the faces set because removing faces might modify the original set.
    new Set(vertexToRemove.faces).forEach(faceId => { // faceId is a number
      const actualFace = this.mesh.getFace(faceId);
      if (actualFace) {
        incidentFacesData.push({
          originalFaceId: actualFace.id, // Use the id from the fetched Face object
          vertexIds: actualFace.vertices.map((v: Vertex) => v.id), // Access vertices from Face object, add type for v
          materialId: actualFace.materialIndex === null ? undefined : actualFace.materialIndex, // Access materialIndex from Face object
        });
      } else {
        // This case should ideally not happen if data integrity is maintained
        console.warn(`RemoveVertexCommand.execute: Face with ID ${faceId} (associated with vertex ${vertexToRemove.id}) not found in mesh during state saving.`);
      }
    });

    this.removedVertexState = {
      originalVertexId: vertexToRemove.id,
      x: vertexToRemove.position.x,
      y: vertexToRemove.position.y,
      z: vertexToRemove.position.z,
      normalArray: vertexToRemove.normal ? vertexToRemove.normal.toArray() : null,
      uv: vertexToRemove.uv ? { ...vertexToRemove.uv } : null,
      incidentFacesData: incidentFacesData,
    };

    const success = this.mesh.removeVertex(this.vertexIdToRemove);
    if (!success) {
      console.warn(`RemoveVertexCommand.execute: Mesh.removeVertex failed for ID ${this.vertexIdToRemove}.`);
      this.removedVertexState = null; // Invalidate state if removal failed
    }
    // Mesh.removeVertex handles removal of incident faces/edges and bounding box updates.
  }

  undo(): void {
    if (!this.removedVertexState) {
      console.warn('RemoveVertexCommand.undo: No vertex data to restore. Execute might not have been called or failed.');
      return;
    }

    const { originalVertexId, x, y, z, normalArray, uv, incidentFacesData } = this.removedVertexState;

    // 1. Re-add the vertex
    const reAddedVertex = this.mesh.addVertex(
      x, y, z,
      normalArray ? Vector3D.fromArray(normalArray) : undefined,
      uv ? { ...uv } : undefined
    );
    const newVertexId = reAddedVertex.id;

    // 2. Re-add the incident faces, mapping the original vertex ID to the new one
    for (const faceData of incidentFacesData) {
      const updatedVertexIds = faceData.vertexIds.map(vid => 
        vid === originalVertexId ? newVertexId : vid
      );
      try {
        // It's possible some other vertices of the face were also removed by other commands.
        // addFace should handle/throw if vertices are missing. We'll catch and warn.
        this.mesh.addFace(updatedVertexIds, faceData.materialId);
      } catch (error) {
        console.warn(`RemoveVertexCommand.undo: Failed to re-add face (original ID: ${faceData.originalFaceId}) during vertex undo. Some of its other vertices might be missing. Error:`, error);
      }
    }
    
    // It's possible that the original vertex ID needs to be restored if other elements depend on it.
    // For now, we accept new IDs for the vertex and faces upon undo.
    // If strict ID restoration is needed, it's a more complex state management problem.

    this.removedVertexState = null; // Clear state after attempting undo
  }
}
