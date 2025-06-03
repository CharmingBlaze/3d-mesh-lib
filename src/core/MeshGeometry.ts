import { Vector3D } from '@/utils/Vector3D';
import { Vertex } from './Vertex';
import { Edge } from './Edge';
import { Face } from './Face';
import { Material, MaterialOptions } from './Material';

/**
 * Handles geometric operations for mesh data including vertices, edges, faces, and materials.
 * This class manages the core geometric relationships and topology of a mesh.
 */
export class MeshGeometry {
  public vertices: Map<number, Vertex> = new Map();
  public edges: Map<string, Edge> = new Map(); // Keyed by Edge.getKey(v0.id, v1.id)
  public faces: Map<number, Face> = new Map();
  public materials: Map<number, Material> = new Map();

  /**
   * Adds a new vertex to the mesh.
   * @param x - The x-coordinate of the vertex.
   * @param y - The y-coordinate of the vertex.
   * @param z - The z-coordinate of the vertex.
   * @param normal - Optional normal vector.
   * @param uv - Optional UV coordinates.
   * @returns The newly created Vertex instance.
   */
  addVertex(x: number, y: number, z: number, normal?: Vector3D, uv?: { u: number; v: number }): Vertex {
    const vertex = new Vertex(x, y, z, normal, uv);
    this.vertices.set(vertex.id, vertex);
    return vertex;
  }

  /**
   * Retrieves a vertex by its ID.
   * @param vertexId - The ID of the vertex.
   * @returns The Vertex instance, or undefined if not found.
   */
  getVertex(vertexId: number): Vertex | undefined {
    return this.vertices.get(vertexId);
  }

  /**
   * Adds a new face to the mesh, defined by a list of vertex IDs.
   * Vertices must already exist in the mesh.
   * Edges will be automatically created or reused.
   * @param vertexIds - An ordered array of vertex IDs forming the face.
   * @param materialId - Optional ID of the material for this face.
   * @returns The newly created Face instance.
   * @throws Error if any vertex ID is invalid or if less than 3 vertices are provided.
   */
  addFace(vertexIds: number[], materialId?: number): Face {
    if (vertexIds.length < 3) {
      throw new Error('Face requires at least 3 vertices.');
    }

    const faceVertices: Vertex[] = [];
    for (const id of vertexIds) {
      const vertex = this.vertices.get(id);
      if (!vertex) {
        throw new Error(`Vertex with ID ${id} not found in mesh.`);
      }
      faceVertices.push(vertex);
    }

    const face = new Face(faceVertices, materialId);
    this.faces.set(face.id, face);

    // Create/update edges and link them
    for (let i = 0; i < faceVertices.length; i++) {
      const v0 = faceVertices[i];
      const v1 = faceVertices[(i + 1) % faceVertices.length];
      
      const edgeKey = Edge.getKey(v0.id, v1.id);
      let edge = this.edges.get(edgeKey);

      if (!edge) {
        edge = new Edge(v0, v1);
        this.edges.set(edgeKey, edge);
        v0.edges.add(edge.key); // Store edge key
        v1.edges.add(edge.key); // Store edge key
      }
      
      edge.faces.add(face.id);
      face.edges.push(edge); // Store edge reference in face
      v0.faces.add(face.id);
    }

    return face;
  }

  /**
   * Retrieves a face by its ID.
   * @param faceId - The ID of the face.
   * @returns The Face instance, or undefined if not found.
   */
  getFace(faceId: number): Face | undefined {
    return this.faces.get(faceId);
  }

  /**
   * Retrieves an edge by the IDs of its two vertices.
   * @param v0Id - ID of the first vertex.
   * @param v1Id - ID of the second vertex.
   * @returns The Edge instance, or undefined if not found.
   */
  getEdge(v0Id: number, v1Id: number): Edge | undefined {
    return this.edges.get(Edge.getKey(v0Id, v1Id));
  }

  /**
   * Adds a material to the mesh.
   * @param name - Name of the material.
   * @param options - Options for the material properties.
   * @returns The newly created Material instance.
   */
  addMaterial(name: string, options?: Partial<MaterialOptions>): Material {
    const material = new Material(name, options);
    this.materials.set(material.id, material);
    return material;
  }

  /**
   * Retrieves a material by its ID.
   * @param materialId - The ID of the material.
   * @returns The Material instance, or undefined if not found.
   */
  getMaterial(materialId: number): Material | undefined {
    return this.materials.get(materialId);
  }

  /**
   * Adds an edge to the mesh geometry, connecting two existing vertices.
   * If an edge between these vertices already exists, the existing edge is returned.
   * This method updates vertex-to-edge connectivity but does not associate the edge with faces.
   * @param v0 - The first vertex of the edge.
   * @param v1 - The second vertex of the edge.
   * @returns The newly created or existing Edge instance.
   * @throws Error if v0 or v1 are not part of this geometry (though type system implies they are Vertex instances).
   */
  addEdge(v0: Vertex, v1: Vertex): Edge {
    if (!this.vertices.has(v0.id) || !this.vertices.has(v1.id)) {
      // This check is more for runtime integrity if vertices could somehow be detached
      // from the geometry but still passed in. Given they are Vertex instances,
      // they should ideally always be part of some geometry context if obtained correctly.
      throw new Error('Vertices must exist in the mesh geometry to add an edge.');
    }
    if (v0.id === v1.id) {
      throw new Error('Edge vertices cannot be the same.');
    }

    const edgeKey = Edge.getKey(v0.id, v1.id);
    let edge = this.edges.get(edgeKey);

    if (!edge) {
      edge = new Edge(v0, v1); // Edge constructor handles canonical ordering of v0, v1
      this.edges.set(edgeKey, edge);
      v0.edges.add(edgeKey); // Add edge key to vertex's set of edges
      v1.edges.add(edgeKey);
    } else {
      // Edge already exists, ensure vertex connectivity is up-to-date (should be, but good practice)
      if (!v0.edges.has(edgeKey)) v0.edges.add(edgeKey);
      if (!v1.edges.has(edgeKey)) v1.edges.add(edgeKey);
    }
    return edge;
  }

