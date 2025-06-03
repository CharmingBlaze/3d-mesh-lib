import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Face } from './Face';
import { Edge } from './Edge';

interface SplitRipState {
  originalFaceIds: number[];
  newFaceIds: number[];
  duplicatedVertexIds: number[];
  splitEdgeIds: number[];
  ripOffset: number;
}

/**
 * Command to split or rip faces along edges.
 * Split: divides faces along selected edges.
 * Rip: creates loose geometry by duplicating vertices and separating faces.
 */
export class SplitRipFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private edgeIds: number[];
  private mode: 'split' | 'rip';
  private ripOffset: number; // Distance to separate ripped geometry
  
  // Store original state for undo
  private splitRipState: SplitRipState | null = null;
  
  public readonly description: string;

  /**
   * Creates an instance of SplitRipFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param edgeIds - Edge IDs to split/rip along.
   * @param mode - Operation mode ('split' or 'rip').
   * @param ripOffset - Distance to separate ripped geometry.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    edgeIds: number[],
    mode: 'split' | 'rip' = 'split',
    ripOffset: number = 0.1
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.edgeIds = [...edgeIds];
    this.mode = mode;
    this.ripOffset = Math.abs(ripOffset);
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.splitRipState = null;
    
    if (this.edgeIds.length === 0) {
      console.warn('SplitRipFaces: No edges specified for split/rip operation.');
      return;
    }

    const splitRipResult = this.mode === 'split' ? 
      this.performSplit() : this.performRip();
    
    if (splitRipResult) {
      this.splitRipState = splitRipResult;
    }

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    if (!this.splitRipState) return;

    // Remove created faces
    this.splitRipState.newFaceIds.forEach(faceId => {
      this.mesh.removeFace(faceId);
    });

    // Remove duplicated vertices
    this.splitRipState.duplicatedVertexIds.forEach(vertexId => {
      this.mesh.removeVertex(vertexId);
    });

    // Note: Restoring original faces and topology is complex
    console.warn('SplitRipFaces: Undo is not fully implemented. Split/rip operation is currently irreversible.');
    
    // Clear stored state
    this.splitRipState = null;
  }

  /**
   * Performs face splitting operation.
   * @returns Split state or null if failed.
   */
  private performSplit(): SplitRipState | null {
    const originalFaceIds: number[] = [];
    const newFaceIds: number[] = [];
    const splitEdgeIds: number[] = [];

    // Process each edge for splitting
    this.edgeIds.forEach(edgeId => {
      const edge = this.findEdgeById(edgeId);
      if (!edge) {
        console.warn(`SplitRipFaces: Edge with ID ${edgeId} not found.`);
        return;
      }

      // Split faces adjacent to this edge
      const splitResult = this.splitFacesAlongEdge(edge);
      if (splitResult) {
        originalFaceIds.push(...splitResult.originalFaceIds);
        newFaceIds.push(...splitResult.newFaceIds);
        splitEdgeIds.push(edgeId);
      }
    });

    return {
      originalFaceIds,
      newFaceIds,
      duplicatedVertexIds: [], // No vertex duplication in split
      splitEdgeIds,
      ripOffset: 0
    };
  }

  /**
   * Performs face ripping operation.
   * @returns Rip state or null if failed.
   */
  private performRip(): SplitRipState | null {
    const originalFaceIds: number[] = [];
    const newFaceIds: number[] = [];
    const duplicatedVertexIds: number[] = [];
    const splitEdgeIds: number[] = [];

    // First, identify which faces will be affected
    const affectedFaces = new Set<number>();
    this.edgeIds.forEach(edgeId => {
      const edge = this.findEdgeById(edgeId);
      if (edge) {
        edge.faces.forEach(faceId => affectedFaces.add(faceId));
      }
    });

    // Group faces by which side of the rip they'll be on
    const faceGroups = this.groupFacesForRip(Array.from(affectedFaces));
    
    // Perform rip by duplicating vertices and separating geometry
    const ripResult = this.ripGeometry(faceGroups);
    if (ripResult) {
      originalFaceIds.push(...ripResult.originalFaceIds);
      newFaceIds.push(...ripResult.newFaceIds);
      duplicatedVertexIds.push(...ripResult.duplicatedVertexIds);
      splitEdgeIds.push(...this.edgeIds);
    }

    return {
      originalFaceIds,
      newFaceIds,
      duplicatedVertexIds,
      splitEdgeIds,
      ripOffset: this.ripOffset
    };
  }

  /**
   * Splits faces along a specific edge.
   * @param edge - The edge to split along.
   * @returns Split result or null if failed.
   */
  private splitFacesAlongEdge(edge: Edge): { originalFaceIds: number[]; newFaceIds: number[] } | null {
    const originalFaceIds: number[] = [];
    const newFaceIds: number[] = [];

    // For each face adjacent to the edge
    edge.faces.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      originalFaceIds.push(faceId);

      // Split this face along the edge
      const splitFaces = this.splitFaceAlongEdge(face, edge);
      newFaceIds.push(...splitFaces);
    });

    return { originalFaceIds, newFaceIds };
  }

  /**
   * Splits a single face along an edge.
   * @param face - The face to split.
   * @param edge - The edge to split along.
   * @returns Array of new face IDs.
   */
  private splitFaceAlongEdge(face: Face, edge: Edge): number[] {
    const vertices = face.vertices;
    const materialIndex = face.materialIndex;
    
    // Find the vertices of the splitting edge
    const edgeVertexIds = [edge.v0.id, edge.v1.id];
    
    // Find positions of edge vertices in the face
    const edgePositions: number[] = [];
    vertices.forEach((vertex, index) => {
      if (edgeVertexIds.includes(vertex.id)) {
        edgePositions.push(index);
      }
    });

    if (edgePositions.length !== 2) {
      console.warn('SplitRipFaces: Could not find edge vertices in face.');
      return [];
    }

    // Remove original face
    this.mesh.removeFace(face.id);

    // Create two new faces by splitting along the edge
    const newFaceIds: number[] = [];
    
    // Sort edge positions
    edgePositions.sort((a, b) => a - b);
    const [pos1, pos2] = edgePositions;

    // Create first sub-face
    const face1VertexIds: number[] = [];
    for (let i = pos1; i <= pos2; i++) {
      face1VertexIds.push(vertices[i].id);
    }
    
    // Create second sub-face
    const face2VertexIds: number[] = [];
    for (let i = pos2; i < vertices.length; i++) {
      face2VertexIds.push(vertices[i].id);
    }
    for (let i = 0; i <= pos1; i++) {
      face2VertexIds.push(vertices[i].id);
    }

    // Add the new faces if they have enough vertices
    if (face1VertexIds.length >= 3) {
      const newFace1 = this.mesh.addFace(face1VertexIds, materialIndex ?? undefined);
      newFaceIds.push(newFace1.id);
    }
    
    if (face2VertexIds.length >= 3) {
      const newFace2 = this.mesh.addFace(face2VertexIds, materialIndex ?? undefined);
      newFaceIds.push(newFace2.id);
    }

    return newFaceIds;
  }

  /**
   * Groups faces for ripping operation.
   * @param faceIds - IDs of faces to group.
   * @returns Grouped faces for ripping.
   */
  private groupFacesForRip(faceIds: number[]): { group1: number[]; group2: number[] } {
    // Simple grouping - in practice, this would use more sophisticated algorithms
    const midpoint = Math.floor(faceIds.length / 2);
    
    return {
      group1: faceIds.slice(0, midpoint),
      group2: faceIds.slice(midpoint)
    };
  }

  /**
   * Performs the actual ripping by duplicating geometry.
   * @param faceGroups - Grouped faces for ripping.
   * @returns Rip result with new geometry.
   */
  private ripGeometry(faceGroups: { group1: number[]; group2: number[] }): {
    originalFaceIds: number[];
    newFaceIds: number[];
    duplicatedVertexIds: number[];
  } | null {
    const originalFaceIds: number[] = [];
    const newFaceIds: number[] = [];
    const duplicatedVertexIds: number[] = [];

    // Duplicate vertices for group2 faces and offset them
    const vertexMapping = new Map<number, number>();

    faceGroups.group2.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      originalFaceIds.push(faceId);

      // Duplicate vertices for this face
      const newVertexIds: number[] = [];
      face.vertices.forEach(vertex => {
        let newVertexId = vertexMapping.get(vertex.id);
        
        if (!newVertexId) {
          // Calculate rip direction (simple approach - use face normal)
          const ripDirection = face.normal || new Vector3D(1, 0, 0);
          const offsetPosition = vertex.position.add(ripDirection.multiplyScalar(this.ripOffset));
          
          const newVertex = this.mesh.addVertex(
            offsetPosition.x,
            offsetPosition.y,
            offsetPosition.z,
            vertex.normal?.clone(),
            vertex.uv ? { ...vertex.uv } : undefined
          );
          
          newVertexId = newVertex.id;
          vertexMapping.set(vertex.id, newVertexId);
          duplicatedVertexIds.push(newVertexId);
        }
        
        newVertexIds.push(newVertexId);
      });

      // Remove original face and create new face with duplicated vertices
      this.mesh.removeFace(faceId);
      const newFace = this.mesh.addFace(newVertexIds, face.materialIndex ?? undefined);
      newFaceIds.push(newFace.id);
    });

    return {
      originalFaceIds,
      newFaceIds,
      duplicatedVertexIds
    };
  }

  /**
   * Finds an edge by its ID.
   * @param edgeId - The edge ID to find.
   * @returns The edge or null if not found.
   */
  private findEdgeById(edgeId: number): Edge | null {
    for (const edge of this.mesh.edges.values()) {
      if (edge.id === edgeId) {
        return edge;
      }
    }
    return null;
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const edgeCount = this.edgeIds.length;
    const operation = this.mode === 'split' ? 'Split' : `Rip (offset: ${this.ripOffset.toFixed(3)})`;
    return `${operation} ${edgeCount} edge${edgeCount === 1 ? '' : 's'}`;
  }

  /**
   * Gets operation statistics.
   * @returns Statistics object.
   */
  getSplitRipStats(): {
    edgesProcessed: number;
    facesModified: number;
    newFacesCreated: number;
    verticesDuplicated: number;
    mode: 'split' | 'rip';
  } {
    if (!this.splitRipState) {
      return {
        edgesProcessed: 0,
        facesModified: 0,
        newFacesCreated: 0,
        verticesDuplicated: 0,
        mode: this.mode
      };
    }

    return {
      edgesProcessed: this.splitRipState.splitEdgeIds.length,
      facesModified: this.splitRipState.originalFaceIds.length,
      newFacesCreated: this.splitRipState.newFaceIds.length,
      verticesDuplicated: this.splitRipState.duplicatedVertexIds.length,
      mode: this.mode
    };
  }

  /**
   * Static factory method to split faces along edges.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param edgeIds - Edge IDs to split along.
   * @returns SplitRipFaces command instance.
   */
  static splitFaces(
    mesh: Mesh,
    selectionManager: SelectionManager,
    edgeIds: number[]
  ): SplitRipFaces {
    return new SplitRipFaces(mesh, selectionManager, edgeIds, 'split');
  }

  /**
   * Static factory method to rip faces along edges.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param edgeIds - Edge IDs to rip along.
   * @param offset - Rip offset distance.
   * @returns SplitRipFaces command instance.
   */
  static ripFaces(
    mesh: Mesh,
    selectionManager: SelectionManager,
    edgeIds: number[],
    offset: number = 0.1
  ): SplitRipFaces {
    return new SplitRipFaces(mesh, selectionManager, edgeIds, 'rip', offset);
  }
} 