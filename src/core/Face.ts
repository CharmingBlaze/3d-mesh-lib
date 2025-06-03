import { Vertex } from './Vertex';
import { Edge } from './Edge';
import { Vector3D } from '@/utils/Vector3D';

/**
 * Represents a face (polygon) in a 3D mesh.
 * A face is defined by an ordered list of vertices.
 * It can optionally store a normal vector and material index.
 */
export class Face {
  private static nextId = 0;
  public id: number;
  public vertices: Vertex[]; // Ordered list of vertices defining the face
  public edges: Edge[] = []; // Optional: Edges forming this face (can be derived)
  public normal: Vector3D | null = null;
  public materialIndex: number | null = null;
  public metadata: Record<string, any> = {};

  /**
   * Creates a new Face instance.
   * @param vertices - An array of Vertex instances defining the face. Must be at least 3.
   * @param materialIndex - Optional index of the material applied to this face.
   * @throws Error if less than 3 vertices are provided.
   */
  constructor(vertices: Vertex[], materialIndex?: number) {
    if (vertices.length < 3) {
      throw new Error('A face must have at least 3 vertices.');
    }
    this.id = Face.nextId++;
    this.vertices = [...vertices]; // Store a copy

    if (materialIndex !== undefined) {
      this.materialIndex = materialIndex;
    }

    // Calculate and store the normal upon creation
    this.normal = this.calculateNormal();
  }

  /**
   * Calculates the geometric normal of the face using the Newell method for robustness with non-planar polygons.
   * Assumes vertices are ordered counter-clockwise for a front-facing normal.
   * The calculated normal is stored in `this.normal` and also returned.
   * @returns The calculated normal vector, or null if calculation fails (e.g., collinear vertices).
   */
  calculateNormal(): Vector3D | null {
    if (this.vertices.length < 3) {
      return null;
    }

    const normal = new Vector3D(0, 0, 0);
    for (let i = 0; i < this.vertices.length; i++) {
      const currentVertex = this.vertices[i].position;
      const nextVertex = this.vertices[(i + 1) % this.vertices.length].position;

      normal.x += (currentVertex.y - nextVertex.y) * (currentVertex.z + nextVertex.z);
      normal.y += (currentVertex.z - nextVertex.z) * (currentVertex.x + nextVertex.x);
      normal.z += (currentVertex.x - nextVertex.x) * (currentVertex.y + nextVertex.y);
    }

    if (normal.lengthSq() < 1e-12) { // Use a small epsilon for floating point comparison
        // Degenerate face (e.g. all vertices collinear, or zero area)
        this.normal = null;
        return null;
    }

    this.normal = normal.normalize();
    return this.normal.clone();
  }

  /**
   * Reverses the order of vertices, effectively flipping the face normal.
   */
  flip(): void {
    this.vertices.reverse();
    if (this.normal) {
      this.normal.negate();
    }
    // Edges might also need to be re-evaluated or their directionality considered
    // if they store orientation relative to the face.
  }

  /**
   * Checks if the face is a triangle.
   * @returns True if the face has 3 vertices, false otherwise.
   */
  isTriangle(): boolean {
    return this.vertices.length === 3;
  }

  /**
   * Checks if the face is a quadrilateral.
   * @returns True if the face has 4 vertices, false otherwise.
   */
  isQuad(): boolean {
    return this.vertices.length === 4;
  }

  /**
   * Resets the global ID counter for Face instances.
   * Useful for testing or specific scenarios requiring ID reset.
   * CAUTION: Use with extreme care, especially if meshes are being loaded/saved.
   * Resetting IDs can lead to collisions if not managed properly across serialization boundaries.
   * Consider manual ID assignment or `Face.nextId = newHighestId` after loading a mesh.
   */
  static resetIdCounter(): void {
    Face.nextId = 0;
  }

  toString(): string {
    const vertexIds = this.vertices.map(v => v.id).join(', ');
    return `Face(${this.id}, Vertices: [${vertexIds}], Normal: ${this.normal ? this.normal.toString() : 'null'})`;
  }

  /**
   * Updates the `edges` array for this face.
   * If an `edgeMap` is provided, existing edges are reused; otherwise, new Edge instances are created.
   * This method also updates the `faces` set on each edge to include this face.
   * @param edgeMap - Optional map of canonical edge keys to Edge instances for reusing existing edges.
   */
  updateEdges(edgeMap?: Map<string, Edge>): void {
    this.edges = [];
    if (this.vertices.length < 2) return; // Cannot form edges

    for (let i = 0; i < this.vertices.length; i++) {
      const v0 = this.vertices[i];
      const v1 = this.vertices[(i + 1) % this.vertices.length];
      let edge: Edge;

      if (edgeMap) {
        const key = Edge.getKey(v0.id, v1.id);
        const existingEdge = edgeMap.get(key);
        if (existingEdge) {
          edge = existingEdge;
        } else {
          edge = new Edge(v0, v1);
          edgeMap.set(key, edge); // Add new edge to map if it's being managed externally
        }
      } else {
        // If no map, always create new edges. This might lead to duplicate Edge objects
        // if not managed carefully by a higher-level structure (e.g., Mesh).
        edge = new Edge(v0, v1);
      }
      this.edges.push(edge);
      edge.faces.add(this.id); // Ensure this face is associated with the edge
    }
  }