  /**
   * Removes a vertex from the mesh along with all incident edges and faces.
   * @param vertexId - The ID of the vertex to remove.
   * @returns True if the vertex was found and removed, false otherwise.
   */
  removeVertex(vertexId: number): boolean {
    const vertex = this.vertices.get(vertexId);
    if (!vertex) return false;

    // Collect all faces and edge keys associated with this vertex.
    // Iterate over copies as the original sets will be modified during removal.
    const facesToRemove = Array.from(vertex.faces);
    const edgeKeysToRemove = Array.from(vertex.edges);

    // Remove all faces connected to this vertex.
    // removeFace will call removeEdgeByKey for edges that become orphaned,
    // which in turn will update the .edges set of the other vertex of that edge.
    facesToRemove.forEach(faceId => {
      this.removeFace(faceId); 
    });

    // After faces are removed, some edges might still be connected to this vertex
    // (e.g., if they were not part of any face or part of faces not involving this vertex somehow, though less likely).
    // All edges incident to the vertex being removed must be removed.
    // The `vertex.edges` set should have been modified by `removeEdgeByKey` calls during `removeFace`.
    // Iterating the original `edgeKeysToRemove` list ensures all originally incident edges are processed.
    edgeKeysToRemove.forEach(edgeKey => {
      // Check if the edge still exists in the mesh; it might have been removed by removeFace.
      if (this.edges.has(edgeKey)) {
        this.removeEdgeByKey(edgeKey);
      }
    });
    
    // Finally, remove the vertex itself.
    this.vertices.delete(vertexId);
    return true;
  }

  /**
   * Removes an edge from the mesh. This might also remove faces that depend on this edge.
   * It's generally safer to remove faces, which then handle their edges.
   * @param v0Id - ID of the first vertex of the edge.
   * @param v1Id - ID of the second vertex of the edge.
   * @returns True if the edge was found and removed, false otherwise.
   */
  removeEdge(v0Id: number, v1Id: number): boolean {
    const edgeKey = Edge.getKey(v0Id, v1Id);
    return this.removeEdgeByKey(edgeKey);
  }

  /**
   * Removes an edge by its key.
   * @param edgeKey - The key of the edge to remove.
   * @returns True if the edge was found and removed, false otherwise.
   */
  private removeEdgeByKey(edgeKey: string): boolean {
    const edge = this.edges.get(edgeKey);
    if (!edge) return false;

    // Remove edge reference (key) from its vertices
    edge.v0.edges.delete(edge.key);
    edge.v1.edges.delete(edge.key);

    // Remove the edge from the 'edges' array of each face that used it.
    // The faces themselves are not deleted here.
    for (const faceId of Array.from(edge.faces)) {
      const face = this.faces.get(faceId);
      if (face) {
        // Filter out the edge to be removed from the face's edge list.
        face.edges = face.edges.filter(e => e.key !== edgeKey);
        // Also, ensure the edge no longer references this face.
        // This is already handled by edge.faces being cleared or not used by new edge instances,
        // but if we were re-using the edge instance, we'd do: edge.faces.delete(faceId);
      }
    }

    this.edges.delete(edgeKey);
    return true;
  }

  /**
   * Removes a face from the mesh.
   * This also updates the edges that were part of this face.
   * Edges that are no longer part of any face might be removed (orphaned edges).
   * @param faceId - The ID of the face to remove.
   * @returns True if the face was found and removed, false otherwise.
   */
  removeFace(faceId: number): boolean {
    const face = this.faces.get(faceId);
    if (!face) return false;

    // Remove face reference from its vertices
    face.vertices.forEach(vertex => {
      vertex.faces.delete(faceId);
    });

    // Remove face reference from its edges
    // If an edge is only used by this face, remove the edge as well
    face.edges.forEach(edge => {
      edge.faces.delete(faceId);
      if (edge.faces.size === 0) {
        // Edge is orphaned, remove it
        this.removeEdgeByKey(edge.key); 
      }
    });

    this.faces.delete(faceId);
    return true;
  }

  /**
   * Clears all data from the mesh (vertices, edges, faces, materials).
   */
  clear(): void {
    this.vertices.clear();
    this.edges.clear();
    this.faces.clear();
    this.materials.clear();
  }

  /**
   * Array accessors for easier iteration.
   */
  get vertexArray(): Vertex[] {
    return Array.from(this.vertices.values());
  }

  get edgeArray(): Edge[] {
    return Array.from(this.edges.values());
  }

  get faceArray(): Face[] {
    return Array.from(this.faces.values());
  }

  get materialArray(): Material[] {
    return Array.from(this.materials.values());
  }
} 