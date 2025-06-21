/**
 * Represents a 2D vector, commonly used for UV coordinates, offsets, and scales.
 */
export class Vector2D {
  public x: number;
  public y: number;

  /**
   * Creates a new Vector2D instance.
   * @param x - The x component.
   * @param y - The y component.
   */
  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Creates a new Vector2D with the same values.
   * @returns A new Vector2D instance.
   */
  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  /**
   * Sets the components of this vector.
   * @param x - The new x component.
   * @param y - The new y component.
   * @returns This vector for chaining.
   */
  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Adds another vector to this vector.
   * @param v - The vector to add.
   * @returns This vector for chaining.
   */
  add(v: Vector2D): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /**
   * Subtracts another vector from this vector.
   * @param v - The vector to subtract.
   * @returns This vector for chaining.
   */
  subtract(v: Vector2D): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /**
   * Multiplies this vector by a scalar.
   * @param scalar - The scalar value.
   * @returns This vector for chaining.
   */
  multiplyScalar(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Compares this vector to another for equality.
   * @param v - The vector to compare with.
   * @param tolerance - Optional tolerance for floating point comparisons.
   * @returns True if the vectors are equal, false otherwise.
   */
  equals(v: Vector2D, tolerance: number = 1e-6): boolean {
    return Math.abs(this.x - v.x) <= tolerance && Math.abs(this.y - v.y) <= tolerance;
  }

  toString(): string {
    return `Vector2D(${this.x}, ${this.y})`;
  }

  /**
   * Converts this vector to a 2-element array.
   * @returns An array [x, y].
   */
  toArray(): [number, number] {
    return [this.x, this.y];
  }

  /**
   * Creates a Vector2D from a 2-element array.
   * @param arr - An array [x, y].
   * @returns A new Vector2D instance.
   * @throws Error if array is not of length 2.
   */
  static fromArray(arr: [number, number] | number[]): Vector2D {
    if (arr.length !== 2) {
      throw new Error('Vector2D.fromArray: input array must have 2 elements.');
    }
    return new Vector2D(arr[0], arr[1]);
  }
}
