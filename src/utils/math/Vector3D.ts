/**
 * 🔢 Vector3D - Core 3D vector class
 * 
 * Main Vector3D class with essential operations.
 * Extended functionality is available in separate modules.
 */

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
   * Checks if this vector equals another vector within a tolerance.
   * @param v - The vector to compare with.
   * @param tolerance - The tolerance for the comparison.
   * @returns True if the vectors are equal within the tolerance.
   */
  equals(v: Vector3D, tolerance: number = 1e-6): boolean {
    return (
      Math.abs(this.x - v.x) < tolerance &&
      Math.abs(this.y - v.y) < tolerance &&
      Math.abs(this.z - v.z) < tolerance
    );
  }

  /**
   * Returns a string representation of this vector.
   * @returns String representation.
   */
  toString(): string {
    return `Vector3D(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }

  /**
   * Converts this vector to an array.
   * @returns The vector as a three-element array.
   */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  // ===================================
  // 🏭 STATIC FACTORY METHODS
  // ===================================

  /**
   * Creates a new vector from an array.
   * @param arr - The array containing x, y, z components.
   * @returns A new Vector3D instance.
   */
  static fromArray(arr: number[]): Vector3D {
    if (arr.length < 3) {
      throw new Error('Array must contain at least 3 elements for Vector3D.');
    }
    return new Vector3D(arr[0], arr[1], arr[2]);
  }

  /**
   * Zero vector constant.
   */
  static get ZERO(): Vector3D {
    return new Vector3D(0, 0, 0);
  }

  /**
   * Unit X vector constant.
   */
  static get UNIT_X(): Vector3D {
    return new Vector3D(1, 0, 0);
  }

  /**
   * Unit Y vector constant.
   */
  static get UNIT_Y(): Vector3D {
    return new Vector3D(0, 1, 0);
  }

  /**
   * Unit Z vector constant.
   */
  static get UNIT_Z(): Vector3D {
    return new Vector3D(0, 0, 1);
  }
} 