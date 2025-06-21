import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Edge } from './Edge';

interface BeveledEdgeState {
  originalEdgeKey: string;
  originalV0Id: number;
  originalV1Id: number;
  newVertexIds: number[];
  newFaceIds: number[];
  affectedFaceIds: number[];
  segments: number;
}

/**
 * Command to bevel edges by replacing them with angled or curved surfaces.
 * This creates smooth transitions between faces by rounding or chamfering sharp edges.
 */
export class BevelEdge implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private edgeIds: number[];
  private bevelWidth: number;
  private segments: number; // Number of segments (1 = chamfer, >1 = rounded)
  private useSymmetric: boolean; // Whether to bevel symmetrically on both sides
  
  // Store original state for undo
  private beveledStates: BeveledEdgeState[] = [];
  private originalSelectedEdges: Set<number>;
  
  public readonly description: string;

  /**
   * Creates an instance of BevelEdge command.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param bevelWidth - Width of the bevel.
   * @param segments - Number of segments (1 = chamfer, >1 = rounded bevel).
   * @param useSymmetric - Whether to bevel symmetrically on both faces.
   * @param edgeIds - Optional specific edge IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    bevelWidth: number,
    segments: number = 1,
    useSymmetric: boolean = true,
    edgeIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.bevelWidth = Math.abs(bevelWidth);
    this.segments = Math.max(1, Math.floor(segments));
    this.useSymmetric = useSymmetric;
    
    // Use provided edge IDs or get from selection
    this.edgeIds = edgeIds || Array.from(selectionManager.getSelectedEdgeIds());
    this.originalSelectedEdges = new Set(this.edgeIds);
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.beveledStates = [];
    
    if (this.edgeIds.length === 0) {
      console.warn('BevelEdge: No edges selected or specified.');
      return;
    }

    // Process each edge for beveling
    this.edgeIds.forEach(edgeId => {
      const edge = this.findEdgeById(edgeId);
      if (!edge) {
        console.warn(`BevelEdge: Edge with ID ${edgeId} not found.`);
        return;
      }

      const beveledState = this.bevelSingleEdge(edge);
      if (beveledState) {
        this.beveledStates.push(beveledState);
        
        // Remove original edge from selection
        this.selectionManager.deselectEdge(edgeId);
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Note: Full undo would require complex topology restoration
    console.warn('BevelEdge: Undo is not fully implemented. Edge beveling is currently irreversible.');
    
    // Clear stored state
    this.beveledStates = [];
  }

  /**
   * Bevels a single edge.
   * @param edge - The edge to bevel.
   * @returns Beveled state or null if failed.
   */
  private bevelSingleEdge(edge: Edge): BeveledEdgeState | null {
    const originalKey = edge.key;
    const v0 = edge.v0;
    const v1 = edge.v1;
    const affectedFaceIds = Array.from(edge.faces);

    if (affectedFaceIds.length === 0) {
      console.warn('BevelEdge: Edge has no adjacent faces, cannot bevel.');
      return null;
    }

    // Calculate edge direction and perpendicular vectors
    const edgeDirection = v1.position.subtract(v0.position).normalize();
    const edgeCenter = v0.position.add(v1.position).multiplyScalar(0.5);

    // Calculate bevel normals from adjacent faces
    const bevelNormals = this.calculateBevelNormals(edge, edgeDirection);
    if (bevelNormals.length === 0) {
      console.warn('BevelEdge: Cannot calculate bevel directions.');
      return null;
    }

    const newVertexIds: number[] = [];
    const newFaceIds: number[] = [];

    // Create bevel vertices along the edge
    const vertexRings: number[][] = [];
    
    for (let segment = 0; segment <= this.segments; segment++) {
      const ring: number[] = [];
      const t = segment / this.segments; // 0 to 1
      
      // Calculate positions along edge
      const edgePosition = v0.position.add(v1.position.subtract(v0.position).multiplyScalar(t));
      
      // For each bevel normal, create vertices
      bevelNormals.forEach((normal, normalIndex) => {
        let offset: number;
        
        if (this.segments === 1) {
          // Simple chamfer
          offset = this.bevelWidth;
        } else {
          // Rounded bevel using arc
          const angle = (Math.PI / (bevelNormals.length - 1)) * normalIndex;
          offset = this.bevelWidth * Math.cos(angle);
        }
        
        const bevelPosition = edgePosition.add(normal.multiplyScalar(offset));
        
        // Create new vertex
        const newVertex = this.mesh.addVertex(
          bevelPosition.x,
          bevelPosition.y,
          bevelPosition.z,
          normal.clone() // Use bevel direction as normal
        );
        
        ring.push(newVertex.id);
        newVertexIds.push(newVertex.id);
      });
      
      vertexRings.push(ring);
    }

    // Create bevel faces between vertex rings
    for (let ringIndex = 0; ringIndex < vertexRings.length - 1; ringIndex++) {
      const currentRing = vertexRings[ringIndex];
      const nextRing = vertexRings[ringIndex + 1];
      
      for (let i = 0; i < currentRing.length; i++) {
        const nextI = (i + 1) % currentRing.length;
        
        const v1 = currentRing[i];
        const v2 = currentRing[nextI];
        const v3 = nextRing[nextI];
        const v4 = nextRing[i];
        
        // Create quad face
        const bevelFace = this.mesh.addFace([v1, v2, v3, v4]);
        newFaceIds.push(bevelFace.id);
      }
    }

    // Update affected faces to use new vertices
    this.updateAffectedFaces(affectedFaceIds, v0.id, v1.id, vertexRings);

    // Remove original edge
    this.mesh.removeEdge(v0.id, v1.id);

    return {
      originalEdgeKey: originalKey,
      originalV0Id: v0.id,
      originalV1Id: v1.id,
      newVertexIds,
      newFaceIds,
      affectedFaceIds,
      segments: this.segments
    };
  }

  /**
   * Calculates bevel normal directions from adjacent faces.
   * @param edge - The edge being beveled.
   * @param edgeDirection - Normalized edge direction vector.
   * @returns Array of normal vectors for beveling.
   */
  private calculateBevelNormals(edge: Edge, edgeDirection: Vector3D): Vector3D[] {
    const normals: Vector3D[] = [];
    
    // Get normals from adjacent faces
    const faceNormals: Vector3D[] = [];
    edge.faces.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (face && face.normal) {
        faceNormals.push(face.normal.clone());
      }
    });

    if (faceNormals.length === 0) {
      return normals;
    }

    if (faceNormals.length === 1) {
      // Boundary edge - create bevel perpendicular to face
      const faceNormal = faceNormals[0];
      const bevelNormal = edgeDirection.cross(faceNormal).normalize();
      normals.push(bevelNormal);
    } else if (faceNormals.length === 2) {
      // Interior edge - create bevel between faces
      const normal1 = faceNormals[0];
      const normal2 = faceNormals[1];
      
      // Calculate angle between faces
      const dot = normal1.dot(normal2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      
      // Create bevel normals
      if (this.useSymmetric) {
        // Symmetric bevel
        const bisector = normal1.add(normal2).normalize();
        const bevelNormal = bisector.cross(edgeDirection).normalize();
        normals.push(bevelNormal);
        normals.push(bevelNormal.multiplyScalar(-1));
      } else {
        // Asymmetric bevel
        const bevelNormal1 = normal1.cross(edgeDirection).normalize();
        const bevelNormal2 = normal2.cross(edgeDirection).normalize();
        normals.push(bevelNormal1);
        normals.push(bevelNormal2);
      }
    }

    return normals;
  }

  /**
   * Updates faces affected by the edge bevel.
   * @param faceIds - IDs of affected faces.
   * @param originalV0Id - Original first vertex ID.
   * @param originalV1Id - Original second vertex ID.
   * @param vertexRings - New vertex rings created by beveling.
   */
  private updateAffectedFaces(
    faceIds: number[],
    originalV0Id: number,
    originalV1Id: number,
    vertexRings: number[][]
  ): void {
    faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      // This is a simplified update - in practice, you'd need more sophisticated
      // topology handling to properly integrate beveled edges into existing faces
      console.log(`BevelEdge: Face ${faceId} affected by edge bevel (update not fully implemented)`);
    });
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
    const bevelType = this.segments === 1 ? 'chamfer' : `${this.segments}-segment bevel`;
    const symmetry = this.useSymmetric ? 'symmetric' : 'asymmetric';
    
    return `Bevel ${edgeCount} edge${edgeCount === 1 ? '' : 's'} (${bevelType}, ${symmetry}, width: ${this.bevelWidth.toFixed(3)})`;
  }

  /**
   * Gets bevel statistics.
   * @returns Statistics object.
   */
  getBevelStats(): {
    edgesBeveled: number;
    newVerticesCreated: number;
    newFacesCreated: number;
    segments: number;
    bevelWidth: number;
  } {
    const newVerticesCreated = this.beveledStates.reduce((sum, state) => 
      sum + state.newVertexIds.length, 0);
    const newFacesCreated = this.beveledStates.reduce((sum, state) => 
      sum + state.newFaceIds.length, 0);

    return {
      edgesBeveled: this.beveledStates.length,
      newVerticesCreated,
      newFacesCreated,
      segments: this.segments,
      bevelWidth: this.bevelWidth
    };
  }

  /**
   * Static factory method to create a simple edge chamfer.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param width - Chamfer width.
   * @returns BevelEdge command instance.
   */
  static chamferEdges(
    mesh: Mesh,
    selectionManager: SelectionManager,
    width: number
  ): BevelEdge {
    return new BevelEdge(mesh, selectionManager, width, 1, true);
  }

  /**
   * Static factory method to create rounded edge bevel.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param width - Bevel width.
   * @param segments - Number of segments for rounding.
   * @returns BevelEdge command instance.
   */
  static roundedBevel(
    mesh: Mesh,
    selectionManager: SelectionManager,
    width: number,
    segments: number = 3
  ): BevelEdge {
    return new BevelEdge(mesh, selectionManager, width, segments, true);
  }
} 