import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Face } from './Face';

interface FaceInsetState {
  originalFaceId: number;
  newInnerFaceId: number;
  newConnectingFaceIds: number[];
  newVertexIds: number[];
}

/**
 * Command to inset faces by offsetting their perimeter inward or outward.
 * Creates a new face inside the original with connecting faces between them.
 */
export class InsetFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  private insetAmount: number;
  private useIndividual: boolean; // True for individual face insets, false for region inset
  
  // Store original state for undo
  private insetStates: FaceInsetState[] = [];
  private originalSelectedFaces: Set<number>;
  
  public readonly description: string;

  /**
   * Creates an instance of InsetFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param insetAmount - Amount to inset (positive = inward, negative = outward).
   * @param useIndividual - Whether to inset each face individually or as a region.
   * @param faceIds - Optional specific face IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    insetAmount: number,
    useIndividual: boolean = true,
    faceIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.insetAmount = insetAmount;
    this.useIndividual = useIndividual;
    
    // Use provided face IDs or get from selection
    this.faceIds = faceIds || Array.from(selectionManager.getSelectedFaceIds());
    this.originalSelectedFaces = new Set(this.faceIds);
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.insetStates = [];
    
    if (this.faceIds.length === 0) {
      console.warn('InsetFaces: No faces selected or specified.');
      return;
    }

    if (this.useIndividual) {
      this.executeIndividualInsets();
    } else {
      this.executeRegionInset();
    }

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Remove created faces and vertices in reverse order
    this.insetStates.reverse().forEach(state => {
      // Remove connecting faces
      state.newConnectingFaceIds.forEach(faceId => {
        this.mesh.removeFace(faceId);
      });
      
      // Remove inner face
      this.mesh.removeFace(state.newInnerFaceId);
      
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
    this.insetStates = [];
  }

  /**
   * Executes individual face insets.
   */
  private executeIndividualInsets(): void {
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) {
        console.warn(`InsetFaces: Face with ID ${faceId} not found.`);
        return;
      }

      const insetState = this.insetSingleFace(face);
      if (insetState) {
        this.insetStates.push(insetState);
        
        // Remove original face from selection and add inner face
        this.selectionManager.deselectFace(faceId);
        this.selectionManager.selectFace(insetState.newInnerFaceId, true);
      }
    });
  }

  /**
   * Executes region-based inset (not implemented in this basic version).
   */
  private executeRegionInset(): void {
    console.warn('InsetFaces: Region inset not yet implemented. Using individual insets.');
    this.executeIndividualInsets();
  }

  /**
   * Insets a single face.
   * @param face - The face to inset.
   * @returns Inset state or null if failed.
   */
  private insetSingleFace(face: Face): FaceInsetState | null {
    if (face.vertices.length < 3) {
      console.warn('InsetFaces: Cannot inset face with less than 3 vertices.');
      return null;
    }

    // Calculate face normal and center
    const faceNormal = this.calculateFaceNormal(face);
    const faceCenter = this.calculateFaceCenter(face);
    
    if (!faceNormal) {
      console.warn('InsetFaces: Could not calculate face normal.');
      return null;
    }

    // Create new vertices for the inset face
    const newVertexIds: number[] = [];
    const originalVertices = face.vertices;
    
    originalVertices.forEach(vertex => {
      // Calculate inset position
      const toCenter = faceCenter.subtract(vertex.position).normalize();
      const insetPosition = vertex.position.add(toCenter.multiplyScalar(Math.abs(this.insetAmount)));
      
      // Create new vertex
      const newVertex = this.mesh.addVertex(
        insetPosition.x, 
        insetPosition.y, 
        insetPosition.z,
        vertex.normal?.clone(),
        vertex.uv ? { ...vertex.uv } : undefined
      );
      
      newVertexIds.push(newVertex.id);
    });

    // Create inner face
    const innerFace = this.mesh.addFace(newVertexIds, face.materialIndex ?? undefined);
    
    // Create connecting faces between original and inner face
    const connectingFaceIds: number[] = [];
    
    for (let i = 0; i < originalVertices.length; i++) {
      const nextI = (i + 1) % originalVertices.length;
      
      const v1 = originalVertices[i].id;
      const v2 = originalVertices[nextI].id;
      const v3 = newVertexIds[nextI];
      const v4 = newVertexIds[i];
      
      // Create quad face connecting original edge to inner edge
      const connectingFace = this.mesh.addFace([v1, v2, v3, v4], face.materialIndex ?? undefined);
      connectingFaceIds.push(connectingFace.id);
    }

    // Remove original face
    this.mesh.removeFace(face.id);

    return {
      originalFaceId: face.id,
      newInnerFaceId: innerFace.id,
      newConnectingFaceIds: connectingFaceIds,
      newVertexIds
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
    const direction = this.insetAmount >= 0 ? 'inward' : 'outward';
    const type = this.useIndividual ? 'individual' : 'region';
    
    return `Inset ${faceCount} face${faceCount === 1 ? '' : 's'} ${direction} by ${Math.abs(this.insetAmount).toFixed(3)} (${type})`;
  }

  /**
   * Gets inset statistics.
   * @returns Statistics object.
   */
  getInsetStats(): {
    facesInset: number;
    newFacesCreated: number;
    newVerticesCreated: number;
    insetAmount: number;
  } {
    const newFacesCreated = this.insetStates.reduce((sum, state) => 
      sum + 1 + state.newConnectingFaceIds.length, 0);
    const newVerticesCreated = this.insetStates.reduce((sum, state) => 
      sum + state.newVertexIds.length, 0);

    return {
      facesInset: this.insetStates.length,
      newFacesCreated,
      newVerticesCreated,
      insetAmount: this.insetAmount
    };
  }

  /**
   * Static factory method to inset faces inward.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param amount - Inset amount (positive value).
   * @param individual - Whether to inset individually.
   * @returns InsetFaces command instance.
   */
  static insetInward(
    mesh: Mesh,
    selectionManager: SelectionManager,
    amount: number,
    individual: boolean = true
  ): InsetFaces {
    return new InsetFaces(mesh, selectionManager, Math.abs(amount), individual);
  }

  /**
   * Static factory method to inset faces outward.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param amount - Inset amount (positive value).
   * @param individual - Whether to inset individually.
   * @returns InsetFaces command instance.
   */
  static insetOutward(
    mesh: Mesh,
    selectionManager: SelectionManager,
    amount: number,
    individual: boolean = true
  ): InsetFaces {
    return new InsetFaces(mesh, selectionManager, -Math.abs(amount), individual);
  }
} 