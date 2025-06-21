import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { CoordinateSystem, CoordinateSpace, TransformationOptions } from '@/utils/CoordinateSystem';

interface VertexScaleState {
  vertexId: number;
  originalPosition: Vector3D;
  newPosition: Vector3D;
}

/**
 * Command to scale selected vertices around a pivot point with support for local/world coordinates.
 */
export class ScaleVertices implements ICommand {
  private mesh: Mesh;
  private scale: Vector3D;
  private options: TransformationOptions;
  private vertexIds: number[];
  
  // Store original state for undo
  private originalStates: VertexScaleState[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of ScaleVertices command.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param scale - Scale factors (x, y, z).
   * @param options - Transformation options.
   * @param vertexIds - Optional specific vertex IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    scale: Vector3D,
    options: Partial<TransformationOptions> = {},
    vertexIds?: number[]
  ) {
    this.mesh = mesh;
    this.scale = scale.clone();
    
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
      console.warn('ScaleVertices: No vertices selected or specified.');
      return;
    }

    // Calculate pivot point
    const pivot = this.calculatePivot();
    
    // Transform each vertex
    this.vertexIds.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) {
        console.warn(`ScaleVertices: Vertex with ID ${vertexId} not found.`);
        return;
      }

      // Store original state
      const originalPosition = vertex.position.clone();
      
      // Calculate new position
      const newPosition = CoordinateSystem.scalePosition(
        vertex.position,
        this.scale,
        pivot,
        this.options
      );
      
      // Store state for undo
      this.originalStates.push({
        vertexId,
        originalPosition,
        newPosition: newPosition.clone()
      });
      
      // Apply transformation
      vertex.position = newPosition;
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
    
    let desc = `Scale ${vertexCount} vertex${vertexCount === 1 ? '' : 'es'}`;
    desc += ` (${this.scale.x.toFixed(2)}, ${this.scale.y.toFixed(2)}, ${this.scale.z.toFixed(2)})`;
    desc += ` [${space}]`;
    
    return desc;
  }

  /**
   * Gets transformation statistics.
   * @returns Statistics object.
   */
  getTransformationStats(): {
    verticesTransformed: number;
    scaleFactor: Vector3D;
    pivot: Vector3D;
    bounds: { min: Vector3D; max: Vector3D; center: Vector3D; size: Vector3D };
  } {
    const pivot = this.calculatePivot();
    const positions = this.originalStates.map(state => state.newPosition);
    const bounds = CoordinateSystem.calculateBounds(positions);
    
    return {
      verticesTransformed: this.originalStates.length,
      scaleFactor: this.scale.clone(),
      pivot,
      bounds
    };
  }

  /**
   * Static factory method to scale vertices uniformly.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param factor - Uniform scale factor.
   * @param space - Coordinate space.
   * @returns ScaleVertices command instance.
   */
  static scaleUniform(
    mesh: Mesh,
    selectionManager: SelectionManager,
    factor: number,
    space: CoordinateSpace = CoordinateSpace.SELECTION
  ): ScaleVertices {
    return new ScaleVertices(
      mesh, 
      selectionManager, 
      new Vector3D(factor, factor, factor),
      { space }
    );
  }

  /**
   * Static factory method to scale vertices along X axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param factor - Scale factor for X axis.
   * @param space - Coordinate space.
   * @returns ScaleVertices command instance.
   */
  static scaleAlongX(
    mesh: Mesh,
    selectionManager: SelectionManager,
    factor: number,
    space: CoordinateSpace = CoordinateSpace.SELECTION
  ): ScaleVertices {
    return new ScaleVertices(
      mesh, 
      selectionManager, 
      new Vector3D(factor, 1, 1),
      { space, constrainAxis: 'x' }
    );
  }

  /**
   * Static factory method to scale vertices along Y axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param factor - Scale factor for Y axis.
   * @param space - Coordinate space.
   * @returns ScaleVertices command instance.
   */
  static scaleAlongY(
    mesh: Mesh,
    selectionManager: SelectionManager,
    factor: number,
    space: CoordinateSpace = CoordinateSpace.SELECTION
  ): ScaleVertices {
    return new ScaleVertices(
      mesh, 
      selectionManager, 
      new Vector3D(1, factor, 1),
      { space, constrainAxis: 'y' }
    );
  }

  /**
   * Static factory method to scale vertices along Z axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param factor - Scale factor for Z axis.
   * @param space - Coordinate space.
   * @returns ScaleVertices command instance.
   */
  static scaleAlongZ(
    mesh: Mesh,
    selectionManager: SelectionManager,
    factor: number,
    space: CoordinateSpace = CoordinateSpace.SELECTION
  ): ScaleVertices {
    return new ScaleVertices(
      mesh, 
      selectionManager, 
      new Vector3D(1, 1, factor),
      { space, constrainAxis: 'z' }
    );
  }
}
