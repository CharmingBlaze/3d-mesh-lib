import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Face } from './Face';

interface BeveledFaceState {
  originalFaceId: number;
  newCenterFaceId: number;
  bevelFaceIds: number[];
  newVertexIds: number[];
  segments: number;
}

/**
 * Command to bevel faces by creating rounded or chamfered edges.
 * Unlike inset which moves edges inward, bevel creates angled surfaces that transition
 * smoothly from the face to surrounding geometry.
 */
export class BevelFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  private bevelWidth: number;
  private segments: number; // Number of segments for rounded bevel (1 = chamfer, >1 = rounded)
  private useIndividual: boolean;
  
  // Store original state for undo
  private beveledStates: BeveledFaceState[] = [];
  private originalSelectedFaces: Set<number>;
  
  public readonly description: string;

  /**
   * Creates an instance of BevelFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param bevelWidth - Width of the bevel.
   * @param segments - Number of segments (1 = chamfer, >1 = rounded bevel).
   * @param useIndividual - Whether to bevel each face individually or as a region.
   * @param faceIds - Optional specific face IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    bevelWidth: number,
    segments: number = 1,
    useIndividual: boolean = true,
    faceIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.bevelWidth = Math.abs(bevelWidth);
    this.segments = Math.max(1, Math.floor(segments));
    this.useIndividual = useIndividual;
    
    // Use provided face IDs or get from selection
    this.faceIds = faceIds || Array.from(selectionManager.getSelectedFaceIds());
    this.originalSelectedFaces = new Set(this.faceIds);
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.beveledStates = [];
    
    if (this.faceIds.length === 0) {
      console.warn('BevelFaces: No faces selected or specified.');
      return;
    }

    if (this.useIndividual) {
      this.executeIndividualBevels();
    } else {
      this.executeRegionBevel();
    }

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Remove created faces and vertices in reverse order
    this.beveledStates.reverse().forEach(state => {
      // Remove bevel faces
      state.bevelFaceIds.forEach(faceId => {
        this.mesh.removeFace(faceId);
      });
      
      // Remove center face
      this.mesh.removeFace(state.newCenterFaceId);
      
      // Remove new vertices
      state.newVertexIds.forEach(vertexId => {
        this.mesh.removeVertex(vertexId);
      });
      
      // Restore original face selection if it was selected
      if (this.originalSelectedFaces.has(state.originalFaceId)) {
        this.selectionManager.selectFace(state.originalFaceId, true);
      }
    });
    
    // Update mesh bounding box
    this.mesh.computeBoundingBox();
    
    // Clear stored state
    this.beveledStates = [];
  }

  /**
   * Executes individual face bevels.
   */
  private executeIndividualBevels(): void {
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) {
        console.warn(`BevelFaces: Face with ID ${faceId} not found.`);
        return;
      }

      const beveledState = this.bevelSingleFace(face);
      if (beveledState) {
        this.beveledStates.push(beveledState);
        
        // Remove original face from selection and add center face
        this.selectionManager.deselectFace(faceId);
        this.selectionManager.selectFace(beveledState.newCenterFaceId, true);
      }
    });
  }

  /**
   * Executes region-based bevel (not implemented in this basic version).
   */
  private executeRegionBevel(): void {
    console.warn('BevelFaces: Region bevel not yet implemented. Using individual bevels.');
    this.executeIndividualBevels();
  }

  /**
   * Bevels a single face.
   * @param face - The face to bevel.
   * @returns Beveled state or null if failed.
   */
  private bevelSingleFace(face: Face): BeveledFaceState | null {
    if (face.vertices.length < 3) {
      console.warn('BevelFaces: Cannot bevel face with less than 3 vertices.');
      return null;
    }

    // Calculate face normal and center
    const faceNormal = this.calculateFaceNormal(face);
    const faceCenter = this.calculateFaceCenter(face);
    
    if (!faceNormal) {
      console.warn('BevelFaces: Could not calculate face normal.');
      return null;
    }

    const originalVertices = face.vertices;
    const newVertexIds: number[] = [];
    const bevelFaceIds: number[] = [];

    // Create beveled vertex rings
    const vertexRings: number[][] = [];
    
    for (let segment = 0; segment <= this.segments; segment++) {
      const ring: number[] = [];
      const t = segment / this.segments; // 0 to 1
      
      // Calculate offset based on segment
      let inwardOffset: number;
      let normalOffset: number;
      
      if (this.segments === 1) {
        // Simple chamfer
        inwardOffset = this.bevelWidth * t;
        normalOffset = this.bevelWidth * t * 0.5; // 45-degree chamfer
      } else {
        // Rounded bevel using quarter circle
        const angle = (Math.PI / 2) * t;
        inwardOffset = this.bevelWidth * Math.sin(angle);
        normalOffset = this.bevelWidth * (1 - Math.cos(angle));
      }
      
      originalVertices.forEach(vertex => {
        // Calculate edge directions to adjacent vertices
        const vertexIndex = originalVertices.indexOf(vertex);
        const prevVertex = originalVertices[(vertexIndex - 1 + originalVertices.length) % originalVertices.length];
        const nextVertex = originalVertices[(vertexIndex + 1) % originalVertices.length];
        
        // Calculate bisector direction (average of normalized edge directions)
        const toPrev = prevVertex.position.subtract(vertex.position).normalize();
        const toNext = nextVertex.position.subtract(vertex.position).normalize();
        const bisector = toPrev.add(toNext).normalize();
        
        // If bisector is zero (180-degree angle), use face normal
        const inwardDirection = bisector.length() > 0.1 ? 
          bisector : 
          faceCenter.subtract(vertex.position).normalize();
        
        // Calculate new position
        const inwardMovement = inwardDirection.multiplyScalar(inwardOffset);
        const normalMovement = faceNormal.multiplyScalar(normalOffset);
        const newPosition = vertex.position.add(inwardMovement).add(normalMovement);
        
        // Create new vertex
        const newVertex = this.mesh.addVertex(
          newPosition.x,
          newPosition.y,
          newPosition.z,
          vertex.normal?.clone(),
          vertex.uv ? { ...vertex.uv } : undefined
        );
        
        ring.push(newVertex.id);
        newVertexIds.push(newVertex.id);
      });
      
      vertexRings.push(ring);
    }

    // Create center face from the innermost ring
    const centerRing = vertexRings[vertexRings.length - 1];
    const centerFace = this.mesh.addFace(centerRing, face.materialIndex ?? undefined);

    // Create bevel faces between rings
    for (let ringIndex = 0; ringIndex < vertexRings.length - 1; ringIndex++) {
      const outerRing = ringIndex === 0 ? 
        originalVertices.map(v => v.id) : 
        vertexRings[ringIndex];
      const innerRing = vertexRings[ringIndex + 1];
      
      // Create quad faces between rings
      for (let i = 0; i < outerRing.length; i++) {
        const nextI = (i + 1) % outerRing.length;
        
        const v1 = outerRing[i];
        const v2 = outerRing[nextI];
        const v3 = innerRing[nextI];
        const v4 = innerRing[i];
        
        const bevelFace = this.mesh.addFace([v1, v2, v3, v4], face.materialIndex ?? undefined);
        bevelFaceIds.push(bevelFace.id);
      }
    }

    // Remove original face
    this.mesh.removeFace(face.id);

    return {
      originalFaceId: face.id,
      newCenterFaceId: centerFace.id,
      bevelFaceIds,
      newVertexIds,
      segments: this.segments
    };
  }

  /**
   * Calculates the normal of a face.
   * @param face - The face to calculate normal for.
   * @returns Face normal or null if calculation fails.
   */
  private calculateFaceNormal(face: Face): Vector3D | null {
    if (face.normal) {
      return face.normal.clone();
    }

    if (face.vertices.length < 3) {
      return null;
    }

    const v0 = face.vertices[0].position;
    const v1 = face.vertices[1].position;
    const v2 = face.vertices[2].position;

    const edge1 = v1.subtract(v0);
    const edge2 = v2.subtract(v0);
    
    return edge1.cross(edge2).normalize();
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
    const bevelType = this.segments === 1 ? 'chamfer' : `${this.segments}-segment bevel`;
    const type = this.useIndividual ? 'individual' : 'region';
    
    return `Bevel ${faceCount} face${faceCount === 1 ? '' : 's'} (${bevelType}, width: ${this.bevelWidth.toFixed(3)}, ${type})`;
  }

  /**
   * Gets bevel statistics.
   * @returns Statistics object.
   */
  getBevelStats(): {
    facesBeveled: number;
    newFacesCreated: number;
    newVerticesCreated: number;
    segments: number;
    bevelWidth: number;
  } {
    const newFacesCreated = this.beveledStates.reduce((sum, state) => 
      sum + 1 + state.bevelFaceIds.length, 0);
    const newVerticesCreated = this.beveledStates.reduce((sum, state) => 
      sum + state.newVertexIds.length, 0);

    return {
      facesBeveled: this.beveledStates.length,
      newFacesCreated,
      newVerticesCreated,
      segments: this.segments,
      bevelWidth: this.bevelWidth
    };
  }

  /**
   * Static factory method to create a simple chamfer (45-degree bevel).
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param width - Chamfer width.
   * @param individual - Whether to chamfer individually.
   * @returns BevelFaces command instance.
   */
  static chamfer(
    mesh: Mesh,
    selectionManager: SelectionManager,
    width: number,
    individual: boolean = true
  ): BevelFaces {
    return new BevelFaces(mesh, selectionManager, width, 1, individual);
  }

  /**
   * Static factory method to create a rounded bevel.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param width - Bevel width.
   * @param segments - Number of segments for rounding.
   * @param individual - Whether to bevel individually.
   * @returns BevelFaces command instance.
   */
  static rounded(
    mesh: Mesh,
    selectionManager: SelectionManager,
    width: number,
    segments: number = 3,
    individual: boolean = true
  ): BevelFaces {
    return new BevelFaces(mesh, selectionManager, width, segments, individual);
  }
} 