  /**
   * Checks if a given vertex is part of this face.
   * @param vertex - The Vertex to check.
   * @returns True if the vertex is one of the face's vertices, false otherwise.
   */
  hasVertex(vertex: Vertex): boolean {
    return this.vertices.some(v => v.id === vertex.id);
  }

  /**
   * Returns the vertices of the face's edges as an array of [Vertex, Vertex] pairs.
   * This is useful if direct Edge objects are not being stored or are needed in this format.
   * @returns An array of [Vertex, Vertex] pairs.
   */
  getEdgeVertexPairs(): [Vertex, Vertex][] {
    const pairs: [Vertex, Vertex][] = [];
    if (this.vertices.length < 2) return pairs;

    for (let i = 0; i < this.vertices.length; i++) {
      pairs.push([
        this.vertices[i],
        this.vertices[(i + 1) % this.vertices.length],
      ]);
    }
    return pairs;
  }

  /**
   * Creates a shallow clone of this face.
   * Vertex instances can be remapped using an optional `vertexMap` or copied by reference.
   * The normal is cloned if it exists. The new face gets a new ID.
   * @param vertexMap - Optional map to get Vertex instances for the new face, typically used when cloning a whole mesh.
   * @returns A new Face instance.
   */
  clone(vertexMap?: Map<number, Vertex>): Face {
    const newVertices = this.vertices.map(v_1 => {
      if (vertexMap) {
        const mappedVertex = vertexMap.get(v_1.id);
        if (!mappedVertex) {
          throw new Error(`Face.clone: Vertex with ID ${v_1.id} not found in provided vertexMap.`);
        }
        return mappedVertex;
      }
      return v_1; // Copy by reference if no map provided
    });

    const newFace = new Face(newVertices, this.materialIndex ?? undefined);
    // The constructor will attempt to calculate the normal. 
    // If the original normal was null (e.g. degenerate), it will remain null.
    // If it was explicitly set or calculated, the new face's normal will be based on newVertices.
    // For a more direct clone of the normal value itself:
    newFace.normal = this.normal ? this.normal.clone() : null;
    // Edges are not cloned directly, they are typically reconstructed by the Mesh.
    newFace.metadata = JSON.parse(JSON.stringify(this.metadata)); // Deep copy metadata
    return newFace;
  }

  /**
   * Serializes the Face instance to a JSON object.
   * @returns A JSON representation of the face.
   */
  toJSON(): {
    id: number;
    vertexIds: number[];
    materialIndex: number | null;
    normal: [number, number, number] | null;
    metadata: Record<string, any>;
    // edges are not serialized, they are derived
  } {
    return {
      id: this.id,
      vertexIds: this.vertices.map(v => v.id),
      materialIndex: this.materialIndex,
      normal: this.normal ? this.normal.toArray() : null,
      metadata: this.metadata,
    };
  }

  /**
   * Creates a Face instance from a JSON object.
   * @param jsonData - The JSON object representing a face.
   * @param vertexMap - A map of vertex IDs to Vertex instances, used to link the face to its vertices.
   * @returns A new Face instance.
   * @throws Error if vertex IDs are not found in vertexMap or if less than 3 vertices are specified.
   */
  static fromJSON(
    jsonData: {
      id: number;
      vertexIds: number[];
      materialIndex: number | null;
      normal?: [number, number, number] | null;
      metadata?: Record<string, any>;
    },
    vertexMap: Map<number, Vertex>
  ): Face {
    if (jsonData.vertexIds.length < 3) {
      throw new Error(
        `Face.fromJSON: Face ID ${jsonData.id} must have at least 3 vertices.`
      );
    }
    const vertices: Vertex[] = jsonData.vertexIds.map((id: number): Vertex => {
      const vertex = vertexMap.get(id);
      if (!vertex) {
        throw new Error(
          `Face.fromJSON: Vertex with ID ${id} not found in vertexMap for Face ID ${jsonData.id}.`
        );
      }
      return vertex;
    });

    const face: Face = new Face(vertices, jsonData.materialIndex ?? undefined);
    face.id = jsonData.id; // Override the ID assigned by the constructor

    // Restore normal if provided, otherwise it would have been calculated by constructor
    if (jsonData.normal !== undefined) {
      face.normal = jsonData.normal ? Vector3D.fromArray(jsonData.normal) : null;
    }
    // If jsonData.normal is undefined, the constructor's calculation of normal is used.

    face.metadata = jsonData.metadata ? JSON.parse(JSON.stringify(jsonData.metadata)) : {}; // Deep copy metadata

    Face.nextId = Math.max(Face.nextId, jsonData.id + 1); // Ensure nextId is ahead
    return face;
  }
}
