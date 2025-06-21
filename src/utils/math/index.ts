/**
 * 🔢 Math Utilities - Mathematical operations and vector calculations
 * 
 * Comprehensive math module with vector operations, transformations,
 * and utility functions for 3D graphics applications.
 */

// Core vector class
export { Vector3D } from './Vector3D';

// Advanced vector operations
export { VectorOperations, VectorUtils } from './VectorOperations';

// For backward compatibility, extend Vector3D with advanced operations
import { Vector3D } from './Vector3D';
import { VectorOperations } from './VectorOperations';

// Add missing methods to Vector3D prototype for backward compatibility
declare module './Vector3D' {
  interface Vector3D {
    addScaledVector(v: Vector3D, scale: number): this;
    lerp(v: Vector3D, alpha: number): this;
    angleTo(v: Vector3D): number;
    applyAxisAngle(axis: Vector3D, angleRadians: number): this;
  }
}

// Extend Vector3D prototype with advanced operations
Vector3D.prototype.addScaledVector = function(v: Vector3D, scale: number): Vector3D {
  return VectorOperations.addScaledVector(this, v, scale);
};

Vector3D.prototype.lerp = function(v: Vector3D, alpha: number): Vector3D {
  return VectorOperations.lerp(this, v, alpha);
};

Vector3D.prototype.angleTo = function(v: Vector3D): number {
  return VectorOperations.angleTo(this, v);
};

Vector3D.prototype.applyAxisAngle = function(axis: Vector3D, angleRadians: number): Vector3D {
  return VectorOperations.applyAxisAngle(this, axis, angleRadians);
};

// Add static methods to Vector3D class
(Vector3D as any).add = function(a: Vector3D, b: Vector3D): Vector3D {
  return VectorOperations.addScaledVector(a.clone(), b, 1);
};

(Vector3D as any).subtract = function(a: Vector3D, b: Vector3D): Vector3D {
  return a.clone().subtract(b);
};

(Vector3D as any).cross = function(a: Vector3D, b: Vector3D): Vector3D {
  return a.clone().cross(b);
};

(Vector3D as any).fromAngleAxis = function(axis: Vector3D, angleRadians: number): Vector3D {
  return VectorOperations.fromAngleAxis(axis, angleRadians);
}; 