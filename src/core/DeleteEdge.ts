import { Mesh } from './Mesh';
import { Vertex } from './Vertex';
import { Edge } from './Edge';
import { ICommand } from './ICommand';

interface DeletedEdgeState {
  edgeJSON: any; // Serialized Edge data
  originalFaceIds: number[]; // IDs of faces that used this edge
  removedOrphanedVerticesJSON?: { vertexId: number; vertexJSON: any }[];
}

/**
 * Command to delete edges and optionally clean up orphaned vertices.
 */
export class DeleteEdge implements ICommand {
  private mesh: Mesh;
  private edgeKeysToDelete: string[];
  private attemptDeleteOrphanedVertices: boolean;
  private originalStates: DeletedEdgeState[] = [];

  public readonly description: string;

  constructor(
    mesh: Mesh,
    edgeKeys: string[],
    deleteOrphanedVertices: boolean = true
  ) {
    this.mesh = mesh;
    this.edgeKeysToDelete = [...edgeKeys]; // Clone the array
    this.attemptDeleteOrphanedVertices = deleteOrphanedVertices;
    this.description = `Delete ${edgeKeys.length} edge(s)${deleteOrphanedVertices ? ' and orphaned vertices' : ''}`;
  }

  execute(): void {
    this.originalStates = [];
    let edgesEffectivelyRemoved = 0;

    for (const edgeKey of this.edgeKeysToDelete) {
      const edge: Edge | undefined = this.mesh.edges.get(edgeKey);
      if (!edge) {
        console.warn(`DeleteEdge: Edge with key ${edgeKey} not found.`);
        continue;
      }

      const v0: Vertex = edge.v0;
      const v1: Vertex = edge.v1;

      const state: DeletedEdgeState = {
        edgeJSON: edge.toJSON(),
        originalFaceIds: Array.from(edge.faces), // Already contains face IDs, not objects
        removedOrphanedVerticesJSON: []
      };

      // Remove the edge
      // Assuming Mesh.removeEdgeByKey exists and updates connectivity
      // Or Mesh.removeEdge(v0.id, v1.id)
      const edgeRemoved = this.mesh.removeEdge(v0.id, v1.id); 

      if (!edgeRemoved) {
        console.warn(`DeleteEdge: Failed to remove edge ${edgeKey}.`);
        continue;
      }
      edgesEffectivelyRemoved++;

      if (this.attemptDeleteOrphanedVertices) {
        const idFromV0 = v0.id;
        const idFromV1 = v1.id;
        const vertexIdsToProcess = [idFromV0, idFromV1];
        for (const vertexId of vertexIdsToProcess) {
          const vertexInstance = this.mesh.getVertex(vertexId); // Re-fetch, its state might have changed
          if (vertexInstance && vertexInstance.edges.size === 0 && vertexInstance.faces.size === 0) {
            // Vertex is orphaned
            state.removedOrphanedVerticesJSON?.push({
              vertexId: vertexInstance.id,
              vertexJSON: vertexInstance.toJSON()
            });
            this.mesh.removeVertex(vertexInstance.id);
          }
        }
      }
      this.originalStates.push(state);
    }

    if (edgesEffectivelyRemoved > 0) {
      this.mesh.computeBoundingBox();
    }
    console.log(`DeleteEdge: Executed. Attempted to remove ${this.edgeKeysToDelete.length}, effectively removed ${edgesEffectivelyRemoved}.`);
  }

  undo(): void {
    let undoneOperations = 0;
    for (let i = this.originalStates.length - 1; i >= 0; i--) {
      const state = this.originalStates[i];

      // 1. Restore orphaned vertices
      if (state.removedOrphanedVerticesJSON) {
        for (const vData of state.removedOrphanedVerticesJSON) {
          const restoredVertex = Vertex.fromJSON(vData.vertexJSON);
          this.mesh.vertices.set(restoredVertex.id, restoredVertex);
          // Vertex.fromJSON should handle Vertex.nextId adjustment
        }
      }

      // 2. Restore the edge using Mesh.addEdge
      // state.edgeJSON should contain v0Id and v1Id (and key for warning messages)
      const edgeData = state.edgeJSON;
      if (!edgeData || typeof edgeData.v0Id !== 'number' || typeof edgeData.v1Id !== 'number') {
        console.warn(`DeleteEdge Undo: Invalid edge data in originalStates. Cannot restore edge.`);
        continue;
      }

      const actualRestoredEdge = this.mesh.addEdge(edgeData.v0Id, edgeData.v1Id);

      if (actualRestoredEdge) {
        // 3. Restore face-edge connectivity
        // The actualRestoredEdge.faces set will be empty as Mesh.addEdge doesn't handle face linking.
        // We re-populate it using the stored originalFaceIds.
        state.originalFaceIds.forEach(faceId => {
          const face = this.mesh.getFace(faceId);
          if (face) {
            // Ensure the edge isn't already in the face's edge list (e.g., partial undo)
            if (!face.edges.find(e => e.key === actualRestoredEdge.key)) {
              face.edges.push(actualRestoredEdge);
            }
            actualRestoredEdge.faces.add(faceId); // Add face ID to edge's set of faces
          }
        });
        undoneOperations++;
      } else {
        const edgeKeyForWarning = edgeData.key || `v${edgeData.v0Id}-v${edgeData.v1Id}`;
        console.warn(`DeleteEdge Undo: Failed to restore edge ${edgeKeyForWarning} using mesh.addEdge.`);
      }
    }

    if (undoneOperations > 0) {
      this.mesh.computeBoundingBox();
    }
    this.originalStates = []; // Clear states after undo
    console.log(`DeleteEdge: Undone. Restored ${undoneOperations} edges/vertices.`);
  }
}
