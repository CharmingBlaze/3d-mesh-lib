import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

interface LoopRemovalData {
  removedVertexIds: number[];
  removedEdgeKeys: string[];
  removedFaceIds: number[];
  createdFaceIds: number[];
}

/**
 * Command to remove an edge loop and merge adjacent faces.
 * This is the inverse operation of InsertEdgeLoop.
 */
export class RemoveEdgeLoop implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private edgeLoopIds: number[];
  private mergeAcrossMaterial: boolean;
  
  // Store data for undo
  private removalData: LoopRemovalData = {
    removedVertexIds: [],
    removedEdgeKeys: [],
    removedFaceIds: [],
    createdFaceIds: []
  };
  
  public readonly description: string;

  /**
   * Creates an instance of RemoveEdgeLoop command.
   * @param mesh - The mesh to remove the edge loop from.
   * @param selectionManager - The selection manager to modify.
   * @param edgeLoopIds - Array of edge IDs that form the loop to remove.
   * @param mergeAcrossMaterial - Whether to merge faces with different materials.
   */
  constructor(
    mesh: Mesh, 
    selectionManager: SelectionManager, 
    edgeLoopIds: number[],
    mergeAcrossMaterial: boolean = false
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.edgeLoopIds = [...edgeLoopIds];
    this.mergeAcrossMaterial = mergeAcrossMaterial;
    
    this.description = `Remove edge loop of ${edgeLoopIds.length} edge${edgeLoopIds.length === 1 ? '' : 's'}`;
  }

  execute(): void {
    // Reset removal data
    this.removalData = {
      removedVertexIds: [],
      removedEdgeKeys: [],
      removedFaceIds: [],
      createdFaceIds: []
    };

    if (this.edgeLoopIds.length === 0) {
      console.warn('RemoveEdgeLoop: No edges specified for removal.');
      return;
    }

    // Validate that the edges form a valid loop
    if (!this.validateEdgeLoop()) {
      console.warn('RemoveEdgeLoop: Selected edges do not form a valid edge loop.');
      return;
    }

    // Find all faces adjacent to the edge loop
    const adjacentFaces = this.findAdjacentFaces();
    
    // Group faces by material if needed
    const faceGroups = this.groupFacesByMaterial(adjacentFaces);
    
    // Remove edges and vertices from selection
    this.removeFromSelection();
    
    // Remove the edge loop and merge faces
    this.removeEdgeLoopAndMergeFaces(faceGroups);
    
    console.log(`RemoveEdgeLoop: Removed ${this.removalData.removedEdgeKeys.length} edges, ${this.removalData.removedVertexIds.length} vertices, merged ${this.removalData.removedFaceIds.length} faces into ${this.removalData.createdFaceIds.length} new faces.`);
  }

  undo(): void {
    // This is a simplified undo - a full implementation would restore the exact original state
    console.warn('RemoveEdgeLoop: Undo not fully implemented. This operation requires complex mesh state restoration.');
    
    // Remove the newly created faces
    this.removalData.createdFaceIds.forEach(faceId => {
      this.mesh.removeFace(faceId);
    });
    
    // Note: Full undo would require restoring original vertices, edges, and faces
    // This would need to store the complete original mesh state before the operation
  }

  /**
   * Validates that the selected edges form a valid closed loop.
   * @returns True if the edges form a valid loop.
   */
  private validateEdgeLoop(): boolean {
    if (this.edgeLoopIds.length < 3) {
      return false; // Need at least 3 edges for a valid loop
    }

    // Check connectivity - each vertex should be connected to exactly 2 edges in the loop
    const vertexConnections = new Map<number, number>();
    
    for (const edgeId of this.edgeLoopIds) {
      const edge = this.mesh.edges.get(edgeId.toString());
      if (!edge) {
        console.warn(`RemoveEdgeLoop: Edge ${edgeId} not found.`);
        return false;
      }
      
      // Count connections for each vertex
      vertexConnections.set(edge.v0.id, (vertexConnections.get(edge.v0.id) || 0) + 1);
      vertexConnections.set(edge.v1.id, (vertexConnections.get(edge.v1.id) || 0) + 1);
    }
    
    // Each vertex in the loop should have exactly 2 connections
    for (const [vertexId, connections] of vertexConnections) {
      if (connections !== 2) {
        console.warn(`RemoveEdgeLoop: Vertex ${vertexId} has ${connections} connections (expected 2).`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Finds all faces adjacent to the edge loop.
   * @returns Object with faces on both sides of the loop.
   */
  private findAdjacentFaces(): { side1: Set<number>; side2: Set<number> } {
    const side1Faces = new Set<number>();
    const side2Faces = new Set<number>();
    
    this.edgeLoopIds.forEach(edgeId => {
      const edge = this.mesh.edges.get(edgeId.toString());
      if (!edge) return;
      
      const faceArray = Array.from(edge.faces);
      if (faceArray.length >= 1) side1Faces.add(faceArray[0]);
      if (faceArray.length >= 2) side2Faces.add(faceArray[1]);
    });
    
    return { side1: side1Faces, side2: side2Faces };
  }

  /**
   * Groups faces by material to handle merging correctly.
   * @param adjacentFaces - Faces adjacent to the edge loop.
   * @returns Grouped faces by material.
   */
  private groupFacesByMaterial(adjacentFaces: { side1: Set<number>; side2: Set<number> }): Array<{
    side1: number[];
    side2: number[];
    materialIndex?: number;
  }> {
    if (this.mergeAcrossMaterial) {
      // Merge all faces regardless of material
      return [{
        side1: Array.from(adjacentFaces.side1),
        side2: Array.from(adjacentFaces.side2),
        materialIndex: undefined
      }];
    }
    
    // Group by material
    const materialGroups = new Map<number | undefined, { side1: number[]; side2: number[] }>();
    
    // Process side1 faces
    adjacentFaces.side1.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;
      
      const material = face.materialIndex ?? undefined;
      if (!materialGroups.has(material)) {
        materialGroups.set(material, { side1: [], side2: [] });
      }
      materialGroups.get(material)!.side1.push(faceId);
    });
    
    // Process side2 faces
    adjacentFaces.side2.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;
      
      const material = face.materialIndex ?? undefined;
      if (!materialGroups.has(material)) {
        materialGroups.set(material, { side1: [], side2: [] });
      }
      materialGroups.get(material)!.side2.push(faceId);
    });
    
    return Array.from(materialGroups.entries()).map(([materialIndex, group]) => ({
      ...group,
      materialIndex
    }));
  }

  /**
   * Removes the edge loop elements from selection.
   */
  private removeFromSelection(): void {
    this.edgeLoopIds.forEach(edgeId => {
      this.selectionManager.deselectEdge(edgeId);
    });
  }

  /**
   * Removes the edge loop and merges faces on both sides.
   * @param faceGroups - Groups of faces to merge by material.
   */
  private removeEdgeLoopAndMergeFaces(faceGroups: Array<{
    side1: number[];
    side2: number[];
    materialIndex?: number;
  }>): void {
    // Collect vertices to remove (those only used by the edge loop)
    const verticesToRemove = this.findVerticesToRemove();
    
    // Remove edges from the loop
    this.edgeLoopIds.forEach(edgeId => {
      const edge = this.mesh.edges.get(edgeId.toString());
      if (edge) {
        this.removalData.removedEdgeKeys.push(edge.key);
        this.mesh.removeEdge(edge.v0.id, edge.v1.id);
      }
    });
    
    // Process each material group
    faceGroups.forEach(group => {
      this.mergeFaceGroup(group);
    });
    
    // Remove vertices that are no longer needed
    verticesToRemove.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex && vertex.edges.size === 0) {
        this.removalData.removedVertexIds.push(vertexId);
        this.mesh.removeVertex(vertexId);
      }
    });
  }

  /**
   * Finds vertices that should be removed with the edge loop.
   * @returns Array of vertex IDs to remove.
   */
  private findVerticesToRemove(): number[] {
    const verticesToCheck = new Set<number>();
    
    // Collect all vertices from the edge loop
    this.edgeLoopIds.forEach(edgeId => {
      const edge = this.mesh.edges.get(edgeId.toString());
      if (edge) {
        verticesToCheck.add(edge.v0.id);
        verticesToCheck.add(edge.v1.id);
      }
    });
    
    // Check which vertices are only used by the edge loop
    const verticesToRemove: number[] = [];
    verticesToCheck.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) return;
      
      // Check if vertex is only connected to edge loop edges
      let onlyInLoop = true;
      vertex.edges.forEach(edgeKey => {
        const edge = this.mesh.edges.get(edgeKey);
        if (edge && !this.edgeLoopIds.includes(edge.id)) {
          onlyInLoop = false;
        }
      });
      
      if (onlyInLoop) {
        verticesToRemove.push(vertexId);
      }
    });
    
    return verticesToRemove;
  }

  /**
   * Merges faces in a material group.
   * @param group - Group of faces to merge.
   */
  private mergeFaceGroup(group: {
    side1: number[];
    side2: number[];
    materialIndex?: number;
  }): void {
    const facesToMerge = [...group.side1, ...group.side2];
    if (facesToMerge.length === 0) return;
    
    // Collect all vertices from faces to merge
    const allVertices = new Set<number>();
    const boundaryVertices = new Set<number>();
    
    facesToMerge.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;
      
      this.removalData.removedFaceIds.push(faceId);
      
      face.vertices.forEach(vertex => {
        allVertices.add(vertex.id);
        
        // Check if this vertex is on the boundary (not part of edge loop)
        let isOnBoundary = false;
        vertex.edges.forEach(edgeKey => {
          const edge = this.mesh.edges.get(edgeKey);
          if (edge && !this.edgeLoopIds.includes(edge.id)) {
            // This vertex connects to edges outside the loop
            isOnBoundary = true;
          }
        });
        
        if (isOnBoundary) {
          boundaryVertices.add(vertex.id);
        }
      });
      
      // Remove the original face
      this.mesh.removeFace(faceId);
    });
    
    // Create new merged face from boundary vertices
    if (boundaryVertices.size >= 3) {
      const vertexArray = Array.from(boundaryVertices);
      const newFace = this.mesh.addFace(vertexArray, group.materialIndex);
      if (newFace) {
        this.removalData.createdFaceIds.push(newFace.id);
      }
    }
  }
} 