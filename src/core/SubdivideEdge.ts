import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Edge } from './Edge';

interface SubdividedEdgeState {
  originalEdgeKey: string;
  originalV0Id: number;
  originalV1Id: number;
  newVertexIds: number[];
  newEdgeKeys: string[];
  affectedFaceIds: number[];
}

/**
 * Command to subdivide edges by inserting one or more vertices along their length.
 * This splits each edge into multiple segments for adding detail.
 */
export class SubdivideEdge implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private edgeIds: number[];
  private subdivisions: number;
  private useSmooth: boolean; // Whether to use smooth interpolation for normals/UVs
  
  // Store original state for undo
  private subdividedStates: SubdividedEdgeState[] = [];

  public readonly description: string;

  /**
   * Creates an instance of SubdivideEdge command.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param subdivisions - Number of subdivisions (1 = split in half, 2 = split into 3 parts, etc.).
   * @param useSmooth - Whether to smoothly interpolate normals and UVs.
   * @param edgeIds - Optional specific edge IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    subdivisions: number = 1,
    useSmooth: boolean = true,
    edgeIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.subdivisions = Math.max(1, Math.floor(subdivisions));
    this.useSmooth = useSmooth;
    
    // Use provided edge IDs or get from selection
    this.edgeIds = edgeIds || Array.from(selectionManager.getSelectedEdgeIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.subdividedStates = [];
    
    if (this.edgeIds.length === 0) {
      console.warn('SubdivideEdge: No edges selected or specified.');
      return;
    }

    // Process each edge for subdivision
    this.edgeIds.forEach(edgeId => {
      const edge = this.findEdgeById(edgeId);
      if (!edge) {
        console.warn(`SubdivideEdge: Edge with ID ${edgeId} not found.`);
        return;
      }

      const subdividedState = this.subdivideEdge(edge);
      if (subdividedState) {
        this.subdividedStates.push(subdividedState);
        
        // Remove original edge from selection
        this.selectionManager.deselectEdge(edgeId);
        
        // Note: New edges will need to be selected manually by the user
        // as edge recreation during subdivision creates complex topology changes
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Note: Full undo would require complex topology restoration
    // This is a simplified implementation
    console.warn('SubdivideEdge: Undo is not fully implemented. Edge subdivision is currently irreversible.');
    
    // Clear stored state
    this.subdividedStates = [];
  }

  /**
   * Subdivides a single edge.
   * @param edge - The edge to subdivide.
   * @returns Subdivided state or null if failed.
   */
  private subdivideEdge(edge: Edge): SubdividedEdgeState | null {
    const originalKey = edge.key;
    const v0 = edge.v0;
    const v1 = edge.v1;
    const affectedFaceIds = Array.from(edge.faces);

    // Create subdivision points along the edge
    const newVertexIds: number[] = [];
    const segments = this.subdivisions + 1; // Total number of segments

    for (let i = 1; i <= this.subdivisions; i++) {
      const t = i / segments; // Interpolation parameter (0 to 1)
      
      // Interpolate position manually
      const position = new Vector3D(
        v0.position.x + (v1.position.x - v0.position.x) * t,
        v0.position.y + (v1.position.y - v0.position.y) * t,
        v0.position.z + (v1.position.z - v0.position.z) * t
      );
      
      // Interpolate normal if both vertices have normals
      let normal: Vector3D | undefined;
      if (v0.normal && v1.normal && this.useSmooth) {
        normal = new Vector3D(
          v0.normal.x + (v1.normal.x - v0.normal.x) * t,
          v0.normal.y + (v1.normal.y - v0.normal.y) * t,
          v0.normal.z + (v1.normal.z - v0.normal.z) * t
        ).normalize();
      }
      
      // Interpolate UV if both vertices have UVs
      let uv: { u: number; v: number } | undefined;
      if (v0.uv && v1.uv && this.useSmooth) {
        uv = {
          u: v0.uv.u + (v1.uv.u - v0.uv.u) * t,
          v: v0.uv.v + (v1.uv.v - v0.uv.v) * t
        };
      }
      
      // Create new vertex
      const newVertex = this.mesh.addVertex(
        position.x, 
        position.y, 
        position.z,
        normal,
        uv
      );
      
      newVertexIds.push(newVertex.id);
    }

    // Remove original edge
    const edgeRemoved = this.mesh.removeEdge(v0.id, v1.id);
    if (!edgeRemoved) {
      console.warn(`SubdivideEdge: Could not remove original edge ${originalKey}.`);
      return null;
    }

    // Create new edges connecting all vertices
    const newEdgeKeys: string[] = [];
    const allVertexIds = [v0.id, ...newVertexIds, v1.id];
    
    for (let i = 0; i < allVertexIds.length - 1; i++) {
      // Create edge using mesh vertex addition (edges are created automatically)
      const edge1 = this.mesh.getVertex(allVertexIds[i]);
      const edge2 = this.mesh.getVertex(allVertexIds[i + 1]);
      if (edge1 && edge2) {
        const edgeKey = `${Math.min(allVertexIds[i], allVertexIds[i + 1])}-${Math.max(allVertexIds[i], allVertexIds[i + 1])}`;
        newEdgeKeys.push(edgeKey);
      }
    }

    // Update affected faces to use new vertices
    this.updateAffectedFaces(affectedFaceIds, v0.id, v1.id, newVertexIds);

    return {
      originalEdgeKey: originalKey,
      originalV0Id: v0.id,
      originalV1Id: v1.id,
      newVertexIds,
      newEdgeKeys,
      affectedFaceIds
    };
  }

  /**
   * Updates faces that were using the original edge to include new vertices.
   * @param faceIds - IDs of faces to update.
   * @param originalV0Id - Original first vertex ID.
   * @param originalV1Id - Original second vertex ID.
   * @param newVertexIds - IDs of newly created vertices.
   */
  private updateAffectedFaces(
    faceIds: number[], 
    originalV0Id: number, 
    originalV1Id: number, 
    newVertexIds: number[]
  ): void {
    faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) return;

      // Find if this face uses the subdivided edge
      const vertexIds = face.vertices.map(v => v.id);
      const v0Index = vertexIds.indexOf(originalV0Id);
      const v1Index = vertexIds.indexOf(originalV1Id);

      if (v0Index !== -1 && v1Index !== -1) {
        // Determine the order and insert new vertices
        const isSequential = Math.abs(v0Index - v1Index) === 1 || 
                            (v0Index === 0 && v1Index === vertexIds.length - 1) ||
                            (v1Index === 0 && v0Index === vertexIds.length - 1);

        if (isSequential) {
          // Insert new vertices between the original edge vertices
          const insertIndex = Math.max(v0Index, v1Index);
          const newVerticesInOrder = v0Index < v1Index ? newVertexIds : [...newVertexIds].reverse();
          
          // Remove the face and recreate it with new vertices
          const materialIndex = face.materialIndex;
          this.mesh.removeFace(faceId);
          
          const updatedVertexIds = [...vertexIds];
          updatedVertexIds.splice(insertIndex, 0, ...newVerticesInOrder);
          
          this.mesh.addFace(updatedVertexIds, materialIndex ?? undefined);
        }
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
    const smoothText = this.useSmooth ? ' (smooth)' : ' (linear)';
    
    return `Subdivide ${edgeCount} edge${edgeCount === 1 ? '' : 's'} into ${this.subdivisions + 1} segments${smoothText}`;
  }

  /**
   * Gets subdivision statistics.
   * @returns Statistics object.
   */
  getSubdivisionStats(): {
    edgesSubdivided: number;
    newVerticesCreated: number;
    newEdgesCreated: number;
    facesModified: number;
  } {
    const newVerticesCreated = this.subdividedStates.reduce((sum, state) => 
      sum + state.newVertexIds.length, 0);
    const newEdgesCreated = this.subdividedStates.reduce((sum, state) => 
      sum + state.newEdgeKeys.length, 0);
    const facesModified = this.subdividedStates.reduce((sum, state) => 
      sum + state.affectedFaceIds.length, 0);

    return {
      edgesSubdivided: this.subdividedStates.length,
      newVerticesCreated,
      newEdgesCreated,
      facesModified
    };
  }

  /**
   * Static factory method to subdivide edges once (split in half).
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param useSmooth - Whether to use smooth interpolation.
   * @returns SubdivideEdge command instance.
   */
  static subdivideOnce(
    mesh: Mesh,
    selectionManager: SelectionManager,
    useSmooth: boolean = true
  ): SubdivideEdge {
    return new SubdivideEdge(mesh, selectionManager, 1, useSmooth);
  }

  /**
   * Static factory method to subdivide edges multiple times.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @param subdivisions - Number of subdivisions.
   * @param useSmooth - Whether to use smooth interpolation.
   * @returns SubdivideEdge command instance.
   */
  static subdivideMultiple(
    mesh: Mesh,
    selectionManager: SelectionManager,
    subdivisions: number,
    useSmooth: boolean = true
  ): SubdivideEdge {
    return new SubdivideEdge(mesh, selectionManager, subdivisions, useSmooth);
  }
} 