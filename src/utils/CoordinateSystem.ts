import { Vector3D } from './Vector3D';

export enum CoordinateSpace {
  WORLD = 'world',
  LOCAL = 'local',
  SELECTION = 'selection'
}

export interface Transform {
  position: Vector3D;
  rotation: Vector3D;  // Euler angles in radians
  scale: Vector3D;
}

export interface TransformationOptions {
  space: CoordinateSpace;
  pivot?: Vector3D;
  constrainAxis?: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | null;
  relative?: boolean;  // True for relative transformation, false for absolute
}

/**
 * Utility class for coordinate system transformations and calculations.
 */
export class CoordinateSystem {
  
  /**
   * Creates a default transform at origin.
   * @returns Default transform.
   */
  static createDefaultTransform(): Transform {
    return {
      position: new Vector3D(0, 0, 0),
      rotation: new Vector3D(0, 0, 0),
      scale: new Vector3D(1, 1, 1)
    };
  }

  /**
   * Calculates the center point of a collection of positions.
   * @param positions - Array of Vector3D positions.
   * @returns Center point.
   */
  static calculateCenter(positions: Vector3D[]): Vector3D {
    if (positions.length === 0) {
      return new Vector3D(0, 0, 0);
    }

    let sum = new Vector3D(0, 0, 0);
    for (const pos of positions) {
      sum = sum.add(pos);
    }
    
    return sum.multiplyScalar(1 / positions.length);
  }

  /**
   * Calculates bounding box of positions.
   * @param positions - Array of Vector3D positions.
   * @returns Object with min and max bounds.
   */
  static calculateBounds(positions: Vector3D[]): { min: Vector3D; max: Vector3D; center: Vector3D; size: Vector3D } {
    if (positions.length === 0) {
      const zero = new Vector3D(0, 0, 0);
      return { min: zero, max: zero, center: zero, size: zero };
    }

    let min = positions[0].clone();
    let max = positions[0].clone();

    for (let i = 1; i < positions.length; i++) {
      const pos = positions[i];
      min.x = Math.min(min.x, pos.x);
      min.y = Math.min(min.y, pos.y);
      min.z = Math.min(min.z, pos.z);
      max.x = Math.max(max.x, pos.x);
      max.y = Math.max(max.y, pos.y);
      max.z = Math.max(max.z, pos.z);
    }

    const center = min.add(max).multiplyScalar(0.5);
    const size = max.subtract(min);

    return { min, max, center, size };
  }

  /**
   * Transforms a position by translation.
   * @param position - Original position.
   * @param translation - Translation vector.
   * @param options - Transformation options.
   * @returns Transformed position.
   */
  static translatePosition(
    position: Vector3D, 
    translation: Vector3D, 
    options: TransformationOptions
  ): Vector3D {
    let result = position.clone();
    let actualTranslation = translation.clone();

    // Apply axis constraints
    if (options.constrainAxis) {
      actualTranslation = this.applyAxisConstraint(actualTranslation, options.constrainAxis);
    }

    if (options.relative) {
      result = result.add(actualTranslation);
    } else {
      result = actualTranslation.clone();
    }

    return result;
  }

  /**
   * Transforms a position by rotation around a pivot point.
   * @param position - Original position.
   * @param rotation - Rotation in radians (Euler angles).
   * @param pivot - Pivot point for rotation.
   * @param options - Transformation options.
   * @returns Transformed position.
   */
  static rotatePosition(
    position: Vector3D, 
    rotation: Vector3D, 
    pivot: Vector3D, 
    options: TransformationOptions
  ): Vector3D {
    // Translate to pivot origin
    let result = position.subtract(pivot);
    
    // Apply rotations (order: Z, Y, X)
    if (rotation.z !== 0) {
      result = this.rotateAroundZ(result, rotation.z);
    }
    if (rotation.y !== 0) {
      result = this.rotateAroundY(result, rotation.y);
    }
    if (rotation.x !== 0) {
      result = this.rotateAroundX(result, rotation.x);
    }
    
    // Translate back from pivot
    return result.add(pivot);
  }

  /**
   * Transforms a position by scaling around a pivot point.
   * @param position - Original position.
   * @param scale - Scale factors.
   * @param pivot - Pivot point for scaling.
   * @param options - Transformation options.
   * @returns Transformed position.
   */
  static scalePosition(
    position: Vector3D, 
    scale: Vector3D, 
    pivot: Vector3D, 
    options: TransformationOptions
  ): Vector3D {
    // Translate to pivot origin
    let result = position.subtract(pivot);
    
    // Apply scaling
    result = new Vector3D(
      result.x * scale.x,
      result.y * scale.y,
      result.z * scale.z
    );
    
    // Translate back from pivot
    return result.add(pivot);
  }

  /**
   * Rotates a vector around the X axis.
   * @param vector - Vector to rotate.
   * @param angle - Rotation angle in radians.
   * @returns Rotated vector.
   */
  private static rotateAroundX(vector: Vector3D, angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    return new Vector3D(
      vector.x,
      vector.y * cos - vector.z * sin,
      vector.y * sin + vector.z * cos
    );
  }

  /**
   * Rotates a vector around the Y axis.
   * @param vector - Vector to rotate.
   * @param angle - Rotation angle in radians.
   * @returns Rotated vector.
   */
  private static rotateAroundY(vector: Vector3D, angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    return new Vector3D(
      vector.x * cos + vector.z * sin,
      vector.y,
      -vector.x * sin + vector.z * cos
    );
  }

  /**
   * Rotates a vector around the Z axis.
   * @param vector - Vector to rotate.
   * @param angle - Rotation angle in radians.
   * @returns Rotated vector.
   */
  private static rotateAroundZ(vector: Vector3D, angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    return new Vector3D(
      vector.x * cos - vector.y * sin,
      vector.x * sin + vector.y * cos,
      vector.z
    );
  }

  /**
   * Applies axis constraints to a vector.
   * @param vector - Input vector.
   * @param constraint - Axis constraint.
   * @returns Constrained vector.
   */
  private static applyAxisConstraint(vector: Vector3D, constraint: string): Vector3D {
    const result = vector.clone();
    
    switch (constraint) {
      case 'x':
        result.y = 0;
        result.z = 0;
        break;
      case 'y':
        result.x = 0;
        result.z = 0;
        break;
      case 'z':
        result.x = 0;
        result.y = 0;
        break;
      case 'xy':
        result.z = 0;
        break;
      case 'xz':
        result.y = 0;
        break;
      case 'yz':
        result.x = 0;
        break;
    }
    
    return result;
  }

  /**
   * Converts degrees to radians.
   * @param degrees - Angle in degrees.
   * @returns Angle in radians.
   */
  static degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Converts radians to degrees.
   * @param radians - Angle in radians.
   * @returns Angle in degrees.
   */
  static radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Creates a transformation matrix from position, rotation, and scale.
   * @param transform - Transform object.
   * @returns 4x4 transformation matrix as flat array.
   */
  static createTransformMatrix(transform: Transform): number[] {
    // This is a simplified transformation matrix creation
    // In a real implementation, you'd use proper matrix math
    const { position, rotation, scale } = transform;
    
    // For now, return identity matrix - extend as needed
    return [
      scale.x, 0, 0, position.x,
      0, scale.y, 0, position.y,
      0, 0, scale.z, position.z,
      0, 0, 0, 1
    ];
  }
} 