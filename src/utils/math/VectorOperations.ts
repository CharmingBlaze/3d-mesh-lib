/**
 * 🔢 Vector Operations - Advanced mathematical operations for Vector3D
 * 
 * Extended functionality for complex vector calculations including
 * interpolation, rotation, and advanced mathematical operations.
 */

import { Vector3D } from './Vector3D';

/**
 * Advanced vector operations that extend Vector3D functionality
 */
export class VectorOperations {
  /**
   * Adds a scaled vector to this vector.
   * @param vector - The base vector to modify
   * @param v - The vector to scale and add.
   * @param scale - The scale factor.
   * @returns The modified vector.
   */
  static addScaledVector(vector: Vector3D, v: Vector3D, scale: number): Vector3D {
    vector.x += v.x * scale;
    vector.y += v.y * scale;
    vector.z += v.z * scale;
    return vector;
  }

  /**
   * Linear interpolation between two vectors.
   * @param vector - The base vector to modify
   * @param target - The target vector.
   * @param alpha - The interpolation factor (0-1).
   * @returns The modified vector.
   */
  static lerp(vector: Vector3D, target: Vector3D, alpha: number): Vector3D {
    vector.x += (target.x - vector.x) * alpha;
    vector.y += (target.y - vector.y) * alpha;
    vector.z += (target.z - vector.z) * alpha;
    return vector;
  }

  /**
   * Calculates the angle between two vectors.
   * @param a - First vector.
   * @param b - Second vector.
   * @returns The angle in radians.
   */
  static angleTo(a: Vector3D, b: Vector3D): number {
    const denominator = Math.sqrt(a.lengthSq() * b.lengthSq());
    if (denominator === 0) return Math.PI / 2;
    
    const theta = a.dot(b) / denominator;
    return Math.acos(Math.max(-1, Math.min(1, theta)));
  }

  /**
   * Applies an axis-angle rotation to a vector.
   * @param vector - The vector to rotate
   * @param axis - The rotation axis (should be normalized).
   * @param angleRadians - The rotation angle in radians.
   * @returns The rotated vector.
   */
  static applyAxisAngle(vector: Vector3D, axis: Vector3D, angleRadians: number): Vector3D {
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    const oneMinusCos = 1 - cos;
    
    const dot = vector.dot(axis);
    const cross = VectorUtils.cross(axis.clone(), vector.clone());
    
    vector.x = vector.x * cos + cross.x * sin + axis.x * dot * oneMinusCos;
    vector.y = vector.y * cos + cross.y * sin + axis.y * dot * oneMinusCos;
    vector.z = vector.z * cos + cross.z * sin + axis.z * dot * oneMinusCos;
    
    return vector;
  }

  /**
   * Creates a vector from an axis and angle.
   * @param axis - The rotation axis.
   * @param angleRadians - The angle in radians.
   * @returns A new vector.
   */
  static fromAngleAxis(axis: Vector3D, angleRadians: number): Vector3D {
    const result = new Vector3D(1, 0, 0);
    return VectorOperations.applyAxisAngle(result, axis, angleRadians);
  }

  /**
   * Projects vector A onto vector B.
   * @param a - Vector to project.
   * @param b - Vector to project onto.
   * @returns The projection of A onto B.
   */
  static project(a: Vector3D, b: Vector3D): Vector3D {
    const bLengthSq = b.lengthSq();
    if (bLengthSq === 0) {
      return new Vector3D(0, 0, 0);
    }
    
    const scalar = a.dot(b) / bLengthSq;
    return b.clone().multiplyScalar(scalar);
  }

  /**
   * Reflects a vector across a normal.
   * @param vector - Vector to reflect.
   * @param normal - Normal vector (should be normalized).
   * @returns The reflected vector.
   */
  static reflect(vector: Vector3D, normal: Vector3D): Vector3D {
    const dot = vector.dot(normal);
    return vector.clone().subtract(normal.clone().multiplyScalar(2 * dot));
  }

  /**
   * Clamps a vector's length to a maximum value.
   * @param vector - Vector to clamp.
   * @param maxLength - Maximum allowed length.
   * @returns The clamped vector.
   */
  static clampLength(vector: Vector3D, maxLength: number): Vector3D {
    const length = vector.length();
    if (length > maxLength) {
      vector.normalize().multiplyScalar(maxLength);
    }
    return vector;
  }

  /**
   * Spherical linear interpolation between two vectors.
   * @param a - First vector.
   * @param b - Second vector.
   * @param t - Interpolation factor (0-1).
   * @returns The interpolated vector.
   */
  static slerp(a: Vector3D, b: Vector3D, t: number): Vector3D {
    const angle = VectorOperations.angleTo(a, b);
    
    if (Math.abs(angle) < 1e-6) {
      return VectorOperations.lerp(a.clone(), b, t);
    }
    
    const sinAngle = Math.sin(angle);
    const factor1 = Math.sin((1 - t) * angle) / sinAngle;
    const factor2 = Math.sin(t * angle) / sinAngle;
    
    return a.clone().multiplyScalar(factor1).add(b.clone().multiplyScalar(factor2));
  }
}

/**
 * Static utility functions for vector operations
 */
export class VectorUtils {
  /**
   * Creates a vector by adding two vectors.
   * @param a - First vector.
   * @param b - Second vector.
   * @returns A new vector (a + b).
   */
  static add(a: Vector3D, b: Vector3D): Vector3D {
    return new Vector3D(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  /**
   * Creates a vector by subtracting vector b from vector a.
   * @param a - First vector.
   * @param b - Second vector.
   * @returns A new vector (a - b).
   */
  static subtract(a: Vector3D, b: Vector3D): Vector3D {
    return new Vector3D(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  /**
   * Creates a vector by computing the cross product of two vectors.
   * @param a - First vector.
   * @param b - Second vector.
   * @returns A new vector (a × b).
   */
  static cross(a: Vector3D, b: Vector3D): Vector3D {
    return new Vector3D(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  /**
   * Calculates the centroid of multiple vectors.
   * @param vectors - Array of vectors.
   * @returns The centroid vector.
   */
  static centroid(vectors: Vector3D[]): Vector3D {
    if (vectors.length === 0) {
      return new Vector3D(0, 0, 0);
    }
    
    const sum = vectors.reduce((acc, v) => acc.add(v), new Vector3D(0, 0, 0));
    return sum.divideScalar(vectors.length);
  }

  /**
   * Finds the vector with minimum components from an array.
   * @param vectors - Array of vectors.
   * @returns Vector with minimum x, y, z components.
   */
  static min(vectors: Vector3D[]): Vector3D {
    if (vectors.length === 0) {
      return new Vector3D(0, 0, 0);
    }
    
    return vectors.reduce((min, v) => new Vector3D(
      Math.min(min.x, v.x),
      Math.min(min.y, v.y),
      Math.min(min.z, v.z)
    ));
  }

  /**
   * Finds the vector with maximum components from an array.
   * @param vectors - Array of vectors.
   * @returns Vector with maximum x, y, z components.
   */
  static max(vectors: Vector3D[]): Vector3D {
    if (vectors.length === 0) {
      return new Vector3D(0, 0, 0);
    }
    
    return vectors.reduce((max, v) => new Vector3D(
      Math.max(max.x, v.x),
      Math.max(max.y, v.y),
      Math.max(max.z, v.z)
    ));
  }
}

// Re-export for convenience
export { Vector3D }; 