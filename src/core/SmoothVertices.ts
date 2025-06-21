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
 * Command to smooth vertices by calculating shared normals like Blender's smooth shading.
 * This creates smooth surface normals by averaging face normals around each vertex.
 */
export class SmoothVertices implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private vertexIds: number[];
  private smoothingAngle: number; // Maximum angle in degrees for smoothing
  
  // Store original state for undo
  private originalStates: VertexNormalState[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of SmoothVertices command.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param smoothingAngle - Maximum angle in degrees for smoothing (default: 180 = smooth all).
   * @param vertexIds - Optional specific vertex IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    smoothingAngle: number = 180,
    vertexIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.smoothingAngle = Math.max(0, Math.min(180, smoothingAngle));
    
    // Use provided vertex IDs or get from selection
    this.vertexIds = vertexIds || Array.from(selectionManager.getSelectedVertexIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.originalStates = [];
    
    if (this.vertexIds.length === 0) {
      console.warn('SmoothVertices: No vertices selected or specified.');
      return;
    }

    // Calculate smooth normals for each vertex
    this.vertexIds.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) {
        console.warn(`SmoothVertices: Vertex with ID ${vertexId} not found.`);
        return;
      }

      // Store original normal
      const originalNormal = vertex.normal?.clone() || null;
      
      // Calculate smooth normal
      const smoothNormal = this.calculateSmoothNormal(vertexId);
      
      // Store state for undo
      this.originalStates.push({
        vertexId,
        originalNormal,
        newNormal: smoothNormal?.clone() || null
      });
      
      // Apply smooth normal
      vertex.normal = smoothNormal;
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
   * Calculates smooth normal for a vertex by averaging adjacent face normals.
   * @param vertexId - The vertex ID.
   * @returns Smooth normal vector or null if calculation fails.
   */
  private calculateSmoothNormal(vertexId: number): Vector3D | null {
    const vertex = this.mesh.getVertex(vertexId);
    if (!vertex) {
      return null;
    }

    const connectedFaces = Array.from(vertex.faces);
    if (connectedFaces.length === 0) {
      return null;
    }

    // Collect face normals with smoothing angle consideration
    const validNormals: Vector3D[] = [];
    const faceNormals: Vector3D[] = [];
    
    // First pass: collect all face normals
    connectedFaces.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (face && face.normal) {
        faceNormals.push(face.normal.clone());
      } else if (face) {
        // Calculate face normal if not available
        const faceNormal = this.calculateFaceNormal(face);
        if (faceNormal) {
          faceNormals.push(faceNormal);
        }
      }
    });

    if (faceNormals.length === 0) {
      return null;
    }

    // If smoothing angle is 180°, include all normals
    if (this.smoothingAngle >= 180) {
      validNormals.push(...faceNormals);
    } else {
      // Apply smoothing angle constraint
      const smoothingAngleRad = (this.smoothingAngle * Math.PI) / 180;
      
      // Use first normal as reference
      const referenceNormal = faceNormals[0];
      validNormals.push(referenceNormal);
      
      // Check other normals against smoothing angle
      for (let i = 1; i < faceNormals.length; i++) {
        const normal = faceNormals[i];
        const angle = Math.acos(Math.max(-1, Math.min(1, referenceNormal.dot(normal))));
        
        if (angle <= smoothingAngleRad) {
          validNormals.push(normal);
        }
      }
    }

    if (validNormals.length === 0) {
      return null;
    }

    // Average the valid normals
    let smoothNormal = new Vector3D(0, 0, 0);
    validNormals.forEach(normal => {
      smoothNormal = smoothNormal.add(normal);
    });
    
    smoothNormal = smoothNormal.multiplyScalar(1 / validNormals.length);
    return smoothNormal.normalize();
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
    let desc = `Smooth ${vertexCount} vertex${vertexCount === 1 ? '' : 'es'}`;
    
    if (this.smoothingAngle < 180) {
      desc += ` (angle: ${this.smoothingAngle.toFixed(1)}°)`;
    }
    
    return desc;
  }

  /**
   * Gets smoothing statistics.
   * @returns Statistics object.
   */
  getSmoothingStats(): {
    verticesSmoothed: number;
    smoothingAngle: number;
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
      verticesSmoothed: this.originalStates.length,
      smoothingAngle: this.smoothingAngle,
      averageNormalChange
    };
  }

  /**
   * Static factory method to smooth all vertices.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param smoothingAngle - Maximum smoothing angle in degrees.
   * @returns SmoothVertices command instance.
   */
  static smoothAll(
    mesh: Mesh,
    selectionManager: SelectionManager,
    smoothingAngle: number = 180
  ): SmoothVertices {
    const allVertexIds = Array.from(mesh.vertices.keys());
    return new SmoothVertices(mesh, selectionManager, smoothingAngle, allVertexIds);
  }

  /**
   * Static factory method for hard surface smoothing (30° angle).
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @returns SmoothVertices command instance.
   */
  static smoothHardSurface(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): SmoothVertices {
    return new SmoothVertices(mesh, selectionManager, 30);
  }

  /**
   * Static factory method for organic smoothing (full 180° angle).
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @returns SmoothVertices command instance.
   */
  static smoothOrganic(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): SmoothVertices {
    return new SmoothVertices(mesh, selectionManager, 180);
  }
} 