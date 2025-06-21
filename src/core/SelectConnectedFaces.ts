import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';

/**
 * Command to select all faces connected to the currently selected faces.
 * Uses a flood-fill algorithm to find all faces reachable through shared edges.
 */
export class SelectConnectedFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private originalSelectedFaceIds: Set<number>;
  private newlySelectedFaceIds: Set<number> = new Set();
  public readonly description: string;

  /**
   * Creates an instance of SelectConnectedFaces command.
   * @param mesh - The mesh containing the faces.
   * @param selectionManager - The selection manager to modify.
   * @param startFromSelection - If true, uses current selection as seeds. If false, requires at least one face to be selected.
   */
  constructor(mesh: Mesh, selectionManager: SelectionManager, startFromSelection: boolean = true) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.originalSelectedFaceIds = new Set(selectionManager.getSelectedFaceIds());
    
    if (startFromSelection && this.originalSelectedFaceIds.size === 0) {
      this.description = 'Select connected faces (no faces selected to start from)';
    } else {
      this.description = `Select faces connected to ${this.originalSelectedFaceIds.size} selected face${this.originalSelectedFaceIds.size === 1 ? '' : 's'}`;
    }
  }

  execute(): void {
    this.newlySelectedFaceIds.clear();
    
    if (this.originalSelectedFaceIds.size === 0) {
      console.warn('SelectConnectedFaces: No faces selected to start flood-fill from.');
      return;
    }

    // Use flood-fill algorithm to find all connected faces
    const visited = new Set<number>();
    const queue: number[] = Array.from(this.originalSelectedFaceIds);
    
    // Add original selection to visited
    this.originalSelectedFaceIds.forEach(faceId => visited.add(faceId));

    while (queue.length > 0) {
      const currentFaceId = queue.shift()!;
      const currentFace = this.mesh.getFace(currentFaceId);
      
      if (!currentFace) continue;

      // Find all faces that share an edge with current face
      const connectedFaces = this.findConnectedFaces(currentFace.id);
      
      for (const connectedFaceId of connectedFaces) {
        if (!visited.has(connectedFaceId)) {
          visited.add(connectedFaceId);
          queue.push(connectedFaceId);
          
          // Select the newly found face
          this.selectionManager.selectFace(connectedFaceId, true);
          this.newlySelectedFaceIds.add(connectedFaceId);
        }
      }
    }
  }

  undo(): void {
    // Remove newly selected faces from selection
    this.newlySelectedFaceIds.forEach(faceId => {
      this.selectionManager.deselectFace(faceId);
    });
    
    this.newlySelectedFaceIds.clear();
  }

  /**
   * Finds all faces that share at least one edge with the given face.
   * @param faceId - The ID of the face to find connections for.
   * @returns Array of connected face IDs.
   */
  private findConnectedFaces(faceId: number): number[] {
    const face = this.mesh.getFace(faceId);
    if (!face) return [];

    const connectedFaceIds = new Set<number>();

    // Check each edge of the face
    for (const edge of face.edges) {
      // Find all faces that use this edge (excluding the current face)
      edge.faces.forEach(otherFaceId => {
        if (otherFaceId !== faceId) {
          connectedFaceIds.add(otherFaceId);
        }
      });
    }

    return Array.from(connectedFaceIds);
  }
} 