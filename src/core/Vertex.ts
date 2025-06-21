import { Vector3D } from '@/utils/Vector3D';

/**
 * Represents a vertex in a 3D mesh.
 * Each vertex has a unique ID, a position, and can optionally store
 * a normal vector and UV coordinates.
 * Vertex instances are mutable; their properties like position, normal, and UVs
 * can be changed directly or via setter methods.
 */
export class Vertex {
  private static nextId = 0;
  public id: number;
  public position: Vector3D;
  public normal: Vector3D | null = null;
  public uv: { u: number; v: number } | null = null;
  public metadata: Record<string, any> = {};

  // For linking to other mesh components (e.g., edges, faces)
  // These are typically managed by the Mesh class
  public edges: Set<string> = new Set(); // Stores Edge keys (Edge.getKey())
  public faces: Set<number> = new Set(); // Stores Face IDs

  /**
   * Creates a new Vertex instance.
   * @param x - The x-coordinate of the vertex position.
   * @param y - The y-coordinate of the vertex position.
   * @param z - The z-coordinate of the vertex position.
   * @param normal - Optional normal vector for the vertex.
   * @param uv - Optional UV coordinates for the vertex.
   */
  constructor(
    x: number,
    y: number,
    z: number,
    normal?: Vector3D,
    uv?: { u: number; v: number }
  ) {
    this.id = Vertex.nextId++;
    this.position = new Vector3D(x, y, z);
    if (normal) {
      this.normal = normal.clone();
    }
    if (uv) {
      this.uv = { ...uv };
    }
  }

  /**
   * Creates a new Vertex with the same properties.
   * The new vertex will have a new unique ID.
   * @returns A new Vertex instance.
   */
  clone(): Vertex {
    const newVertex = new Vertex(this.position.x, this.position.y, this.position.z);
    if (this.normal) {
      newVertex.normal = this.normal.clone();
    }
    if (this.uv) {
      newVertex.uv = { ...this.uv };
    }
    // Note: edges and faces are not cloned as they refer to relationships
    // Note: `edges` and `faces` sets are not cloned as they represent relationships
    // within a specific mesh context. These are typically rebuilt when a mesh is cloned.
    newVertex.metadata = JSON.parse(JSON.stringify(this.metadata)); // Deep copy metadata
    return newVertex;
  }

  /**
   * Sets the position of the vertex.
   * @param x - The x-coordinate.
   * @param y - The y-coordinate.
   * @param z - The z-coordinate.
   */
  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
  }

  /**
   * Sets the normal vector for the vertex.
   * @param nx - The x-component of the normal.
   * @param ny - The y-component of the normal.
   * @param nz - The z-component of the normal.
   */
  setNormal(nx: number, ny: number, nz: number): void {
    if (!this.normal) {
      this.normal = new Vector3D();
    }
    this.normal.set(nx, ny, nz);
  }

  /**
   * Sets the UV coordinates for the vertex.
   * @param u - The u-coordinate.
   * @param v - The v-coordinate.
   */
  setUV(u: number, v: number): void {
    if (!this.uv) {
      this.uv = { u: 0, v: 0 };
    }
    this.uv.u = u;
    this.uv.v = v;
  }

  /**
   * Checks if this vertex is equal to another vertex based on specified components.
   * @param other - The vertex to compare with.
   * @param options - Optional parameters to control which components are checked and their tolerances.
   * @returns True if the specified components are equal within tolerance, false otherwise.
   */
  equals(other: Vertex, options?: {
    checkPosition?: boolean;
    checkNormal?: boolean;
    checkUV?: boolean;
    posTolerance?: number;
    normalTolerance?: number;
    uvTolerance?: number;
  }): boolean {
    const checkPos = options?.checkPosition ?? true; // Default to checking position
    const checkNorm = options?.checkNormal ?? false;
    const checkUVs = options?.checkUV ?? false;

    const posTol = options?.posTolerance ?? 1e-6;
    const normalTol = options?.normalTolerance ?? 1e-6;
    const uvTol = options?.uvTolerance ?? 1e-6;

    if (checkPos && !this.position.equals(other.position, posTol)) {
      return false;
    }

    if (checkNorm) {
      if (this.normal && other.normal) {
        if (!this.normal.equals(other.normal, normalTol)) return false;
      } else if (this.normal !== other.normal) { // One has a normal, the other doesn't
        return false;
      }
    }

    if (checkUVs) {
      if (this.uv && other.uv) {
        if (Math.abs(this.uv.u - other.uv.u) > uvTol || Math.abs(this.uv.v - other.uv.v) > uvTol) {
          return false;
        }
      } else if (this.uv !== other.uv) { // One has UVs, the other doesn't
        return false;
      }
    }
    return true;
  }

  /**
   * Calculates the distance to another vertex's position.
   * @param other - The other vertex.
   * @returns The distance between this vertex's position and the other vertex's position.
   */
  distanceTo(other: Vertex): number {
    return this.position.distanceTo(other.position);
  }

  /**
   * Checks if this vertex has UV coordinates defined.
   * @returns True if UV coordinates are set, false otherwise.
   */
  hasUV(): boolean {
    return this.uv !== null && this.uv !== undefined;
  }

  /**
   * Resets the global ID counter for Vertex instances.
   * Useful for testing or specific scenarios requiring ID reset.
   * Use with caution.
   */
  static resetIdCounter(): void {
    Vertex.nextId = 0;
  }

  toString(): string {
    let str = `Vertex(${this.id}, P: ${this.position.toString()})`;
    if (this.normal) str += `, N: ${this.normal.toString()}`;
    if (this.uv) str += `, UV: (${this.uv.u.toFixed(3)}, ${this.uv.v.toFixed(3)})`;
    return str;
  }

  /**
   * Serializes the Vertex instance to a JSON object.
   * Does not serialize `edges` or `faces` sets, as these are contextual to a Mesh.
   * @returns A JSON representation of the vertex.
   */
  toJSON(): {
    id: number;
    position: [number, number, number];
    normal: [number, number, number] | null;
    uv: { u: number; v: number } | null;
    metadata: Record<string, any>;
  } {
    return {
      id: this.id,
      position: this.position.toArray(),
      normal: this.normal ? this.normal.toArray() : null,
      uv: this.uv ? { u: this.uv.u, v: this.uv.v } : null,
      metadata: this.metadata,
    };
  }

  /**
   * Creates a Vertex instance from a JSON object.
   * @param jsonData - The JSON object representing a vertex.
   * @returns A new Vertex instance.
   */
  static fromJSON(jsonData: {
    id: number;
    position: number[];
    normal?: number[] | null;
    uv?: { u: number; v: number } | null;
    metadata?: Record<string, any>;
  }): Vertex {
    const vertex = new Vertex(jsonData.position[0], jsonData.position[1], jsonData.position[2]);
    vertex.id = jsonData.id; // Assign the ID from JSON
    Vertex.nextId = Math.max(Vertex.nextId, jsonData.id + 1); // Ensure nextId is ahead

    if (jsonData.normal) {
      vertex.normal = Vector3D.fromArray(jsonData.normal);
    }
    if (jsonData.uv) {
      vertex.uv = { u: jsonData.uv.u, v: jsonData.uv.v };
    }

    vertex.metadata = jsonData.metadata ? JSON.parse(JSON.stringify(jsonData.metadata)) : {}; // Deep copy metadata
    return vertex;
  }

}
