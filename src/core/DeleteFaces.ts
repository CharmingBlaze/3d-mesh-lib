import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Face } from './Face';
import type { Vertex } from './Vertex';
import type { Edge } from './Edge';

interface DeletedFaceState {
  faceId: number;
  deletedVertexIds: number[];
  deletedEdgeKeys: string[];
}

/**
 * Command to delete faces and optionally clean up unused vertices and edges.
 */
export class DeleteFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  private deleteOrphanedVertices: boolean;
  private deleteOrphanedEdges: boolean;
  
  // Store original state for undo
  private deletedStates: DeletedFaceState[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of DeleteFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param deleteOrphanedVertices - Whether to delete vertices no longer used by any face.
   * @param deleteOrphanedEdges - Whether to delete edges no longer used by any face.
   * @param faceIds - Optional specific face IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    deleteOrphanedVertices: boolean = true,
    deleteOrphanedEdges: boolean = true,
    faceIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.deleteOrphanedVertices = deleteOrphanedVertices;
    this.deleteOrphanedEdges = deleteOrphanedEdges;
    
    // Use provided face IDs or get from selection
    this.faceIds = faceIds || Array.from(selectionManager.getSelectedFaceIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.deletedStates = [];
    
    if (this.faceIds.length === 0) {
      console.warn('DeleteFaces: No faces selected or specified.');
      return;
    }

    // Process each face for deletion
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) {
        console.warn(`DeleteFaces: Face with ID ${faceId} not found.`);
        return;
      }

      const deletedState = this.deleteFace(face);
      if (deletedState) {
        this.deletedStates.push(deletedState);
        
        // Remove from selection
        this.selectionManager.deselectFace(faceId);
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Note: Full undo would require storing complete face/vertex/edge data
    // This is a simplified implementation that assumes mesh operations are reversible
    console.warn('DeleteFaces: Undo is not fully implemented. Face deletion is currently irreversible.');
    
    // Clear stored state
    this.deletedStates = [];
  }

  /**
   * Deletes a single face and optionally orphaned geometry.
   * @param face - The face to delete.
   * @returns Deleted state or null if failed.
   */
  private deleteFace(face: Face): DeletedFaceState | null {
    const faceId = face.id;
    const deletedVertexIds: number[] = [];
    const deletedEdgeKeys: string[] = [];

    // Store vertices and edges that will potentially be orphaned
    const faceVertices = [...face.vertices];
    const faceEdges = [...face.edges];

    // Remove the face first
    const faceRemoved = this.mesh.removeFace(faceId);
    if (!faceRemoved) {
      console.warn(`DeleteFaces: Could not remove face ${faceId}.`);
      return null;
    }

    // Check and remove orphaned edges if requested
    if (this.deleteOrphanedEdges) {
      faceEdges.forEach(edge => {
        // Check if edge is now orphaned (no faces reference it)
        if (edge.faces.size === 0) {
          const edgeKey = edge.key;
          // Remove edge (this should also update vertex edge references)
          const edgeRemoved = this.mesh.removeEdge(edge.v0.id, edge.v1.id);
          if (edgeRemoved) {
            deletedEdgeKeys.push(edgeKey);
          }
        }
      });
    }

    // Check and remove orphaned vertices if requested
    if (this.deleteOrphanedVertices) {
      faceVertices.forEach(vertex => {
        // Check if vertex is now orphaned (no faces reference it)
        if (vertex.faces.size === 0) {
          const vertexRemoved = this.mesh.removeVertex(vertex.id);
          if (vertexRemoved) {
            deletedVertexIds.push(vertex.id);
          }
        }
      });
    }

    return {
      faceId,
      deletedVertexIds,
      deletedEdgeKeys
    };
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const faceCount = this.faceIds.length;
    let desc = `Delete ${faceCount} face${faceCount === 1 ? '' : 's'}`;
    
    if (this.deleteOrphanedVertices || this.deleteOrphanedEdges) {
      desc += ' (with cleanup';
      if (this.deleteOrphanedVertices) desc += ' vertices';
      if (this.deleteOrphanedVertices && this.deleteOrphanedEdges) desc += ',';
      if (this.deleteOrphanedEdges) desc += ' edges';
      desc += ')';
    }
    
    return desc;
  }

  /**
   * Gets deletion statistics.
   * @returns Statistics object.
   */
  getDeletionStats(): {
    facesDeleted: number;
    verticesDeleted: number;
    edgesDeleted: number;
  } {
    const verticesDeleted = this.deletedStates.reduce((sum, state) => 
      sum + state.deletedVertexIds.length, 0);
    const edgesDeleted = this.deletedStates.reduce((sum, state) => 
      sum + state.deletedEdgeKeys.length, 0);

    return {
      facesDeleted: this.deletedStates.length,
      verticesDeleted,
      edgesDeleted
    };
  }

  /**
   * Static factory method to delete faces with full cleanup.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @returns DeleteFaces command instance.
   */
  static deleteWithCleanup(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): DeleteFaces {
    return new DeleteFaces(mesh, selectionManager, true, true);
  }

  /**
   * Static factory method to delete faces only (no cleanup).
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @returns DeleteFaces command instance.
   */
  static deleteFacesOnly(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): DeleteFaces {
    return new DeleteFaces(mesh, selectionManager, false, false);
  }
}
