import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Edge } from './Edge';

interface ExtrudedEdgeState {
  originalEdgeKey: string;
  originalV0Id: number;
  originalV1Id: number;
  newVertexIds: number[];
  newFaceIds: number[];
  extrusionDirection: Vector3D;
}

/**
 * Command to extrude edges by creating new geometry along the edge direction.
 * Unlike face extrusion, edge extrusion can create open geometry or extend boundaries.
 */
export class ExtrudeEdge implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private edgeIds: number[];
  private extrusionDistance: number;
  private extrusionDirection: Vector3D | 'normal' | 'average';
  private createFaces: boolean; // Whether to create faces between original and extruded edges
  
  // Store original state for undo
  private extrudedStates: ExtrudedEdgeState[] = [];
  private originalSelectedEdges: Set<number>;
  
  public readonly description: string;

  /**
   * Creates an instance of ExtrudeEdge command.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param extrusionDistance - Distance to extrude.
   * @param extrusionDirection - Direction to extrude ('normal', 'average', or Vector3D).
   * @param createFaces - Whether to create connecting faces.
   * @param edgeIds - Optional specific edge IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    extrusionDistance: number,
    extrusionDirection: Vector3D | 'normal' | 'average' = 'normal',
    createFaces: boolean = true,
    edgeIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.extrusionDistance = extrusionDistance;
    this.extrusionDirection = extrusionDirection;
    this.createFaces = createFaces;
    
    // Use provided edge IDs or get from selection
    this.edgeIds = edgeIds || Array.from(selectionManager.getSelectedEdgeIds());
    this.originalSelectedEdges = new Set(this.edgeIds);
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.extrudedStates = [];
    
    if (this.edgeIds.length === 0) {
      console.warn('ExtrudeEdge: No edges selected or specified.');
      return;
    }

    // Calculate extrusion direction if needed
    const finalDirection = this.calculateExtrusionDirection();
    if (!finalDirection) {
      console.warn('ExtrudeEdge: Could not determine extrusion direction.');
      return;
    }

    // Process each edge for extrusion
    this.edgeIds.forEach(edgeId => {
      const edge = this.findEdgeById(edgeId);
      if (!edge) {
        console.warn(`ExtrudeEdge: Edge with ID ${edgeId} not found.`);
        return;
      }

      const extrudedState = this.extrudeSingleEdge(edge, finalDirection);
      if (extrudedState) {
        this.extrudedStates.push(extrudedState);
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();

    // Update selection to new extruded edges
    this.updateSelection();
  }

  undo(): void {
    // Remove extruded geometry in reverse order
    this.extrudedStates.reverse().forEach(state => {
      // Remove new faces
      state.newFaceIds.forEach(faceId => {
        this.mesh.removeFace(faceId);
      });
      
      // Remove new vertices
      state.newVertexIds.forEach(vertexId => {
        this.mesh.removeVertex(vertexId);
      });
    });
    
    // Restore original edge selection
    this.originalSelectedEdges.forEach(edgeId => {
      this.selectionManager.selectEdge(edgeId, true);
    });
    
    // Update mesh bounding box
    this.mesh.computeBoundingBox();
    
    // Clear stored state
    this.extrudedStates = [];
  }

  /**
   * Extrudes a single edge.
   * @param edge - The edge to extrude.
   * @param direction - Direction vector for extrusion.
   * @returns Extruded state or null if failed.
   */
  private extrudeSingleEdge(edge: Edge, direction: Vector3D): ExtrudedEdgeState | null {
    const originalKey = edge.key;
    const v0 = edge.v0;
    const v1 = edge.v1;

    // Calculate extruded positions
    const offset = direction.multiplyScalar(this.extrusionDistance);
    const newV0Position = v0.position.add(offset);
    const newV1Position = v1.position.add(offset);

    // Create new vertices
    const newV0 = this.mesh.addVertex(
      newV0Position.x,
      newV0Position.y,
      newV0Position.z,
      v0.normal?.clone(),
      v0.uv ? { ...v0.uv } : undefined
    );

    const newV1 = this.mesh.addVertex(
      newV1Position.x,
      newV1Position.y,
      newV1Position.z,
      v1.normal?.clone(),
      v1.uv ? { ...v1.uv } : undefined
    );

    const newVertexIds = [newV0.id, newV1.id];
    const newFaceIds: number[] = [];

    // Create connecting faces if requested
    if (this.createFaces) {
      // Create a quad face connecting the original edge to the extruded edge
      const connectingFace = this.mesh.addFace([v0.id, v1.id, newV1.id, newV0.id]);
      if (connectingFace) {
        newFaceIds.push(connectingFace.id);
      }
      
      // If this was a boundary edge, we might want to cap the ends
      if (edge.faces.size === 1) {
        // This was a boundary edge - consider capping options
        // For now, we'll leave it open as edge extrusion often creates open geometry
      }
    }

    return {
      originalEdgeKey: originalKey,
      originalV0Id: v0.id,
      originalV1Id: v1.id,
      newVertexIds,
      newFaceIds,
      extrusionDirection: direction.clone()
    };
  }

  /**
   * Calculates the final extrusion direction based on the specified mode.
   * @returns The calculated direction vector or null if calculation failed.
   */
  private calculateExtrusionDirection(): Vector3D | null {
    if (this.extrusionDirection instanceof Vector3D) {
      return this.extrusionDirection.clone().normalize();
    }

    switch (this.extrusionDirection) {
      case 'normal':
        return this.calculateAverageNormal();
      case 'average':
        return this.calculateAverageDirection();
      default:
        console.warn('ExtrudeEdge: Unknown extrusion direction mode.');
        return null;
    }
  }

  /**
   * Calculates the average normal direction from adjacent faces.
   * @returns Average normal vector or null if no normals available.
   */
  private calculateAverageNormal(): Vector3D | null {
    let totalNormal = new Vector3D(0, 0, 0);
    let normalCount = 0;

    this.edgeIds.forEach(edgeId => {
      const edge = this.findEdgeById(edgeId);
      if (!edge) return;

      // Collect normals from adjacent faces
      edge.faces.forEach(faceId => {
        const face = this.mesh.getFace(faceId);
        if (face && face.normal) {
          totalNormal = totalNormal.add(face.normal);
          normalCount++;
        }
      });
    });

    if (normalCount === 0) {
      // Fallback to edge direction if no face normals available
      return this.calculateAverageDirection();
    }

    return totalNormal.multiplyScalar(1 / normalCount).normalize();
  }

  /**
   * Calculates the average direction of the selected edges.
   * @returns Average edge direction vector or default up vector.
   */
  private calculateAverageDirection(): Vector3D {
    let totalDirection = new Vector3D(0, 0, 0);
    let edgeCount = 0;

    this.edgeIds.forEach(edgeId => {
      const edge = this.findEdgeById(edgeId);
      if (!edge) return;

      const edgeDirection = edge.v1.position.subtract(edge.v0.position);
      totalDirection = totalDirection.add(edgeDirection);
      edgeCount++;
    });

    if (edgeCount === 0) {
      return new Vector3D(0, 0, 1); // Default up direction
    }

    const averageDirection = totalDirection.multiplyScalar(1 / edgeCount);
    return averageDirection.length() > 0 ? averageDirection.normalize() : new Vector3D(0, 0, 1);
  }

  /**
   * Updates selection to include newly created edges.
   */
  private updateSelection(): void {
    // Clear current edge selection
    this.selectionManager.clearEdgeSelection();

    // Select new edges created by extrusion
    this.extrudedStates.forEach(state => {
      // Try to find the new edge between the extruded vertices
      const newEdgeKey = `${state.newVertexIds[0]}-${state.newVertexIds[1]}`;
      const newEdge = this.mesh.edges.get(newEdgeKey) || 
                     this.mesh.edges.get(`${state.newVertexIds[1]}-${state.newVertexIds[0]}`);
      
      if (newEdge) {
        this.selectionManager.selectEdge(newEdge.id, true);
      }
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
    const directionStr = this.extrusionDirection instanceof Vector3D ? 
      'custom direction' : this.extrusionDirection;
    const faceMode = this.createFaces ? 'with faces' : 'vertices only';
    
    return `Extrude ${edgeCount} edge${edgeCount === 1 ? '' : 's'} (${directionStr}, ${faceMode}, distance: ${this.extrusionDistance.toFixed(3)})`;
  }

  /**
   * Gets extrusion statistics.
   * @returns Statistics object.
   */
  getExtrusionStats(): {
    edgesExtruded: number;
    newVerticesCreated: number;
    newFacesCreated: number;
    extrusionDistance: number;
  } {
    const newVerticesCreated = this.extrudedStates.reduce((sum, state) => 
      sum + state.newVertexIds.length, 0);
    const newFacesCreated = this.extrudedStates.reduce((sum, state) => 
      sum + state.newFaceIds.length, 0);

    return {
      edgesExtruded: this.extrudedStates.length,
      newVerticesCreated,
      newFacesCreated,
      extrusionDistance: this.extrusionDistance
    };
  }

  /**
   * Static factory method to extrude edges along their normal.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param distance - Extrusion distance.
   * @returns ExtrudeEdge command instance.
   */
  static extrudeAlongNormal(
    mesh: Mesh,
    selectionManager: SelectionManager,
    distance: number
  ): ExtrudeEdge {
    return new ExtrudeEdge(mesh, selectionManager, distance, 'normal', true);
  }

  /**
   * Static factory method to extrude edges along custom direction.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param distance - Extrusion distance.
   * @param direction - Custom direction vector.
   * @returns ExtrudeEdge command instance.
   */
  static extrudeAlongDirection(
    mesh: Mesh,
    selectionManager: SelectionManager,
    distance: number,
    direction: Vector3D
  ): ExtrudeEdge {
    return new ExtrudeEdge(mesh, selectionManager, distance, direction, true);
  }

  /**
   * Static factory method to create edge vertices only (no faces).
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param distance - Extrusion distance.
   * @param direction - Direction for extrusion.
   * @returns ExtrudeEdge command instance.
   */
  static extrudeVerticesOnly(
    mesh: Mesh,
    selectionManager: SelectionManager,
    distance: number,
    direction: Vector3D | 'normal' | 'average' = 'normal'
  ): ExtrudeEdge {
    return new ExtrudeEdge(mesh, selectionManager, distance, direction, false);
  }
} 