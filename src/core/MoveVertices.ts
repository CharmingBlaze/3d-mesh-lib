import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { CoordinateSystem, CoordinateSpace, TransformationOptions } from '@/utils/CoordinateSystem';

interface VertexPositionState {
  vertexId: number;
  originalPosition: Vector3D;
  newPosition: Vector3D;
}

/**
 * Command to move selected vertices with support for local/world coordinates and axis constraints.
 */
export class MoveVertices implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private translation: Vector3D;
  private options: TransformationOptions;
  private vertexIds: number[];
  
  // Store original state for undo
  private originalPositions: VertexPositionState[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of MoveVertices command.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param translation - Translation vector.
   * @param options - Transformation options.
   * @param vertexIds - Optional specific vertex IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    translation: Vector3D,
    options: Partial<TransformationOptions> = {},
    vertexIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.translation = translation.clone();
    
    // Set default options
    this.options = {
      space: CoordinateSpace.WORLD,
      relative: true,
      ...options
    };
    
    // Use provided vertex IDs or get from selection
    this.vertexIds = vertexIds || Array.from(selectionManager.getSelectedVertexIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.originalPositions = [];
    
    if (this.vertexIds.length === 0) {
      console.warn('MoveVertices: No vertices selected or specified.');
      return;
    }

    // Calculate pivot point based on coordinate space
    const pivot = this.calculatePivot();
    
    // Transform each vertex
    this.vertexIds.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (!vertex) {
        console.warn(`MoveVertices: Vertex with ID ${vertexId} not found.`);
        return;
      }

      // Store original position
      const originalPosition = vertex.position.clone();
      
      // Calculate new position
      const newPosition = CoordinateSystem.translatePosition(
        vertex.position,
        this.translation,
        this.options
      );
      
      // Store state for undo
      this.originalPositions.push({
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
    // Restore original positions
    this.originalPositions.forEach(state => {
      const vertex = this.mesh.getVertex(state.vertexId);
      if (vertex) {
        vertex.position = state.originalPosition.clone();
      }
    });
    
    // Update mesh bounding box
    this.mesh.computeBoundingBox();
    
    // Clear stored state
    this.originalPositions = [];
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
    const constraint = this.options.constrainAxis;
    
    let desc = `Move ${vertexCount} vertex${vertexCount === 1 ? '' : 'es'}`;
    desc += ` (${this.translation.x.toFixed(2)}, ${this.translation.y.toFixed(2)}, ${this.translation.z.toFixed(2)})`;
    desc += ` [${space}]`;
    
    if (constraint) {
      desc += ` [${constraint}-axis]`;
    }
    
    return desc;
  }

  /**
   * Gets transformation statistics.
   * @returns Statistics object.
   */
  getTransformationStats(): {
    verticesTransformed: number;
    translationDistance: number;
    pivot: Vector3D;
    bounds: { min: Vector3D; max: Vector3D; center: Vector3D; size: Vector3D };
  } {
    const pivot = this.calculatePivot();
    const translationDistance = this.translation.length();
    
    const positions = this.originalPositions.map(state => state.newPosition);
    const bounds = CoordinateSystem.calculateBounds(positions);
    
    return {
      verticesTransformed: this.originalPositions.length,
      translationDistance,
      pivot,
      bounds
    };
  }

  /**
   * Static factory method to move vertices along X axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param distance - Distance to move.
   * @param space - Coordinate space.
   * @returns MoveVertices command instance.
   */
  static moveAlongX(
    mesh: Mesh,
    selectionManager: SelectionManager,
    distance: number,
    space: CoordinateSpace = CoordinateSpace.WORLD
  ): MoveVertices {
    return new MoveVertices(
      mesh, 
      selectionManager, 
      new Vector3D(distance, 0, 0),
      { space, constrainAxis: 'x' }
    );
  }

  /**
   * Static factory method to move vertices along Y axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param distance - Distance to move.
   * @param space - Coordinate space.
   * @returns MoveVertices command instance.
   */
  static moveAlongY(
    mesh: Mesh,
    selectionManager: SelectionManager,
    distance: number,
    space: CoordinateSpace = CoordinateSpace.WORLD
  ): MoveVertices {
    return new MoveVertices(
      mesh, 
      selectionManager, 
      new Vector3D(0, distance, 0),
      { space, constrainAxis: 'y' }
    );
  }

  /**
   * Static factory method to move vertices along Z axis.
   * @param mesh - The mesh containing vertices.
   * @param selectionManager - The selection manager.
   * @param distance - Distance to move.
   * @param space - Coordinate space.
   * @returns MoveVertices command instance.
   */
  static moveAlongZ(
    mesh: Mesh,
    selectionManager: SelectionManager,
    distance: number,
    space: CoordinateSpace = CoordinateSpace.WORLD
  ): MoveVertices {
    return new MoveVertices(
      mesh, 
      selectionManager, 
      new Vector3D(0, 0, distance),
      { space, constrainAxis: 'z' }
    );
  }
} 