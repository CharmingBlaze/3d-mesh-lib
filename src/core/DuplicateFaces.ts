import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Face } from './Face';

interface DuplicatedFaceState {
  originalFaceId: number;
  duplicatedFaceId: number;
  duplicatedVertexIds: number[];
  offset: Vector3D;
}

/**
 * Command to duplicate faces by creating copies of selected faces.
 * The duplicates can be offset from originals and become loose geometry.
 */
export class DuplicateFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  private offset: Vector3D;
  private useLooseGeometry: boolean;
  
  // Store original state for undo
  private duplicatedStates: DuplicatedFaceState[] = [];
  private originalSelectedFaces: Set<number>;
  
  public readonly description: string;

  /**
   * Creates an instance of DuplicateFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param offset - Vector to offset duplicated faces.
   * @param useLooseGeometry - Whether to create loose geometry (true) or stay connected (false).
   * @param faceIds - Optional specific face IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    offset: Vector3D = new Vector3D(0, 0, 0),
    useLooseGeometry: boolean = true,
    faceIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.offset = offset.clone();
    this.useLooseGeometry = useLooseGeometry;
    
    // Use provided face IDs or get from selection
    this.faceIds = faceIds || Array.from(selectionManager.getSelectedFaceIds());
    this.originalSelectedFaces = new Set(this.faceIds);
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.duplicatedStates = [];
    
    if (this.faceIds.length === 0) {
      console.warn('DuplicateFaces: No faces selected or specified.');
      return;
    }

    // Process each face for duplication
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) {
        console.warn(`DuplicateFaces: Face with ID ${faceId} not found.`);
        return;
      }

      const duplicatedState = this.duplicateSingleFace(face);
      if (duplicatedState) {
        this.duplicatedStates.push(duplicatedState);
        
        // Select the duplicated face
        this.selectionManager.selectFace(duplicatedState.duplicatedFaceId, true);
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Remove duplicated faces and vertices in reverse order
    this.duplicatedStates.reverse().forEach(state => {
      // Remove duplicated face
      this.mesh.removeFace(state.duplicatedFaceId);
      
      // Remove duplicated vertices if using loose geometry
      if (this.useLooseGeometry) {
        state.duplicatedVertexIds.forEach(vertexId => {
          this.mesh.removeVertex(vertexId);
        });
      }
      
      // Restore original face selection if it was selected
      if (this.originalSelectedFaces.has(state.originalFaceId)) {
        this.selectionManager.selectFace(state.originalFaceId, true);
      }
    });
    
    // Update mesh bounding box
    this.mesh.computeBoundingBox();
    
    // Clear stored state
    this.duplicatedStates = [];
  }

  /**
   * Duplicates a single face.
   * @param face - The face to duplicate.
   * @returns Duplicated state or null if failed.
   */
  private duplicateSingleFace(face: Face): DuplicatedFaceState | null {
    if (face.vertices.length < 3) {
      console.warn('DuplicateFaces: Cannot duplicate face with less than 3 vertices.');
      return null;
    }

    const duplicatedVertexIds: number[] = [];
    
    if (this.useLooseGeometry) {
      // Create new vertices for loose geometry
      face.vertices.forEach(vertex => {
        const newPosition = vertex.position.add(this.offset);
        
        const newVertex = this.mesh.addVertex(
          newPosition.x,
          newPosition.y,
          newPosition.z,
          vertex.normal?.clone(),
          vertex.uv ? { ...vertex.uv } : undefined
        );
        
        duplicatedVertexIds.push(newVertex.id);
      });
    } else {
      // Use existing vertices (connected geometry) but offset positions
      face.vertices.forEach(vertex => {
        // For connected geometry, we need to check if vertex is already offset
        // This is a simplified approach - in practice, you'd want more sophisticated handling
        const offsetVertex = this.mesh.addVertex(
          vertex.position.x + this.offset.x,
          vertex.position.y + this.offset.y,
          vertex.position.z + this.offset.z,
          vertex.normal?.clone(),
          vertex.uv ? { ...vertex.uv } : undefined
        );
        duplicatedVertexIds.push(offsetVertex.id);
      });
    }

    // Create duplicated face
    const duplicatedFace = this.mesh.addFace(duplicatedVertexIds, face.materialIndex ?? undefined);

    return {
      originalFaceId: face.id,
      duplicatedFaceId: duplicatedFace.id,
      duplicatedVertexIds,
      offset: this.offset.clone()
    };
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const faceCount = this.faceIds.length;
    const geometryType = this.useLooseGeometry ? 'loose' : 'connected';
    const offsetMagnitude = this.offset.length();
    
    return `Duplicate ${faceCount} face${faceCount === 1 ? '' : 's'} (${geometryType}, offset: ${offsetMagnitude.toFixed(3)})`;
  }

  /**
   * Gets duplication statistics.
   * @returns Statistics object.
   */
  getDuplicationStats(): {
    facesDuplicated: number;
    newFacesCreated: number;
    newVerticesCreated: number;
    offsetMagnitude: number;
  } {
    const newVerticesCreated = this.duplicatedStates.reduce((sum, state) => 
      sum + state.duplicatedVertexIds.length, 0);

    return {
      facesDuplicated: this.duplicatedStates.length,
      newFacesCreated: this.duplicatedStates.length,
      newVerticesCreated,
      offsetMagnitude: this.offset.length()
    };
  }

  /**
   * Static factory method to duplicate faces with no offset (in place).
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param loose - Whether to create loose geometry.
   * @returns DuplicateFaces command instance.
   */
  static duplicateInPlace(
    mesh: Mesh,
    selectionManager: SelectionManager,
    loose: boolean = true
  ): DuplicateFaces {
    return new DuplicateFaces(mesh, selectionManager, new Vector3D(0, 0, 0), loose);
  }

  /**
   * Static factory method to duplicate faces along their normal.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param distance - Distance along normal to offset.
   * @param loose - Whether to create loose geometry.
   * @returns DuplicateFaces command instance.
   */
  static duplicateAlongNormal(
    mesh: Mesh,
    selectionManager: SelectionManager,
    distance: number,
    loose: boolean = true
  ): DuplicateFaces {
    // Calculate average normal of selected faces
    const selectedFaceIds = Array.from(selectionManager.getSelectedFaceIds());
    let averageNormal = new Vector3D(0, 0, 0);
    let validNormals = 0;

    selectedFaceIds.forEach(faceId => {
      const face = mesh.getFace(faceId);
      if (face && face.normal) {
        averageNormal = averageNormal.add(face.normal);
        validNormals++;
      }
    });

    if (validNormals > 0) {
      averageNormal = averageNormal.multiplyScalar(1 / validNormals).normalize();
      const offset = averageNormal.multiplyScalar(distance);
      return new DuplicateFaces(mesh, selectionManager, offset, loose);
    } else {
      // Fallback to no offset if no normals available
      return new DuplicateFaces(mesh, selectionManager, new Vector3D(0, 0, 0), loose);
    }
  }

  /**
   * Static factory method to duplicate faces with custom offset.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param offset - Custom offset vector.
   * @param loose - Whether to create loose geometry.
   * @returns DuplicateFaces command instance.
   */
  static duplicateWithOffset(
    mesh: Mesh,
    selectionManager: SelectionManager,
    offset: Vector3D,
    loose: boolean = true
  ): DuplicateFaces {
    return new DuplicateFaces(mesh, selectionManager, offset, loose);
  }
} 