import { Vertex } from './Vertex';

/**
 * Represents an edge in a 3D mesh, connecting two vertices.
 * Each edge has a unique ID and references its start and end vertices.
 */
export class Edge {
  private static nextId = 0;
  public id: number;
  public readonly v0: Vertex; // Start vertex of the edge
  public readonly v1: Vertex; // End vertex of the edge

  // For linking to other mesh components (e.g., faces)
  // These are typically managed by the Mesh class
  public faces: Set<number> = new Set(); // Stores Face IDs that use this edge
  public metadata: Record<string, any> = {}; // Extensible metadata

  /**
   * Creates a new Edge instance.
   * The order of v0 and v1 can matter for some algorithms (e.g., winged-edge).
   * For simplicity, we can enforce a canonical representation (e.g., v0.id < v1.id)
   * if needed later, but for now, the provided order is kept.
   * @param v0 - The first vertex of the edge.
   * @param v1 - The second vertex of the edge.
   * @throws Error if v0 and v1 are the same vertex.
   */
  constructor(v0: Vertex, v1: Vertex) {
    if (v0.id === v1.id) {
      throw new Error('Edge vertices cannot be the same.');
    }
    this.id = Edge.nextId++;
    // Ensure consistent ordering for easier lookup if v0 and v1 are swapped
    // This helps in identifying unique edges regardless of creation order.
    if (v0.id < v1.id) {
        this.v0 = v0;
        this.v1 = v1;
    } else {
        this.v0 = v1;
        this.v1 = v0;
    }
  }

  /**
   * Creates a unique key for the edge based on its vertex IDs.
   * This is useful for storing edges in a Map or Set to ensure uniqueness.
   * The key is canonical, meaning Edge(vA, vB) and Edge(vB, vA) produce the same key.
   * @param v0Id - ID of the first vertex.
   * @param v1Id - ID of the second vertex.
   * @returns A string key representing the edge.
   */
  static getKey(v0Id: number, v1Id: number): string {
    return v0Id < v1Id ? `${v0Id}-${v1Id}` : `${v1Id}-${v0Id}`;
  }

  /**
   * Gets the unique key for this edge instance.
   * @returns A string key representing this edge.
   */
  get key(): string {
    return Edge.getKey(this.v0.id, this.v1.id);
  }

  /**
   * Checks if this edge is equal to another edge.
   * Two edges are considered equal if they connect the same two vertices,
   * regardless of the order of v0 and v1 during construction.
   * @param other - The edge to compare with.
   * @returns True if the edges connect the same vertices, false otherwise.
   */
  equals(other: Edge): boolean {
    return this.key === other.key;
  }

  /**
   * Returns the other vertex of the edge given one vertex.
   * @param vertex - One of the vertices of the edge.
   * @returns The other vertex, or null if the given vertex is not part of this edge.
   */
  getOtherVertex(vertex: Vertex): Vertex | null {
    if (vertex.id === this.v0.id) {
      return this.v1;
    }
    if (vertex.id === this.v1.id) {
      return this.v0;
    }
    return null;
  }

  /**
   * Resets the global ID counter for Edge instances.
   * Useful for testing or specific scenarios requiring ID reset.
   * Use with caution.
   */
  /**
   * Resets the global ID counter for Edge instances.
   * Useful for testing or specific scenarios requiring ID reset.
   * CAUTION: Use with extreme care, especially if meshes are being loaded/saved.
   * Resetting IDs can lead to collisions if not managed properly across serialization boundaries.
   * Consider manual ID assignment or `Edge.nextId = newHighestId` after loading a mesh.
   */
  static resetIdCounter(): void {
    Edge.nextId = 0;
  }

  toString(): string {
    return `Edge(${this.id}, V: ${this.v0.id}-${this.v1.id}, Faces: [${Array.from(this.faces).join(', ')}])`;
  }

  /**
   * Checks if a given vertex is one of the endpoints of this edge.
   * @param vertex - The vertex to check.
   * @returns True if the vertex is part of this edge, false otherwise.
   */
  hasVertex(vertex: Vertex): boolean {
    return vertex.id === this.v0.id || vertex.id === this.v1.id;
  }

  /**
   * Creates a shallow clone of this edge.
   * The new edge will reference the same Vertex instances but will have its own ID and faces set.
   * Note: This is a shallow clone regarding vertices. The face IDs are copied.
   * @returns A new Edge instance.
   */
  clone(): Edge {
    // The constructor handles canonical ordering of v0 and v1.
    const newEdge = new Edge(this.v0, this.v1);
    // Manually assign the ID of the cloned edge to be the same as the original for a true clone.
    // This requires Edge.nextId to be managed carefully if mixing cloned edges with new edges.
    // For simplicity in typical cloning scenarios, we might let it get a new ID, 
    // or provide a mechanism to clone with the same ID if that's a strict requirement.
    // For now, let's assume a clone means a new object with copied properties but a new ID.
    // If preserving ID is critical, `fromJSON` pattern might be more suitable or a dedicated `cloneWithId`.
    // However, a typical clone operation implies a new distinct object.
    // Let's re-evaluate: for a core library, a clone should be a new object that is a copy.
    // If it's added to a mesh, the mesh would typically assign a new ID or handle ID conflicts.
    // For a standalone clone, copying the ID might be misleading if `nextId` isn't managed.
    // Let's stick to the Edge constructor assigning a new ID for clones by default.
    // The `faces` set is copied.
    newEdge.faces = new Set(this.faces);
    newEdge.metadata = JSON.parse(JSON.stringify(this.metadata)); // Deep copy metadata
    // If we wanted to preserve the ID, we'd do: newEdge.id = this.id; and then manage Edge.nextId.
    // But this makes `id` not readonly. A better approach for ID preservation is via `fromJSON`.
    return newEdge; // This will have a new ID by default from Edge.nextId++
  }

  /**
   * Serializes the Edge instance to a JSON object.
   * @returns A JSON representation of the edge.
   */
  toJSON(): {
    id: number;
    v0: number; // Vertex ID
    v1: number; // Vertex ID
    faces: number[];
    metadata: Record<string, any>;
  } {
    return {
      id: this.id,
      v0: this.v0.id,
      v1: this.v1.id,
      faces: Array.from(this.faces),
      metadata: this.metadata,
    };
  }

  /**
   * Creates an Edge instance from a JSON object.
   * @param json - The JSON object representing an edge.
   * @param vertexMap - A map of vertex IDs to Vertex instances, used to link the edge to its vertices.
   * @returns A new Edge instance.
   * @throws Error if vertices are not found in vertexMap.
   */
  static fromJSON(json: { id: number; v0: number; v1: number; faces: number[]; metadata?: Record<string, any> }, vertexMap: Map<number, Vertex>): Edge {
    const v0 = vertexMap.get(json.v0);
    const v1 = vertexMap.get(json.v1);

    if (!v0 || !v1) {
      throw new Error(`Cannot create edge from JSON: Vertex ID ${!v0 ? json.v0 : json.v1} not found in vertexMap.`);
    }

    const edge = new Edge(v0, v1); // Constructor handles canonical ordering and assigns a new ID initially
    edge.id = json.id; // Override the ID with the one from JSON
    edge.faces = new Set(json.faces);
    edge.metadata = json.metadata ? JSON.parse(JSON.stringify(json.metadata)) : {}; // Deep copy metadata

    // Ensure nextId is updated to avoid collisions if loading multiple objects
    // or mixing loaded objects with newly created ones.
    if (json.id >= Edge.nextId) {
      Edge.nextId = json.id + 1;
    }
    return edge;
  }
}
