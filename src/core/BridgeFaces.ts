import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Face } from './Face';
import { Edge } from './Edge';

interface BridgeState {
  firstLoopFaceIds: number[];
  secondLoopFaceIds: number[];
  bridgeFaceIds: number[];
  segments: number;
}

/**
 * Command to bridge between two face loops with connecting geometry.
 * Creates a tube-like connection between two face loops or edge loops.
 */
export class BridgeFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private firstLoopFaceIds: number[];
  private secondLoopFaceIds: number[];
  private segments: number;
  private interpolation: 'linear' | 'curved';
  
  // Store original state for undo
  private bridgeState: BridgeState | null = null;
  
  public readonly description: string;

  /**
   * Creates an instance of BridgeFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param firstLoopFaceIds - Face IDs of the first loop.
   * @param secondLoopFaceIds - Face IDs of the second loop.
   * @param segments - Number of segments in the bridge.
   * @param interpolation - Interpolation type for the bridge.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    firstLoopFaceIds: number[],
    secondLoopFaceIds: number[],
    segments: number = 1,
    interpolation: 'linear' | 'curved' = 'linear'
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.firstLoopFaceIds = [...firstLoopFaceIds];
    this.secondLoopFaceIds = [...secondLoopFaceIds];
    this.segments = Math.max(1, segments);
    this.interpolation = interpolation;
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.bridgeState = null;
    
    if (this.firstLoopFaceIds.length === 0 || this.secondLoopFaceIds.length === 0) {
      console.warn('BridgeFaces: Need faces in both loops to create bridge.');
      return;
    }

    const bridgeResult = this.createBridge();
    if (bridgeResult) {
      this.bridgeState = bridgeResult;
    }

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    if (!this.bridgeState) return;

    // Remove bridge faces
    this.bridgeState.bridgeFaceIds.forEach(faceId => {
      this.mesh.removeFace(faceId);
    });

    // Note: Restoring original faces is complex
    console.warn('BridgeFaces: Undo is not fully implemented. Bridge creation is currently irreversible.');
    
    // Clear stored state
    this.bridgeState = null;
  }

  /**
   * Creates the bridge between face loops.
   * @returns Bridge state or null if failed.
   */
  private createBridge(): BridgeState | null {
    // Extract edge loops from face selections
    const firstLoop = this.extractEdgeLoop(this.firstLoopFaceIds);
    const secondLoop = this.extractEdgeLoop(this.secondLoopFaceIds);

    if (!firstLoop || !secondLoop) {
      console.warn('BridgeFaces: Could not extract valid edge loops from face selections.');
      return null;
    }

    if (firstLoop.length !== secondLoop.length) {
      console.warn('BridgeFaces: Edge loops must have the same number of vertices.');
      return null;
    }

    const bridgeFaceIds: number[] = [];

    // Create bridge segments
    for (let segment = 0; segment < this.segments; segment++) {
      const t1 = segment / this.segments;
      const t2 = (segment + 1) / this.segments;

      // Create intermediate vertex rings if needed
      const ring1 = this.interpolateVertexRing(firstLoop, secondLoop, t1);
      const ring2 = this.interpolateVertexRing(firstLoop, secondLoop, t2);

      // Create bridge faces between rings
      for (let i = 0; i < ring1.length; i++) {
        const nextI = (i + 1) % ring1.length;
        
        // Create quad face
        const faceVertexIds = [
          ring1[i],
          ring1[nextI],
          ring2[nextI],
          ring2[i]
        ];

        const bridgeFace = this.mesh.addFace(faceVertexIds);
        bridgeFaceIds.push(bridgeFace.id);
      }
    }

    return {
      firstLoopFaceIds: [...this.firstLoopFaceIds],
      secondLoopFaceIds: [...this.secondLoopFaceIds],
      bridgeFaceIds,
      segments: this.segments
    };
  }

  /**
   * Extracts edge loop vertices from face selection.
   * @param faceIds - IDs of faces to extract edge loop from.
   * @returns Array of vertex IDs forming the edge loop, or null if invalid.
   */
  private extractEdgeLoop(faceIds: number[]): number[] | null {
    if (faceIds.length === 0) return null;

    // For single face, use its boundary
    if (faceIds.length === 1) {
      const face = this.mesh.getFace(faceIds[0]);
      return face ? face.vertices.map(v => v.id) : null;
    }

    // For multiple faces, find the boundary edges
    const boundaryEdges = this.findBoundaryEdges(faceIds);
    if (boundaryEdges.length === 0) return null;

    // Convert boundary edges to ordered vertex loop
    return this.edgesToVertexLoop(boundaryEdges);
  }

  /**
   * Finds boundary edges of a face selection.
   * @param faceIds - Face IDs to analyze.
   * @returns Array of boundary edges.
   */
  private findBoundaryEdges(faceIds: number[]): Edge[] {
    const faceSet = new Set(faceIds);
    const boundaryEdges: Edge[] = [];

    faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      face.edges.forEach(edge => {
        // Check if edge is on boundary (only one face in our selection)
        const adjacentFacesInSelection = Array.from(edge.faces).filter(id => faceSet.has(id));
        if (adjacentFacesInSelection.length === 1) {
          boundaryEdges.push(edge);
        }
      });
    });

    return boundaryEdges;
  }

  /**
   * Converts boundary edges to an ordered vertex loop.
   * @param edges - Boundary edges.
   * @returns Ordered vertex IDs or null if can't form loop.
   */
  private edgesToVertexLoop(edges: Edge[]): number[] | null {
    if (edges.length === 0) return null;

    const vertexLoop: number[] = [];
    const usedEdges = new Set<string>();
    
    // Start with first edge
    let currentEdge = edges[0];
    vertexLoop.push(currentEdge.v0.id);
    vertexLoop.push(currentEdge.v1.id);
    usedEdges.add(currentEdge.key);

    // Find connected edges to form loop
    while (usedEdges.size < edges.length) {
      const lastVertexId = vertexLoop[vertexLoop.length - 1];
      let foundNext = false;

      for (const edge of edges) {
        if (usedEdges.has(edge.key)) continue;

        if (edge.v0.id === lastVertexId) {
          vertexLoop.push(edge.v1.id);
          usedEdges.add(edge.key);
          foundNext = true;
          break;
        } else if (edge.v1.id === lastVertexId) {
          vertexLoop.push(edge.v0.id);
          usedEdges.add(edge.key);
          foundNext = true;
          break;
        }
      }

      if (!foundNext) break;
    }

    // Remove duplicate if it's a closed loop
    if (vertexLoop.length > 2 && vertexLoop[0] === vertexLoop[vertexLoop.length - 1]) {
      vertexLoop.pop();
    }

    return vertexLoop;
  }

  /**
   * Interpolates between two vertex rings.
   * @param ring1 - First vertex ring.
   * @param ring2 - Second vertex ring.
   * @param t - Interpolation factor (0-1).
   * @returns Interpolated vertex IDs.
   */
  private interpolateVertexRing(ring1: number[], ring2: number[], t: number): number[] {
    if (t === 0) return [...ring1];
    if (t === 1) return [...ring2];

    const interpolatedRing: number[] = [];

    for (let i = 0; i < ring1.length; i++) {
      const v1 = this.mesh.getVertex(ring1[i]);
      const v2 = this.mesh.getVertex(ring2[i]);

      if (!v1 || !v2) continue;

      // Interpolate position
      let interpolatedPosition: Vector3D;
      
      if (this.interpolation === 'linear') {
        interpolatedPosition = v1.position.add(
          v2.position.subtract(v1.position).multiplyScalar(t)
        );
      } else {
        // Curved interpolation (simple arc)
        const midpoint = v1.position.add(v2.position).multiplyScalar(0.5);
        const direction = v2.position.subtract(v1.position);
        const perpendicular = new Vector3D(-direction.z, 0, direction.x).normalize();
        const arcHeight = direction.length() * 0.2; // 20% arc height
        
        const arc = Math.sin(t * Math.PI) * arcHeight;
        interpolatedPosition = v1.position.add(direction.multiplyScalar(t))
          .add(perpendicular.multiplyScalar(arc));
      }

      // Create interpolated vertex
      const newVertex = this.mesh.addVertex(
        interpolatedPosition.x,
        interpolatedPosition.y,
        interpolatedPosition.z
      );

      interpolatedRing.push(newVertex.id);
    }

    return interpolatedRing;
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    return `Bridge ${this.firstLoopFaceIds.length} and ${this.secondLoopFaceIds.length} faces (${this.segments} segments, ${this.interpolation})`;
  }

  /**
   * Gets bridge statistics.
   * @returns Statistics object.
   */
  getBridgeStats(): {
    firstLoopSize: number;
    secondLoopSize: number;
    bridgeFacesCreated: number;
    segments: number;
  } {
    return {
      firstLoopSize: this.firstLoopFaceIds.length,
      secondLoopSize: this.secondLoopFaceIds.length,
      bridgeFacesCreated: this.bridgeState?.bridgeFaceIds.length || 0,
      segments: this.segments
    };
  }

  /**
   * Static factory method to create a simple bridge.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param firstLoop - First face loop.
   * @param secondLoop - Second face loop.
   * @returns BridgeFaces command instance.
   */
  static simpleBridge(
    mesh: Mesh,
    selectionManager: SelectionManager,
    firstLoop: number[],
    secondLoop: number[]
  ): BridgeFaces {
    return new BridgeFaces(mesh, selectionManager, firstLoop, secondLoop, 1, 'linear');
  }
} 