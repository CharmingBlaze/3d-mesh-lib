import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { CoordinateSystem, CoordinateSpace, TransformationOptions } from '@/utils/CoordinateSystem';

interface VertexRotationState {
  vertexId: number;
  originalPosition: Vector3D;
  newPosition: Vector3D;
  originalNormal?: Vector3D;
  newNormal?: Vector3D;
}

/**
 * Command to rotate selected vertices around a pivot point with support for local/world coordinates.
 */
export class RotateVertices implements ICommand {
  private mesh: Mesh;
  private rotation: Vector3D;  // Rotation in radians (Euler angles)
  private options: TransformationOptions;
  private vertexIds: number[];
  private rotateNormals: boolean;
  
  // Store original state for undo
  private originalStates: VertexRotationState[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of RotateVertices command.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param rotation - Rotation in radians (Euler angles: x, y, z).
   * @param options - Transformation options.
   * @param rotateNormals - Whether to also rotate vertex normals.
   * @param vertexIds - Optional specific vertex IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    rotation: Vector3D,
    options: Partial<TransformationOptions> = {},
    rotateNormals: boolean = true,
    vertexIds?: number[]
  ) {
    this.mesh = mesh;
    this.rotation = rotation.clone();
    this.rotateNormals = rotateNormals;
    
    // Set default options
    this.options = {
      space: CoordinateSpace.SELECTION,
      relative: true,
      ...options
    };
    
    // Use provided vertex IDs or get from selection
    this.vertexIds = vertexIds || Array.from(selectionManager.getSelectedVertexIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.originalStates = [];
    
    if (this.vertexIds.length === 0) {
      console.warn('RotateVertices: No vertices selected or specified.');
      return;
    }

    // Calculate pivot point
    const pivot = this.calculatePivot();
    
    // Transform each vertex
    this.vertexIds.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) {
        console.warn(`RotateVertices: Vertex with ID ${vertexId} not found.`);
        return;
      }

      // Store original state
      const originalPosition = vertex.position.clone();
      const originalNormal = vertex.normal?.clone();
      
      // Calculate new position
      const newPosition = CoordinateSystem.rotatePosition(
        vertex.position,
        this.rotation,
        pivot,
        this.options
      );
      
      // Calculate new normal if applicable
      let newNormal: Vector3D | undefined;
      if (this.rotateNormals && vertex.normal) {
        // Rotate normal around origin (normals don't need pivot translation)
        newNormal = CoordinateSystem.rotatePosition(
          vertex.normal,
          this.rotation,
          new Vector3D(0, 0, 0),
          this.options
        ).normalize();
      }
      
      // Store state for undo
      this.originalStates.push({
        vertexId,
        originalPosition,
        newPosition: newPosition.clone(),
        originalNormal,
        newNormal: newNormal?.clone()
      });
      
      // Apply transformations
      vertex.position = newPosition;
      if (newNormal) {
        vertex.normal = newNormal;
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Restore original states
    this.originalStates.forEach(state => {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        vertex.position = state.originalPosition.clone();
        if (state.originalNormal) {
          vertex.normal = state.originalNormal.clone();
        }
      }
    });
    
    // Update mesh bounding box
    this.mesh.computeBoundingBox();
    
    // Clear stored state
    this.originalStates = [];
  }

