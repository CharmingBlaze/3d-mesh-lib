import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Face } from './Face';

interface SeparateState {
  originalFaceIds: number[];
  separatedFaceIds: number[];
  duplicatedVertexIds: number[];
  separationOffset: Vector3D;
}

/**
 * Command to separate loose geometry or disconnect face groups.
 * Creates independent mesh pieces by duplicating shared vertices.
 */
export class SeparateFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  private separationMode: 'loose' | 'material' | 'selection';
  private separationOffset: Vector3D;
  
  // Store original state for undo
  private separateState: SeparateState | null = null;
  
  public readonly description: string;

  /**
   * Creates an instance of SeparateFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param separationMode - How to determine what to separate.
   * @param separationOffset - Offset to move separated geometry.
   * @param faceIds - Optional specific face IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    separationMode: 'loose' | 'material' | 'selection' = 'selection',
    separationOffset: Vector3D = new Vector3D(0, 0, 0),
    faceIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.separationMode = separationMode;
    this.separationOffset = separationOffset.clone();
    
    // Use provided face IDs or get from selection
    this.faceIds = faceIds || Array.from(selectionManager.getSelectedFaceIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.separateState = null;
    
    const separateResult = this.performSeparation();
    if (separateResult) {
      this.separateState = separateResult;
    }

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    if (!this.separateState) return;

    // Remove separated faces
    this.separateState.separatedFaceIds.forEach(faceId => {
      this.mesh.removeFace(faceId);
    });

    // Remove duplicated vertices
    this.separateState.duplicatedVertexIds.forEach(vertexId => {
      this.mesh.removeVertex(vertexId);
    });

    // Note: Restoring original connectivity is complex
    console.warn('SeparateFaces: Undo is not fully implemented. Separation is currently irreversible.');
    
    // Clear stored state
    this.separateState = null;
  }

  /**
   * Performs the separation based on the mode.
   * @returns Separate state or null if failed.
   */
  private performSeparation(): SeparateState | null {
    switch (this.separationMode) {
      case 'loose':
        return this.separateLooseGeometry();
      case 'material':
        return this.separateByMaterial();
      case 'selection':
        return this.separateSelection();
      default:
        console.warn('SeparateFaces: Unknown separation mode.');
        return null;
    }
  }

  /**
   * Separates loose (disconnected) geometry pieces.
   * @returns Separate state or null if failed.
   */
  private separateLooseGeometry(): SeparateState | null {
    // Find all connected components in the mesh
    const connectedComponents = this.findConnectedComponents();
    
    if (connectedComponents.length <= 1) {
      console.warn('SeparateFaces: No loose geometry found to separate.');
      return null;
    }

    // Separate all components except the largest one
    const largestComponent = connectedComponents.reduce((largest, current) => 
      current.length > largest.length ? current : largest
    );

    const componentsToSeparate = connectedComponents.filter(component => component !== largestComponent);
    
    return this.separateFaceGroups(componentsToSeparate);
  }

  /**
   * Separates faces by material groups.
   * @returns Separate state or null if failed.
   */
  private separateByMaterial(): SeparateState | null {
    // Group faces by material
    const materialGroups = this.groupFacesByMaterial();
    
    if (materialGroups.length <= 1) {
      console.warn('SeparateFaces: No different materials found to separate.');
      return null;
    }

    // Separate all material groups except the first/largest one
    const groupsToSeparate = materialGroups.slice(1);
    
    return this.separateFaceGroups(groupsToSeparate);
  }

  /**
   * Separates selected faces from the rest of the mesh.
   * @returns Separate state or null if failed.
   */
  private separateSelection(): SeparateState | null {
    if (this.faceIds.length === 0) {
      console.warn('SeparateFaces: No faces selected for separation.');
      return null;
    }

    return this.separateFaceGroups([this.faceIds]);
  }

  /**
   * Finds connected components in the mesh.
   * @returns Array of face ID arrays, each representing a connected component.
   */
  private findConnectedComponents(): number[][] {
    const visitedFaces = new Set<number>();
    const components: number[][] = [];
    
    // Get all face IDs
    const allFaceIds = Array.from(this.mesh.faces.keys());
    
    for (const faceId of allFaceIds) {
      if (visitedFaces.has(faceId)) continue;
      
      // Start a new component
      const component: number[] = [];
      const queue = [faceId];
      
      while (queue.length > 0) {
        const currentFaceId = queue.shift()!;
        
        if (visitedFaces.has(currentFaceId)) continue;
        
        visitedFaces.add(currentFaceId);
        component.push(currentFaceId);
        
        // Find connected faces (faces that share vertices or edges)
        const connectedFaces = this.findConnectedFaces(currentFaceId);
        queue.push(...connectedFaces.filter(id => !visitedFaces.has(id)));
      }
      
      if (component.length > 0) {
        components.push(component);
      }
    }
    
    return components;
  }

  /**
   * Finds faces connected to the given face.
   * @param faceId - The face ID to find connections for.
   * @returns Array of connected face IDs.
   */
  private findConnectedFaces(faceId: number): number[] {
    const face = this.mesh.getFace(faceId);
    if (!face) return [];

    const connectedFaceIds = new Set<number>();

    // Check faces that share vertices
    face.vertices.forEach(vertex => {
      vertex.faces.forEach(otherFaceId => {
        if (otherFaceId !== faceId) {
          connectedFaceIds.add(otherFaceId);
        }
      });
    });

    return Array.from(connectedFaceIds);
  }

  /**
   * Groups faces by their material index.
   * @returns Array of face ID arrays, each representing a material group.
   */
  private groupFacesByMaterial(): number[][] {
    const materialGroups = new Map<number | null, number[]>();
    
    this.mesh.faces.forEach((face, faceId) => {
      const materialIndex = face.materialIndex ?? null;
      
      if (!materialGroups.has(materialIndex)) {
        materialGroups.set(materialIndex, []);
      }
      
      materialGroups.get(materialIndex)!.push(faceId);
    });
    
    return Array.from(materialGroups.values());
  }

  /**
   * Separates multiple face groups by duplicating their vertices.
   * @param faceGroups - Array of face ID arrays to separate.
   * @returns Separate state or null if failed.
   */
  private separateFaceGroups(faceGroups: number[][]): SeparateState | null {
    const originalFaceIds: number[] = [];
    const separatedFaceIds: number[] = [];
    const duplicatedVertexIds: number[] = [];

    faceGroups.forEach((groupFaceIds, groupIndex) => {
      const groupResult = this.separateSingleGroup(groupFaceIds, groupIndex);
      
      if (groupResult) {
        originalFaceIds.push(...groupResult.originalFaceIds);
        separatedFaceIds.push(...groupResult.separatedFaceIds);
        duplicatedVertexIds.push(...groupResult.duplicatedVertexIds);
      }
    });

    return {
      originalFaceIds,
      separatedFaceIds,
      duplicatedVertexIds,
      separationOffset: this.separationOffset.clone()
    };
  }

  /**
   * Separates a single group of faces.
   * @param groupFaceIds - Face IDs in the group.
   * @param groupIndex - Index of the group (for offset calculation).
   * @returns Group separation result.
   */
  private separateSingleGroup(groupFaceIds: number[], groupIndex: number): {
    originalFaceIds: number[];
    separatedFaceIds: number[];
    duplicatedVertexIds: number[];
  } | null {
    const originalFaceIds: number[] = [];
    const separatedFaceIds: number[] = [];
    const duplicatedVertexIds: number[] = [];

    // Calculate offset for this group
    const groupOffset = this.separationOffset.multiplyScalar(groupIndex + 1);

    // Collect all unique vertices used by faces in this group
    const groupVertices = new Set<number>();
    groupFaceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (face) {
        face.vertices.forEach(vertex => groupVertices.add(vertex.id));
      }
    });

    // Create duplicated vertices with offset
    const vertexMapping = new Map<number, number>();
    groupVertices.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) return;

      const offsetPosition = vertex.position.add(groupOffset);
      const duplicatedVertex = this.mesh.addVertex(
        offsetPosition.x,
        offsetPosition.y,
        offsetPosition.z,
        vertex.normal?.clone(),
        vertex.uv ? { ...vertex.uv } : undefined
      );

      vertexMapping.set(vertexId, duplicatedVertex.id);
      duplicatedVertexIds.push(duplicatedVertex.id);
    });

    // Create new faces with duplicated vertices
    groupFaceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      originalFaceIds.push(faceId);

      // Map face vertices to duplicated vertices
      const newVertexIds = face.vertices.map(vertex => {
        const duplicatedVertexId = vertexMapping.get(vertex.id);
        return duplicatedVertexId || vertex.id;
      });

      // Remove original face and create separated face
      this.mesh.removeFace(faceId);
      const separatedFace = this.mesh.addFace(newVertexIds, face.materialIndex ?? undefined);
      separatedFaceIds.push(separatedFace.id);
    });

    return {
      originalFaceIds,
      separatedFaceIds,
      duplicatedVertexIds
    };
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    let desc = `Separate geometry (${this.separationMode}`;
    
    if (this.separationMode === 'selection') {
      desc += `, ${this.faceIds.length} faces`;
    }
    
    if (this.separationOffset.length() > 0) {
      desc += `, offset: ${this.separationOffset.length().toFixed(3)}`;
    }
    
    desc += ')';
    return desc;
  }

  /**
   * Gets separation statistics.
   * @returns Statistics object.
   */
  getSeparationStats(): {
    facesProcessed: number;
    separatedFaces: number;
    verticesDuplicated: number;
    separationMode: 'loose' | 'material' | 'selection';
  } {
    return {
      facesProcessed: this.separateState?.originalFaceIds.length || 0,
      separatedFaces: this.separateState?.separatedFaceIds.length || 0,
      verticesDuplicated: this.separateState?.duplicatedVertexIds.length || 0,
      separationMode: this.separationMode
    };
  }

  /**
   * Static factory method to separate loose geometry.
   * @param mesh - The mesh.
   * @param selectionManager - The selection manager.
   * @param offset - Separation offset.
   * @returns SeparateFaces command instance.
   */
  static separateLoose(
    mesh: Mesh,
    selectionManager: SelectionManager,
    offset: Vector3D = new Vector3D(1, 0, 0)
  ): SeparateFaces {
    return new SeparateFaces(mesh, selectionManager, 'loose', offset);
  }

  /**
   * Static factory method to separate by material.
   * @param mesh - The mesh.
   * @param selectionManager - The selection manager.
   * @param offset - Separation offset.
   * @returns SeparateFaces command instance.
   */
  static separateByMaterial(
    mesh: Mesh,
    selectionManager: SelectionManager,
    offset: Vector3D = new Vector3D(1, 0, 0)
  ): SeparateFaces {
    return new SeparateFaces(mesh, selectionManager, 'material', offset);
  }

  /**
   * Static factory method to separate selection.
   * @param mesh - The mesh.
   * @param selectionManager - The selection manager.
   * @param offset - Separation offset.
   * @returns SeparateFaces command instance.
   */
  static separateSelection(
    mesh: Mesh,
    selectionManager: SelectionManager,
    offset: Vector3D = new Vector3D(1, 0, 0)
  ): SeparateFaces {
    return new SeparateFaces(mesh, selectionManager, 'selection', offset);
  }
} 