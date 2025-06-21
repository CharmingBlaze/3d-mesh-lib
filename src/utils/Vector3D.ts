/**
 * Represents a 3D vector with x, y, and z components.
 */
export class Vector3D {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}

  /**
   * Creates a new Vector3D with the same components.
   * @returns A new Vector3D instance.
   */
  clone(): Vector3D {
    return new Vector3D(this.x, this.y, this.z);
  }

  /**
   * Sets the components of this vector.
   * @param x - The x component.
   * @param y - The y component.
   * @param z - The z component.
   * @returns This vector.
   */
  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  /**
   * Copies the components from another vector.
   * @param v - The vector to copy from.
   * @returns This vector.
   */
  copy(v: Vector3D): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  /**
   * Adds another vector to this vector.
   * @param v - The vector to add.
   * @returns This vector.
   */
  add(v: Vector3D): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  /**
   * Subtracts another vector from this vector.
   * @param v - The vector to subtract.
   * @returns This vector.
   */
  subtract(v: Vector3D): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  /**
   * Multiplies this vector by a scalar.
   * @param scalar - The scalar value.
   * @returns This vector.
   */
  multiplyScalar(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  /**
   * Adds a scaled vector to this vector.
   * @param v - The vector to scale and add.
   * @param scale - The scale factor.
   * @returns This vector.
   */
  addScaledVector(v: Vector3D, scale: number): this {
    this.x += v.x * scale;
    this.y += v.y * scale;
    this.z += v.z * scale;
    return this;
  }

  /**
   * Linear interpolation between this vector and another vector.
   * @param v - The target vector.
   * @param alpha - The interpolation factor (0-1).
   * @returns This vector.
   */
  lerp(v: Vector3D, alpha: number): this {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }

  /**
   * Divides this vector by a scalar.
   * @param scalar - The scalar value.
   * @returns This vector.
   * @throws Error if scalar is zero.
   */
  divideScalar(scalar: number): this {
    if (scalar === 0) {
      throw new Error('Division by zero.');
    }
    return this.multiplyScalar(1 / scalar);
  }

  /**
   * Calculates the dot product of this vector and another vector.
   * @param v - The other vector.
   * @returns The dot product.
   */
  dot(v: Vector3D): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  /**
   * Calculates the cross product of this vector and another vector.
   * @param v - The other vector.
   * @returns This vector (result of the cross product).
   */
  cross(v: Vector3D): this {
    const x = this.x, y = this.y, z = this.z;
    this.x = y * v.z - z * v.y;
    this.y = z * v.x - x * v.z;
    this.z = x * v.y - y * v.x;
    return this;
  }

  /**
   * Calculates the length (magnitude) of this vector.
   * @returns The length of the vector.
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /**
   * Calculates the squared length of this vector.
   * (Useful for comparisons as it avoids a square root operation).
   * @returns The squared length of the vector.
   */
  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * Normalizes this vector (makes its length 1).
   * @returns This vector.
   */
  normalize(): this {
    const len = this.length();
    if (len === 0) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
    } else {
      this.divideScalar(len);
    }
    return this;
  }

  /**
   * Calculates the distance to another vector.
   * @param v - The other vector.
   * @returns The distance between the two vectors.
   */
  distanceTo(v: Vector3D): number {
    return Math.sqrt(this.distanceToSquared(v));
  }

  /**
   * Calculates the squared distance to another vector.
   * @param v - The other vector.
   * @returns The squared distance between the two vectors.
   */
  distanceToSquared(v: Vector3D): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Negates this vector.
   * @returns This vector.
   */
  negate(): this {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  /**
   * Checks if this vector is equal to another vector.
   * @param v - The vector to compare with.
   * @param tolerance - Optional tolerance for floating point comparison.
   * @returns True if the vectors are equal, false otherwise.
   */
  equals(v: Vector3D, tolerance: number = 1e-6): boolean {
    return (
      Math.abs(this.x - v.x) <= tolerance &&
      Math.abs(this.y - v.y) <= tolerance &&
      Math.abs(this.z - v.z) <= tolerance
    );
  }

  /**
   * Returns a string representation of the vector.
   * @returns String representation.
   */
  toString(): string {
    return `Vector3D(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }

  /**
   * Calculates the angle in radians between this vector and another vector.
   * @param v The other vector.
   * @returns The angle in radians. Returns 0 if either vector is a zero vector.
   */
  angleTo(v: Vector3D): number {
    const denominator = this.length() * v.length();
    if (denominator === 0) {
      return 0; // Or handle as an error, but 0 is safe for angle comparison if one is zero length
    }
    const dotProduct = this.dot(v);
    // Clamp dotProduct / denominator to the range [-1, 1] to avoid Math.acos errors due to floating point inaccuracies
    const clampedValue = Math.max(-1, Math.min(1, dotProduct / denominator));
    return Math.acos(clampedValue);
  }

  /**
   * Applies a rotation to this vector by a given axis (unit vector) and angle.
   * Uses Rodrigues' rotation formula: v_rot = v*cos(a) + (k x v)*sin(a) + k*(k . v)*(1-cos(a))
   * @param axis - The axis of rotation (must be a unit vector).
   * @param angleRadians - The angle of rotation in radians.
   * @returns This vector, rotated.
   */
  applyAxisAngle(axis: Vector3D, angleRadians: number): this {
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);
    const oneMinusCosAngle = 1 - cosAngle;

    // v*cos(a)
    const term1x = this.x * cosAngle;
    const term1y = this.y * cosAngle;
    const term1z = this.z * cosAngle;

    // (k x v)*sin(a)
    const crossProductX = axis.y * this.z - axis.z * this.y;
    const crossProductY = axis.z * this.x - axis.x * this.z;
    const crossProductZ = axis.x * this.y - axis.y * this.x;
    const term2x = crossProductX * sinAngle;
    const term2y = crossProductY * sinAngle;
    const term2z = crossProductZ * sinAngle;

    // k*(k . v)*(1-cos(a))
    const dotProduct = axis.x * this.x + axis.y * this.y + axis.z * this.z;
    const term3x = axis.x * dotProduct * oneMinusCosAngle;
    const term3y = axis.y * dotProduct * oneMinusCosAngle;
    const term3z = axis.z * dotProduct * oneMinusCosAngle;

    this.x = term1x + term2x + term3x;
    this.y = term1y + term2y + term3y;
    this.z = term1z + term2z + term3z;

    return this;
  }

  /**
   * Returns the components of this vector as a number array.
   * @returns An array [x, y, z].
   */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  // Static methods for convenience

  /**
   * Creates a new Vector3D by adding two vectors.
   * @param a - The first vector.
   * @param b - The second vector.
   * @returns A new Vector3D representing the sum.
   */
  static add(a: Vector3D, b: Vector3D): Vector3D {
    return new Vector3D(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  /**
   * Creates a new Vector3D by subtracting one vector from another.
   * @param a - The vector to subtract from.
   * @param b - The vector to subtract.
   * @returns A new Vector3D representing the difference.
   */
  static subtract(a: Vector3D, b: Vector3D): Vector3D {
    return new Vector3D(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  /**
   * Creates a new Vector3D by calculating the cross product of two vectors.
   * @param a - The first vector.
   * @param b - The second vector.
   * @returns A new Vector3D representing the cross product.
   */
  static cross(a: Vector3D, b: Vector3D): Vector3D {
    return new Vector3D(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  /**
   * Creates a new Vector3D from a number array.
   * @param arr - An array [x, y, z].
   * @returns A new Vector3D instance.
   * @throws Error if array does not have 3 elements.
   */
  static fromArray(arr: number[]): Vector3D {
    if (arr.length !== 3) {
      throw new Error('Array must contain exactly 3 numbers to create a Vector3D.');
    }
    return new Vector3D(arr[0], arr[1], arr[2]);
  }

  /**
   * Creates a new Vector3D from an axis and an angle.
   * This is often used for creating rotation vectors or orientation vectors.
   * The resulting vector's length will be the angle if the axis is a unit vector.
   * For a more standard representation of rotation (like a quaternion or rotation matrix),
   * this might not be directly what you need, but it can be a component in such calculations.
   * @param axis - The axis of rotation (should be a unit vector for predictable length).
   * @param angleRadians - The angle in radians.
   * @returns A new Vector3D representing the scaled axis.
   */
  static fromAngleAxis(axis: Vector3D, angleRadians: number): Vector3D {
    // Typically, an axis-angle representation implies the axis is a unit vector,
    // and the rotation is 'around' this axis. If one wants to represent the rotation
    // itself as a vector, it's often axis * angle.
    return axis.clone().multiplyScalar(angleRadians);
  }

  static get ZERO(): Vector3D {
    return new Vector3D(0, 0, 0);
  }
}
