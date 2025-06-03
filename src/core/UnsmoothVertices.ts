import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';

interface VertexNormalState {
  vertexId: number;
  originalNormal: Vector3D | null;
  newNormal: Vector3D | null;
}

/**
 * Command to unsmooth vertices by setting flat face normals like Blender's flat shading.
 * This creates sharp edges by using individual face normals instead of averaged vertex normals.
 */
export class UnsmoothVertices implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private vertexIds: number[];
  
  // Store original state for undo
  private originalStates: VertexNormalState[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of UnsmoothVertices command.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param vertexIds - Optional specific vertex IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    vertexIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    
    // Use provided vertex IDs or get from selection
    this.vertexIds = vertexIds || Array.from(selectionManager.getSelectedVertexIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.originalStates = [];
    
    if (this.vertexIds.length === 0) {
      console.warn('UnsmoothVertices: No vertices selected or specified.');
      return;
    }

    // Calculate flat normals for each vertex
    this.vertexIds.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) {
        console.warn(`UnsmoothVertices: Vertex with ID ${vertexId} not found.`);
        return;
      }

      // Store original normal
      const originalNormal = vertex.normal?.clone() || null;
      
      // Calculate flat normal (use the normal of the first connected face)
      const flatNormal = this.calculateFlatNormal(vertexId);
      
      // Store state for undo
      this.originalStates.push({
        vertexId,
        originalNormal,
        newNormal: flatNormal?.clone() || null
      });
      
      // Apply flat normal
      vertex.normal = flatNormal;
    });
  }

  undo(): void {
    // Restore original normals
    this.originalStates.forEach(state => {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        vertex.normal = state.originalNormal?.clone() || null;
      }
    });
    
    // Clear stored state
    this.originalStates = [];
  }

  /**
   * Calculates flat normal for a vertex using the first connected face's normal.
   * For flat shading, we use a single face normal rather than averaging.
   * @param vertexId - The vertex ID.
   * @returns Flat normal vector or null if calculation fails.
   */
  private calculateFlatNormal(vertexId: number): Vector3D | null {
    const vertex = this.mesh.getVertex(vertexId);
    if (!vertex) {
      return null;
    }

    const connectedFaces = Array.from(vertex.faces);
    if (connectedFaces.length === 0) {
      return null;
    }

    // Use the first face's normal for flat shading
    const firstFaceId = connectedFaces[0];
    const firstFace = this.mesh.getFace(firstFaceId);
    
    if (!firstFace) {
      return null;
    }

    // Use existing face normal if available
    if (firstFace.normal) {
      return firstFace.normal.clone();
    }

    // Calculate face normal if not available
    return this.calculateFaceNormal(firstFace);
  }

  /**
   * Calculates normal for a face.
   * @param face - The face to calculate normal for.
   * @returns Face normal vector or null if calculation fails.
   */
  private calculateFaceNormal(face: any): Vector3D | null {
    if (face.vertices.length < 3) {
      return null;
    }

    // Use first three vertices to calculate normal
    const v0 = face.vertices[0].position;
    const v1 = face.vertices[1].position;
    const v2 = face.vertices[2].position;

    const edge1 = v1.subtract(v0);
    const edge2 = v2.subtract(v0);
    
    return edge1.cross(edge2).normalize();
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const vertexCount = this.vertexIds.length;
    return `Unsmooth (flat shade) ${vertexCount} vertex${vertexCount === 1 ? '' : 'es'}`;
  }

  /**
   * Gets unsmoothing statistics.
   * @returns Statistics object.
   */
  getUnsmoothingStats(): {
    verticesUnsmoothed: number;
    averageNormalChange: number;
  } {
    let totalNormalChange = 0;
    let validChanges = 0;

    this.originalStates.forEach(state => {
      if (state.originalNormal && state.newNormal) {
        const change = Math.acos(Math.max(-1, Math.min(1, 
          state.originalNormal.dot(state.newNormal)
        )));
        totalNormalChange += change;
        validChanges++;
      }
    });

    const averageNormalChange = validChanges > 0 ? 
      (totalNormalChange / validChanges) * (180 / Math.PI) : 0;

    return {
      verticesUnsmoothed: this.originalStates.length,
      averageNormalChange
    };
  }

  /**
   * Static factory method to unsmooth all vertices.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @returns UnsmoothVertices command instance.
   */
  static unsmoothAll(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): UnsmoothVertices {
    const allVertexIds = Array.from(mesh.vertices.keys());
    return new UnsmoothVertices(mesh, selectionManager, allVertexIds);
  }

  /**
   * Applies flat shading to faces by setting each vertex normal to its face normal.
   * This is similar to unsmoothing but works at the face level.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @returns UnsmoothVertices command instance.
   */
  static applyFlatShading(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): UnsmoothVertices {
    // Get all vertices from selected faces
    const selectedFaceIds = Array.from(selectionManager.getSelectedFaceIds());
    const affectedVertexIds = new Set<number>();
    
    selectedFaceIds.forEach(faceId => {
      const face = mesh.getFace(faceId);
      if (face) {
        face.vertices.forEach(vertex => {
          affectedVertexIds.add(vertex.id);
        });
      }
    });
    
    return new UnsmoothVertices(mesh, selectionManager, Array.from(affectedVertexIds));
  }

  /**
   * Creates sharp edges by unsmoothing vertices connected to selected edges.
   * @param mesh - The mesh containing edges.
   * @param selectionManager - The selection manager.
   * @returns UnsmoothVertices command instance.
   */
  static createSharpEdges(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): UnsmoothVertices {
    // Get all vertices from selected edges
    const selectedEdgeIds = Array.from(selectionManager.getSelectedEdgeIds());
    const affectedVertexIds = new Set<number>();
    
    selectedEdgeIds.forEach(edgeId => {
      // Find the edge by ID in the edges map
      const edge = Array.from(mesh.edges.values()).find(e => e.id === edgeId);
      if (edge) {
        affectedVertexIds.add(edge.v0.id);
        affectedVertexIds.add(edge.v1.id);
      }
    });
    
    return new UnsmoothVertices(mesh, selectionManager, Array.from(affectedVertexIds));
  }
} 