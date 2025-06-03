import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';

interface LoopInsertionData {
  originalFaceId: number;
  newFaceIds: number[];
  newVertexIds: number[];
  newEdgeKeys: string[];
}

/**
 * Command to insert a new edge loop by cutting through faces.
 * Creates a continuous loop of edges that cuts through existing faces,
 * splitting them into smaller faces.
 */
export class InsertEdgeLoop implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private startEdgeId: number;
  private cutPosition: number; // 0.0 to 1.0, position along the edge to start the cut
  
  // Store data for undo
  private insertionData: LoopInsertionData[] = [];
  private newLoopEdgeKeys: string[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of InsertEdgeLoop command.
   * @param mesh - The mesh to insert the edge loop into.
   * @param selectionManager - The selection manager to modify.
   * @param startEdgeId - The edge to start the loop insertion from.
   * @param cutPosition - Position along the edge (0.0 to 1.0) where the cut starts.
   */
  constructor(
    mesh: Mesh, 
    selectionManager: SelectionManager, 
    startEdgeId: number,
    cutPosition: number = 0.5
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.startEdgeId = startEdgeId;
    this.cutPosition = Math.max(0.0, Math.min(1.0, cutPosition));
    
    this.description = `Insert edge loop starting from edge ${startEdgeId} at position ${(cutPosition * 100).toFixed(1)}%`;
  }

  execute(): void {
    this.insertionData = [];
    this.newLoopEdgeKeys = [];

    // Find the edge loop path
    const loopPath = this.findEdgeLoopPath();
    if (loopPath.length === 0) {
      console.warn('InsertEdgeLoop: Could not find a valid edge loop path.');
      return;
    }

    // Process each edge in the loop
    loopPath.forEach(edgeInfo => {
      this.insertEdgeAtPosition(edgeInfo.edgeKey, edgeInfo.position);
    });

    // Select the newly created edge loop
    this.newLoopEdgeKeys.forEach(edgeKey => {
      const edge = this.mesh.edges.get(edgeKey);
      if (edge) {
        this.selectionManager.selectEdge(edge.id, true);
      }
    });

    console.log(`InsertEdgeLoop: Created edge loop with ${this.newLoopEdgeKeys.length} edges, split ${this.insertionData.length} faces.`);
  }

  undo(): void {
    // Remove newly created edges from selection
    this.newLoopEdgeKeys.forEach(edgeKey => {
      const edge = this.mesh.edges.get(edgeKey);
      if (edge) {
        this.selectionManager.deselectEdge(edge.id);
      }
    });

    // Restore original faces and remove new ones (in reverse order)
    for (let i = this.insertionData.length - 1; i >= 0; i--) {
      const data = this.insertionData[i];
      
      // Remove new faces
      data.newFaceIds.forEach(faceId => {
        this.mesh.removeFace(faceId);
      });
      
      // Remove new vertices
      data.newVertexIds.forEach(vertexId => {
        this.mesh.removeVertex(vertexId);
      });
      
      // Note: Original face restoration would require storing vertex data
      // For now, this is a simplified undo that removes the additions
    }

    this.insertionData = [];
    this.newLoopEdgeKeys = [];
  }

  /**
   * Finds the path for the edge loop starting from the selected edge.
   * @returns Array of edge information for the loop path.
   */
  private findEdgeLoopPath(): Array<{ edgeKey: string; position: number }> {
    const startEdge = this.mesh.edges.get(this.startEdgeId.toString());
    if (!startEdge) {
      console.warn('InsertEdgeLoop: Start edge not found.');
      return [];
    }

    const loopPath: Array<{ edgeKey: string; position: number }> = [];
    const visited = new Set<string>();
    
    // Start with the initial edge
    loopPath.push({ edgeKey: startEdge.key, position: this.cutPosition });
    visited.add(startEdge.key);

    // Find perpendicular edges to continue the loop
    let currentEdge = startEdge;
    let searchDepth = 0;
    const maxSearchDepth = 100; // Prevent infinite loops

    while (searchDepth < maxSearchDepth) {
      const nextEdgeInfo = this.findNextLoopEdge(currentEdge, visited);
      if (!nextEdgeInfo) break;

      loopPath.push(nextEdgeInfo);
      visited.add(nextEdgeInfo.edgeKey);
      
      const nextEdge = this.mesh.edges.get(nextEdgeInfo.edgeKey);
      if (!nextEdge) break;
      
      currentEdge = nextEdge;
      searchDepth++;

      // Check if we've completed the loop (back to start or close to it)
      if (this.isLoopComplete(loopPath, startEdge)) {
        break;
      }
    }

    return loopPath;
  }

  /**
   * Finds the next edge in the loop path that's perpendicular to the current edge.
   * @param currentEdge - The current edge in the path.
   * @param visited - Set of already visited edge keys.
   * @returns Information about the next edge, or null if none found.
   */
  private findNextLoopEdge(currentEdge: any, visited: Set<string>): { edgeKey: string; position: number } | null {
    // This is a simplified implementation. A full implementation would:
    // 1. Find faces adjacent to the current edge
    // 2. Find opposite edges in those faces (perpendicular edges)
    // 3. Select the best candidate based on geometric criteria
    
    const candidateEdges: Array<{ edgeKey: string; position: number }> = [];

    // Check faces connected to this edge
    currentEdge.faces.forEach((faceId: number) => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      // Find edges opposite to the current edge in this face
      for (let i = 0; i < face.edges.length; i++) {
        const edge = face.edges[i];
        if (edge.key !== currentEdge.key && !visited.has(edge.key)) {
          // Check if this edge is roughly perpendicular/opposite
          if (this.isEdgeOppositeInFace(currentEdge, edge, face)) {
            candidateEdges.push({ edgeKey: edge.key, position: 0.5 });
          }
        }
      }
    });

    // Return the best candidate (first valid one for simplicity)
    return candidateEdges.length > 0 ? candidateEdges[0] : null;
  }

  /**
   * Checks if two edges are opposite each other in a face (suitable for loop continuation).
   * @param edge1 - First edge.
   * @param edge2 - Second edge.
   * @param face - The face containing both edges.
   * @returns True if edges are opposite/perpendicular.
   */
  private isEdgeOppositeInFace(edge1: any, edge2: any, face: any): boolean {
    // Simplified check: for quads, opposite edges don't share vertices
    // For triangles, this concept doesn't apply the same way
    
    if (face.vertices.length === 4) {
      // Check if edges don't share vertices (opposite edges in a quad)
      const edge1Vertices = new Set([edge1.v0.id, edge1.v1.id]);
      const edge2Vertices = new Set([edge2.v0.id, edge2.v1.id]);
      
      // No shared vertices means they're opposite
      for (const v of edge1Vertices) {
        if (edge2Vertices.has(v)) return false;
      }
      return true;
    }
    
    return false; // For non-quads, use different logic
  }

  /**
   * Checks if the edge loop is complete (forms a closed loop).
   * @param loopPath - Current path of the loop.
   * @param startEdge - The starting edge.
   * @returns True if the loop is complete.
   */
  private isLoopComplete(loopPath: Array<{ edgeKey: string; position: number }>, startEdge: any): boolean {
    if (loopPath.length < 3) return false;
    
    const lastEdgeInfo = loopPath[loopPath.length - 1];
    const lastEdge = this.mesh.edges.get(lastEdgeInfo.edgeKey);
    if (!lastEdge) return false;

    // Check if the last edge connects back to the start edge region
    const startVertices = new Set([startEdge.v0.id, startEdge.v1.id]);
    const lastVertices = new Set([lastEdge.v0.id, lastEdge.v1.id]);
    
    // If edges share a vertex, we might be close to completing the loop
    for (const v of startVertices) {
      if (lastVertices.has(v)) return true;
    }
    
    return false;
  }

  /**
   * Inserts an edge at the specified position, splitting faces as needed.
   * @param edgeKey - The edge to split.
   * @param position - Position along the edge (0.0 to 1.0).
   */
  private insertEdgeAtPosition(edgeKey: string, position: number): void {
    const edge = this.mesh.edges.get(edgeKey);
    if (!edge) return;

    // Calculate the position along the edge
    const v0Pos = edge.v0.position;
    const v1Pos = edge.v1.position;
    const direction = Vector3D.subtract(v1Pos, v0Pos);
    const scaledDirection = new Vector3D(
      direction.x * position,
      direction.y * position, 
      direction.z * position
    );
    const newPos = Vector3D.add(v0Pos, scaledDirection);

    // Create new vertex at the split position
    const newVertex = this.mesh.addVertex(newPos.x, newPos.y, newPos.z);
    if (!newVertex) return;

    // Find faces using this edge and split them
    const facesToSplit = Array.from(edge.faces);
    const insertionData: LoopInsertionData = {
      originalFaceId: -1, // Will be set if we split a face
      newFaceIds: [],
      newVertexIds: [newVertex.id],
      newEdgeKeys: []
    };

    facesToSplit.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (face) {
        const splitResult = this.splitFaceAtEdge(face, edge, newVertex);
        if (splitResult) {
          if (insertionData.originalFaceId === -1) {
            insertionData.originalFaceId = faceId;
          }
          insertionData.newFaceIds.push(...splitResult.newFaceIds);
          insertionData.newEdgeKeys.push(...splitResult.newEdgeKeys);
        }
      }
    });

    this.insertionData.push(insertionData);
  }

  /**
   * Splits a face at a specific edge by inserting a new vertex.
   * @param face - The face to split.
   * @param edge - The edge where the split occurs.
   * @param newVertex - The new vertex to insert.
   * @returns Information about the split result.
   */
  private splitFaceAtEdge(face: any, edge: any, newVertex: any): { newFaceIds: number[]; newEdgeKeys: string[] } | null {
    // This is a simplified implementation
    // A full implementation would handle various face types and splitting patterns
    
    // For now, we'll create a basic split by connecting the new vertex to the opposite vertices
    const newFaceIds: number[] = [];
    const newEdgeKeys: string[] = [];

    try {
      // Remove the original face
      this.mesh.removeFace(face.id);

      // Create new faces based on the split
      // This is a simplified approach - real implementation would be more sophisticated
      const faceVertices = face.vertices;
      const edgeVertexIds = [edge.v0.id, edge.v1.id];
      
      // Find vertices not part of the splitting edge
      const otherVertices = faceVertices.filter((v: any) => !edgeVertexIds.includes(v.id));
      
      if (otherVertices.length > 0) {
        // Create new faces connecting the new vertex to the other vertices
        for (let i = 0; i < otherVertices.length; i++) {
          const v1 = otherVertices[i];
          const v2 = otherVertices[(i + 1) % otherVertices.length];
          
          const newFace = this.mesh.addFace([newVertex.id, v1.id, v2.id], face.materialIndex || undefined);
          if (newFace) {
            newFaceIds.push(newFace.id);
          }
        }
      }

      return { newFaceIds, newEdgeKeys };
    } catch (error) {
      console.error('InsertEdgeLoop: Error splitting face:', error);
      return null;
    }
  }
} 