  /**
   * Calculates the pivot point based on coordinate space and options.
   * @returns Pivot point.
   */
  private calculatePivot(): Vector3D {
    if (this.options.pivot) {
      return this.options.pivot.clone();
    }

    switch (this.options.space) {
      case CoordinateSpace.WORLD:
        return new Vector3D(0, 0, 0);
      
      case CoordinateSpace.LOCAL:
        // For local space, use mesh center
        if (this.mesh.boundingBoxMin && this.mesh.boundingBoxMax) {
          return this.mesh.boundingBoxMin.add(this.mesh.boundingBoxMax).multiplyScalar(0.5);
        }
        return new Vector3D(0, 0, 0);
      
      case CoordinateSpace.SELECTION:
      default:
        // Calculate center of selected vertices
        const positions = this.vertexIds
          .map(id => this.mesh.getVertex(id)?.position)
          .filter(pos => pos !== undefined) as Vector3D[];
        
        return CoordinateSystem.calculateCenter(positions);
    }
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const vertexCount = this.vertexIds.length;
    const space = this.options.space;
    const rotationDegrees = {
      x: CoordinateSystem.radiansToDegrees(this.rotation.x),
      y: CoordinateSystem.radiansToDegrees(this.rotation.y),
      z: CoordinateSystem.radiansToDegrees(this.rotation.z)
    };
    
    let desc = `Rotate ${vertexCount} vertex${vertexCount === 1 ? '' : 'es'}`;
    desc += ` (${rotationDegrees.x.toFixed(1)}°, ${rotationDegrees.y.toFixed(1)}°, ${rotationDegrees.z.toFixed(1)}°)`;
    desc += ` [${space}]`;
    
    if (this.rotateNormals) {
      desc += ' [+normals]';
    }
    
    return desc;
  }

  /**
   * Gets transformation statistics.
   * @returns Statistics object.
   */
  getTransformationStats(): {
    verticesTransformed: number;
    rotationDegrees: { x: number; y: number; z: number };
    pivot: Vector3D;
    bounds: { min: Vector3D; max: Vector3D; center: Vector3D; size: Vector3D };
  } {
    const pivot = this.calculatePivot();
    const rotationDegrees = {
      x: CoordinateSystem.radiansToDegrees(this.rotation.x),
      y: CoordinateSystem.radiansToDegrees(this.rotation.y),
      z: CoordinateSystem.radiansToDegrees(this.rotation.z)
    };
    
    const positions = this.originalStates.map(state => state.newPosition);
    const bounds = CoordinateSystem.calculateBounds(positions);
    
    return {
      verticesTransformed: this.originalStates.length,
      rotationDegrees,
      pivot,
      bounds
    };
  }

  /**
   * Static factory method to rotate vertices around X axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param degrees - Rotation angle in degrees.
   * @param space - Coordinate space.
   * @returns RotateVertices command instance.
   */
  static rotateAroundX(
    mesh: Mesh,
    selectionManager: SelectionManager,
    degrees: number,
    space: CoordinateSpace = CoordinateSpace.SELECTION
  ): RotateVertices {
    const radians = CoordinateSystem.degreesToRadians(degrees);
    return new RotateVertices(
      mesh, 
      selectionManager, 
      new Vector3D(radians, 0, 0),
      { space }
    );
  }

  /**
   * Static factory method to rotate vertices around Y axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param degrees - Rotation angle in degrees.
   * @param space - Coordinate space.
   * @returns RotateVertices command instance.
   */
  static rotateAroundY(
    mesh: Mesh,
    selectionManager: SelectionManager,
    degrees: number,
    space: CoordinateSpace = CoordinateSpace.SELECTION
  ): RotateVertices {
    const radians = CoordinateSystem.degreesToRadians(degrees);
    return new RotateVertices(
      mesh, 
      selectionManager, 
      new Vector3D(0, radians, 0),
      { space }
    );
  }

  /**
   * Static factory method to rotate vertices around Z axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param degrees - Rotation angle in degrees.
   * @param space - Coordinate space.
   * @returns RotateVertices command instance.
   */
  static rotateAroundZ(
    mesh: Mesh,
    selectionManager: SelectionManager,
    degrees: number,
    space: CoordinateSpace = CoordinateSpace.SELECTION
  ): RotateVertices {
    const radians = CoordinateSystem.degreesToRadians(degrees);
    return new RotateVertices(
      mesh, 
      selectionManager, 
      new Vector3D(0, 0, radians),
      { space }
    );
  }
}
