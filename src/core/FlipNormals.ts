import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';

interface FlippedNormalState {
  faceId: number;
  originalNormal: Vector3D;
}

/**
 * Command to flip face normals without changing vertex order.
 * This affects lighting calculations and face orientation.
 */
export class FlipNormals implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  
  // Store original state for undo
  private flippedStates: FlippedNormalState[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of FlipNormals command.
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
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.flippedStates = [];
    
    if (this.faceIds.length === 0) {
      console.warn('FlipNormals: No faces selected or specified.');
      return;
    }

    // Process each face for normal flipping
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) {
        console.warn(`FlipNormals: Face with ID ${faceId} not found.`);
        return;
      }

      if (face.normal) {
        // Store original normal
        this.flippedStates.push({
          faceId,
          originalNormal: face.normal.clone()
        });

        // Flip the normal
        face.normal = face.normal.multiplyScalar(-1);
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Restore original normals
    this.flippedStates.forEach(state => {
      const face = this.mesh.getFace(state.faceId);
      if (face) {
        face.normal = state.originalNormal.clone();
      }
    });
    
    // Update mesh bounding box
    this.mesh.computeBoundingBox();
    
    // Clear stored state
    this.flippedStates = [];
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const faceCount = this.faceIds.length;
    return `Flip normals on ${faceCount} face${faceCount === 1 ? '' : 's'}`;
  }

  /**
   * Gets flip statistics.
   * @returns Statistics object.
   */
  getFlipStats(): {
    normalsFlipped: number;
  } {
    return {
      normalsFlipped: this.flippedStates.length
    };
  }
} 