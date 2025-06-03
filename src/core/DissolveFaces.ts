import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Face } from './Face';
import { Vertex } from './Vertex';
import { Vector3D } from '@/utils/Vector3D';

interface DissolvedFaceState {
  originalFaceId: number;
  mergedVertexIds: number[];
  newFaceIds: number[];
  removedVertexIds: number[];
}

/**
 * Command to dissolve faces by removing them and merging surrounding geometry 
 * to maintain smooth topology. Unlike delete, dissolve tries to fill holes.
 */
export class DissolveFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  
  // Store original state for undo
  private dissolvedStates: DissolvedFaceState[] = [];
  private originalSelectedFaces: Set<number>;
  
  public readonly description: string;

  /**
   * Creates an instance of DissolveFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param faceIds - Optional specific face IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    faceIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    
    // Use provided face IDs or get from selection
    this.faceIds = faceIds || Array.from(selectionManager.getSelectedFaceIds());
    this.originalSelectedFaces = new Set(this.faceIds);
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.dissolvedStates = [];
    
    if (this.faceIds.length === 0) {
      console.warn('DissolveFaces: No faces selected or specified.');
      return;
    }

    // Process each face for dissolution
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) {
        console.warn(`DissolveFaces: Face with ID ${faceId} not found.`);
        return;
      }

      const dissolvedState = this.dissolveFace(face);
      if (dissolvedState) {
        this.dissolvedStates.push(dissolvedState);
        
        // Remove from selection
        this.selectionManager.deselectFace(faceId);
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Note: Full undo would require storing complete topology state
    // This is a simplified implementation
    console.warn('DissolveFaces: Undo is not fully implemented. Face dissolution is currently irreversible.');
    
    // Clear stored state
    this.dissolvedStates = [];
  }

  /**
   * Dissolves a single face by merging surrounding geometry.
   * @param face - The face to dissolve.
   * @returns Dissolved state or null if failed.
   */
  private dissolveFace(face: Face): DissolvedFaceState | null {
    const faceId = face.id;
    const mergedVertexIds: number[] = [];
    const newFaceIds: number[] = [];
    const removedVertexIds: number[] = [];

    // Get neighboring faces through shared edges
    const neighboringFaces = this.getNeighboringFaces(face);
    
    // Remove the original face
    const faceRemoved = this.mesh.removeFace(faceId);
    if (!faceRemoved) {
      console.warn(`DissolveFaces: Could not remove face ${faceId}.`);
      return null;
    }

    // Try to merge neighboring faces if possible
    if (neighboringFaces.length >= 2) {
      this.attemptTopologyMerge(face, neighboringFaces, newFaceIds);
    }

    // If the face had 3 or 4 vertices, try to create a simplified topology
    if (face.vertices.length <= 4 && neighboringFaces.length > 0) {
      this.attemptSimpleMerge(face, neighboringFaces, mergedVertexIds, newFaceIds);
    }

    return {
      originalFaceId: faceId,
      mergedVertexIds,
      newFaceIds,
      removedVertexIds
    };
  }

  /**
   * Gets the neighboring faces of a face through shared edges.
   * @param face - The face to get neighbors for.
   * @returns Array of neighboring faces.
   */
  private getNeighboringFaces(face: Face): Face[] {
    const neighbors = new Set<Face>();
    
    // Iterate through the face's edges to find connected faces
    face.edges.forEach(edge => {
      // For each edge, check all faces that use this edge
      edge.faces.forEach(faceId => {
        const neighborFace = this.mesh.getFace(faceId);
        if (neighborFace && neighborFace.id !== face.id) {
          neighbors.add(neighborFace);
        }
      });
    });
    
    return Array.from(neighbors);
  }

  /**
   * Attempts to merge topology by combining neighboring faces.
   * @param originalFace - The face being dissolved.
   * @param neighbors - Neighboring faces.
   * @param newFaceIds - Array to store IDs of newly created faces.
   */
  private attemptTopologyMerge(originalFace: Face, neighbors: Face[], newFaceIds: number[]): void {
    // This is a simplified topology merge
    // In a full implementation, you would analyze the topology more carefully
    
    if (neighbors.length === 2) {
      // Try to merge two triangular neighbors into a quad
      const face1 = neighbors[0];
      const face2 = neighbors[1];
      
      if (face1.vertices.length === 3 && face2.vertices.length === 3) {
        const mergedVertices = this.findMergeableVertices(face1, face2, originalFace);
        if (mergedVertices.length === 4) {
          // Create a new quad face
          const newFace = this.mesh.addFace(
            mergedVertices.map(v => v.id), 
            face1.materialIndex ?? undefined
          );
          if (newFace) {
            newFaceIds.push(newFace.id);
            
            // Remove the original neighboring faces
            this.mesh.removeFace(face1.id);
            this.mesh.removeFace(face2.id);
          }
        }
      }
    }
  }

  /**
   * Attempts a simple merge by averaging vertex positions.
   * @param originalFace - The face being dissolved.
   * @param neighbors - Neighboring faces.
   * @param mergedVertexIds - Array to store IDs of merged vertices.
   * @param newFaceIds - Array to store IDs of newly created faces.
   */
  private attemptSimpleMerge(
    originalFace: Face, 
    neighbors: Face[], 
    mergedVertexIds: number[], 
    newFaceIds: number[]
  ): void {
    // For simple dissolution, we can try to create bridging faces
    // This is a basic implementation that doesn't handle all edge cases
    
    const faceCenter = this.calculateFaceCenter(originalFace);
    
    // Create bridging faces between neighboring face edges
    for (let i = 0; i < neighbors.length - 1; i++) {
      const face1 = neighbors[i];
      const face2 = neighbors[i + 1];
      
      // Find shared vertices or create bridging geometry
      const sharedVertices = this.findSharedVertices(face1, face2);
      if (sharedVertices.length >= 2) {
        // Can potentially create a bridging face
        const bridgeVertexIds = sharedVertices.map(v => v.id);
        if (bridgeVertexIds.length >= 3) {
          const newFace = this.mesh.addFace(bridgeVertexIds, face1.materialIndex ?? undefined);
          if (newFace) {
            newFaceIds.push(newFace.id);
          }
        }
      }
    }
  }

  /**
   * Finds vertices that can be merged when combining two faces.
   * @param face1 - First face.
   * @param face2 - Second face.
   * @param originalFace - The face being dissolved.
   * @returns Array of vertices for the merged face.
   */
  private findMergeableVertices(face1: Face, face2: Face, originalFace: Face): Vertex[] {
    // This is a simplified merge that combines unique vertices
    const allVertices = new Map<number, Vertex>();
    
    // Add vertices from both faces, avoiding duplicates
    face1.vertices.forEach(v => allVertices.set(v.id, v));
    face2.vertices.forEach(v => allVertices.set(v.id, v));
    
    return Array.from(allVertices.values());
  }

  /**
   * Finds vertices shared between two faces.
   * @param face1 - First face.
   * @param face2 - Second face.
   * @returns Array of shared vertices.
   */
  private findSharedVertices(face1: Face, face2: Face): Vertex[] {
    const shared: Vertex[] = [];
    
    face1.vertices.forEach(v1 => {
      if (face2.vertices.some(v2 => v2.id === v1.id)) {
        shared.push(v1);
      }
    });
    
    return shared;
  }

  /**
   * Calculates the center point of a face.
   * @param face - The face to calculate center for.
   * @returns Face center point.
   */
  private calculateFaceCenter(face: Face): Vector3D {
    let center = new Vector3D(0, 0, 0);
    
    face.vertices.forEach(vertex => {
      center = center.add(vertex.position);
    });
    
    return center.multiplyScalar(1 / face.vertices.length);
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const faceCount = this.faceIds.length;
    return `Dissolve ${faceCount} face${faceCount === 1 ? '' : 's'} (merge topology)`;
  }

  /**
   * Gets dissolution statistics.
   * @returns Statistics object.
   */
  getDissolveStats(): {
    facesDisolved: number;
    newFacesCreated: number;
    verticesMerged: number;
  } {
    const newFacesCreated = this.dissolvedStates.reduce((sum, state) => 
      sum + state.newFaceIds.length, 0);
    const verticesMerged = this.dissolvedStates.reduce((sum, state) => 
      sum + state.mergedVertexIds.length, 0);

    return {
      facesDisolved: this.dissolvedStates.length,
      newFacesCreated,
      verticesMerged
    };
  }

  /**
   * Static factory method to dissolve selected faces.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @returns DissolveFaces command instance.
   */
  static dissolveSelected(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): DissolveFaces {
    return new DissolveFaces(mesh, selectionManager);
  }
} 