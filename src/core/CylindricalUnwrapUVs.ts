import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';

interface UVData {
  vertexId: number;
  originalU: number;
  originalV: number;
  newU: number;
  newV: number;
}

/**
 * Command to unwrap UVs using cylindrical projection.
 * Projects vertices onto a cylinder and maps to UV coordinates.
 */
export class CylindricalUnwrapUVs implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private axis: 'x' | 'y' | 'z'; // Cylinder axis
  private center: Vector3D; // Center of the cylinder
  private radius: number; // Radius for the cylindrical projection
  private height: number; // Height of the cylinder
  private unwrapSelectedOnly: boolean;
  
  // Store data for undo
  private uvData: UVData[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of CylindricalUnwrapUVs command.
   * @param mesh - The mesh to unwrap.
   * @param selectionManager - The selection manager.
   * @param axis - The axis of the cylinder ('x', 'y', or 'z').
   * @param center - Center point of the cylinder (default: mesh center).
   * @param radius - Radius of the cylinder (default: auto-calculated).
   * @param height - Height of the cylinder (default: auto-calculated).
   * @param unwrapSelectedOnly - If true, only unwrap selected vertices (default: false).
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    axis: 'x' | 'y' | 'z' = 'y',
    center?: Vector3D,
    radius?: number,
    height?: number,
    unwrapSelectedOnly: boolean = false
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.axis = axis;
    this.unwrapSelectedOnly = unwrapSelectedOnly;
    
    // Calculate mesh bounds for default parameters
    const bounds = this.calculateMeshBounds();
    
    this.center = center || new Vector3D(
      (bounds.min.x + bounds.max.x) / 2,
      (bounds.min.y + bounds.max.y) / 2,
      (bounds.min.z + bounds.max.z) / 2
    );
    
    // Auto-calculate radius and height based on mesh bounds
    const size = Vector3D.subtract(bounds.max, bounds.min);
    if (axis === 'x') {
      this.radius = radius || Math.max(size.y, size.z) / 2;
      this.height = height || size.x;
    } else if (axis === 'y') {
      this.radius = radius || Math.max(size.x, size.z) / 2;
      this.height = height || size.y;
    } else { // axis === 'z'
      this.radius = radius || Math.max(size.x, size.y) / 2;
      this.height = height || size.z;
    }
    
    const targetDesc = unwrapSelectedOnly ? 'selected vertices' : 'entire mesh';
    this.description = `Cylindrical UV unwrap ${targetDesc} (${axis}-axis, r=${this.radius.toFixed(2)})`;
  }

  execute(): void {
    this.uvData = [];
    
    const verticesToUnwrap = this.getVerticesToUnwrap();
    if (verticesToUnwrap.length === 0) {
      console.warn('CylindricalUnwrapUVs: No vertices to unwrap.');
      return;
    }

    // Store original UV coordinates and calculate new ones
    verticesToUnwrap.forEach(vertexId => {
      const vertex = this.mesh.getVertex(vertexId);
      if (vertex) {
        const originalU = vertex.uv ? vertex.uv.u : 0;
        const originalV = vertex.uv ? vertex.uv.v : 0;
        
        const cylindricalUV = this.calculateCylindricalUV(vertex.position);
        
        this.uvData.push({
          vertexId: vertexId,
          originalU: originalU,
          originalV: originalV,
          newU: cylindricalUV.u,
          newV: cylindricalUV.v
        });
        
        // Apply new UV coordinates
        if (!vertex.uv) {
          vertex.uv = { u: cylindricalUV.u, v: cylindricalUV.v };
        } else {
          vertex.uv.u = cylindricalUV.u;
          vertex.uv.v = cylindricalUV.v;
        }
      }
    });

    console.log(`CylindricalUnwrapUVs: Unwrapped ${verticesToUnwrap.length} vertices using ${this.axis}-axis cylindrical projection.`);
  }

  undo(): void {
    // Restore original UV coordinates
    this.uvData.forEach(data => {
      const vertex = this.mesh.getVertex(data.vertexId);
      if (vertex) {
        if (!vertex.uv) {
          vertex.uv = { u: data.originalU, v: data.originalV };
        } else {
          vertex.uv.u = data.originalU;
          vertex.uv.v = data.originalV;
        }
      }
    });
    
    this.uvData = [];
  }

  /**
   * Gets the list of vertices to unwrap based on selection and settings.
   * @returns Array of vertex IDs to unwrap.
   */
  private getVerticesToUnwrap(): number[] {
    if (this.unwrapSelectedOnly) {
      const selectedVertices = this.selectionManager.getSelectedVertexIds();
      if (selectedVertices.size === 0) {
        console.warn('CylindricalUnwrapUVs: No vertices selected for unwrapping.');
        return [];
      }
      return Array.from(selectedVertices);
    } else {
      return Array.from(this.mesh.vertices.keys());
    }
  }

  /**
   * Calculates cylindrical UV coordinates for a 3D position.
   * @param position - The 3D position.
   * @returns UV coordinates.
   */
  private calculateCylindricalUV(position: Vector3D): { u: number; v: number } {
    // Translate position relative to cylinder center
    const relativePos = Vector3D.subtract(position, this.center);
    
    let u: number, v: number;
    
    switch (this.axis) {
      case 'x':
        // Cylinder aligned with X-axis
        u = this.calculateAngleU(relativePos.z, relativePos.y);
        v = (relativePos.x + this.height / 2) / this.height; // Normalize height to [0,1]
        break;
        
      case 'y':
        // Cylinder aligned with Y-axis (most common)
        u = this.calculateAngleU(relativePos.x, relativePos.z);
        v = (relativePos.y + this.height / 2) / this.height; // Normalize height to [0,1]
        break;
        
      case 'z':
        // Cylinder aligned with Z-axis
        u = this.calculateAngleU(relativePos.x, relativePos.y);
        v = (relativePos.z + this.height / 2) / this.height; // Normalize height to [0,1]
        break;
        
      default:
        u = 0;
        v = 0;
    }
    
    // Clamp values to [0,1] range
    u = Math.max(0, Math.min(1, u));
    v = Math.max(0, Math.min(1, v));
    
    return { u, v };
  }

  /**
   * Calculates the U coordinate based on angle around the cylinder.
   * @param x - X component in the cylinder's local coordinate system.
   * @param y - Y component in the cylinder's local coordinate system.
   * @returns U coordinate [0,1].
   */
  private calculateAngleU(x: number, y: number): number {
    const angle = Math.atan2(y, x);
    // Convert from [-π, π] to [0, 2π] then normalize to [0, 1]
    const normalizedAngle = (angle + Math.PI) / (2 * Math.PI);
    return normalizedAngle;
  }

  /**
   * Calculates the bounds of the mesh.
   * @returns Object with min and max bounds.
   */
  private calculateMeshBounds(): { min: Vector3D; max: Vector3D } {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    this.mesh.vertices.forEach(vertex => {
      minX = Math.min(minX, vertex.position.x);
      minY = Math.min(minY, vertex.position.y);
      minZ = Math.min(minZ, vertex.position.z);
      maxX = Math.max(maxX, vertex.position.x);
      maxY = Math.max(maxY, vertex.position.y);
      maxZ = Math.max(maxZ, vertex.position.z);
    });
    
    return {
      min: new Vector3D(minX, minY, minZ),
      max: new Vector3D(maxX, maxY, maxZ)
    };
  }

  /**
   * Gets statistics about the UV unwrapping operation.
   * @returns Object with unwrapping statistics.
   */
  getUnwrapStats(): {
    verticesUnwrapped: number;
    averageUVChange: number;
    maxUVChange: number;
    cylinderAxis: string;
    cylinderRadius: number;
    cylinderHeight: number;
  } {
    const uvChanges = this.uvData.map(data => {
      const du = data.newU - data.originalU;
      const dv = data.newV - data.originalV;
      return Math.sqrt(du * du + dv * dv);
    });

    const averageUVChange = uvChanges.length > 0 
      ? uvChanges.reduce((sum, change) => sum + change, 0) / uvChanges.length 
      : 0;

    const maxUVChange = uvChanges.length > 0 
      ? Math.max(...uvChanges) 
      : 0;

    return {
      verticesUnwrapped: this.uvData.length,
      averageUVChange,
      maxUVChange,
      cylinderAxis: this.axis,
      cylinderRadius: this.radius,
      cylinderHeight: this.height
    };
  }
} 