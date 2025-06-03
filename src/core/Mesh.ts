import { Vector3D } from '@/utils/Vector3D';
import { Vertex } from './Vertex';
import { Edge } from './Edge';
import { Face } from './Face';
import { Material, MaterialOptions } from './Material';
import { MeshGeometry } from './MeshGeometry';
import { MeshOperations } from './MeshOperations';
import { MeshAnalysis } from './MeshAnalysis';
import { MeshSerialization } from './MeshSerialization';

/**
 * Represents a 3D mesh, composed of vertices, edges, faces, and materials.
 * This is the central class for managing and manipulating 3D model data.
 * 
 * The Mesh class now uses composition with specialized components:
 * - MeshGeometry: Handles basic geometry operations
 * - MeshOperations: Handles complex operations like welding and validation
 * - MeshAnalysis: Handles analytical calculations
 * - MeshSerialization: Handles JSON import/export
 */
export class Mesh {
  private static nextId = 0;
  public id: number;
  public name: string;

  // Core geometry data
  private geometry: MeshGeometry;

  // Bounding box for quick spatial queries
  public boundingBoxMin: Vector3D | null = null;
  public boundingBoxMax: Vector3D | null = null;
  public metadata: Record<string, any> = {}; // Extensible metadata

  /**
   * Creates a new Mesh instance.
   * @param name - An optional name for the mesh.
   */
  constructor(name: string = 'UntitledMesh') {
    this.id = Mesh.nextId++;
    this.name = name;
    this.geometry = new MeshGeometry();
  }

  // Delegated geometry operations
  
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
    const vertex = this.geometry.addVertex(x, y, z, normal, uv);
    this.computeBoundingBox();
    return vertex;
  }

  /**
   * Retrieves a vertex by its ID.
   * @param vertexId - The ID of the vertex.
   * @returns The Vertex instance, or undefined if not found.
   */
  getVertex(vertexId: number): Vertex | undefined {
    return this.geometry.getVertex(vertexId);
  }

  /**
   * Adds a new face to the mesh, defined by a list of vertex IDs.
   * @param vertexIds - An ordered array of vertex IDs forming the face.
   * @param materialId - Optional ID of the material for this face.
   * @returns The newly created Face instance.
   */
  addFace(vertexIds: number[], materialId?: number): Face {
    const face = this.geometry.addFace(vertexIds, materialId);
    this.computeBoundingBox();
    return face;
  }

  /**
   * Retrieves a face by its ID.
   * @param faceId - The ID of the face.
   * @returns The Face instance, or undefined if not found.
   */
  getFace(faceId: number): Face | undefined {
    return this.geometry.getFace(faceId);
  }

  /**
   * Retrieves an edge by the IDs of its two vertices.
   * @param v0Id - ID of the first vertex.
   * @param v1Id - ID of the second vertex.
   * @returns The Edge instance, or undefined if not found.
   */
  getEdge(v0Id: number, v1Id: number): Edge | undefined {
    return this.geometry.getEdge(v0Id, v1Id);
  }

  /**
   * Adds an edge to the mesh, connecting two existing vertices by their IDs.
   * If an edge between these vertices already exists, the existing edge is returned.
   * This method updates vertex-to-edge connectivity but does not associate the edge with faces.
   * Face-edge connectivity should be updated separately if needed (e.g., via Face.updateEdges).
   * @param v0Id - The ID of the first vertex.
   * @param v1Id - The ID of the second vertex.
   * @returns The newly created or existing Edge instance, or undefined if either vertex is not found.
   */
  addEdge(v0Id: number, v1Id: number): Edge | undefined {
    const v0 = this.getVertex(v0Id);
    const v1 = this.getVertex(v1Id);
    if (!v0 || !v1) {
      console.warn(`Mesh.addEdge: Vertex with ID ${v0Id} or ${v1Id} not found.`);
      return undefined;
    }
    // MeshGeometry.addEdge will throw if v0.id === v1.id or if vertices are not in its map (though our getVertex check covers this)
    try {
      const edge = this.geometry.addEdge(v0, v1);
      this.computeBoundingBox(); // Edge addition can change bounds if it's a new outermost edge
      return edge;
    } catch (error) {
      console.error(`Mesh.addEdge: Failed to add edge between ${v0Id} and ${v1Id}.`, error);
      return undefined;
    }
  }

  /**
   * Adds a material to the mesh.
   * @param name - Name of the material.
   * @param options - Options for the material properties.
   * @returns The newly created Material instance.
   */
  addMaterial(name: string, options?: Partial<MaterialOptions>): Material {
    return this.geometry.addMaterial(name, options);
  }

  /**
   * Retrieves a material by its ID.
   * @param materialId - The ID of the material.
   * @returns The Material instance, or undefined if not found.
   */
  getMaterial(materialId: number): Material | undefined {
    return this.geometry.getMaterial(materialId);
  }

  /**
   * Removes a vertex from the mesh along with all incident edges and faces.
   * @param vertexId - The ID of the vertex to remove.
   * @returns True if the vertex was found and removed, false otherwise.
   */
  removeVertex(vertexId: number): boolean {
    const result = this.geometry.removeVertex(vertexId);
    if (result) {
      this.computeBoundingBox();
    }
    return result;
  }

  /**
   * Removes an edge from the mesh.
   * @param v0Id - ID of the first vertex of the edge.
   * @param v1Id - ID of the second vertex of the edge.
   * @returns True if the edge was found and removed, false otherwise.
   */
  removeEdge(v0Id: number, v1Id: number): boolean {
    return this.geometry.removeEdge(v0Id, v1Id);
  }

  /**
   * Removes a face from the mesh.
   * @param faceId - The ID of the face to remove.
   * @returns True if the face was found and removed, false otherwise.
   */
  removeFace(faceId: number): boolean {
    return this.geometry.removeFace(faceId);
  }

  /**
   * Clears all data from the mesh.
   */
  clear(): void {
    this.geometry.clear();
    this.boundingBoxMin = null;
    this.boundingBoxMax = null;
    this.metadata = {};
  }

  // Direct access to geometry collections
  get vertices(): Map<number, Vertex> {
    return this.geometry.vertices;
  }

  get edges(): Map<string, Edge> {
    return this.geometry.edges;
  }

  get faces(): Map<number, Face> {
    return this.geometry.faces;
  }

  get materials(): Map<number, Material> {
    return this.geometry.materials;
  }

  // Array accessors
  get vertexArray(): Vertex[] {
    return this.geometry.vertexArray;
  }

  get edgeArray(): Edge[] {
    return this.geometry.edgeArray;
  }

  get faceArray(): Face[] {
    return this.geometry.faceArray;
  }

  get materialArray(): Material[] {
    return this.geometry.materialArray;
  }

  // Delegated operations

  /**
   * Welds vertices that are closer than a given tolerance.
   * @param tolerance - The maximum distance between vertices to be considered coincident.
   * @returns The number of vertices welded.
   */
  weldVertices(tolerance: number = 1e-6): number {
    const result = MeshOperations.weldVertices(this.geometry, tolerance);
    if (result > 0) {
      this.computeBoundingBox();
    }
    return result;
  }

  /**
   * Intelligently unwraps UV coordinates for the mesh using angle-based projection.
   * This method automatically determines the best projection axis based on face normals
   * and creates UV coordinates that minimize distortion.
   * 
   * @param options - Optional parameters for UV unwrapping.
   * @returns Number of vertices that received UV coordinates.
   */
  smartUnwrapUVs(options: {
    scaleUVs?: number;
    offsetU?: number;
    offsetV?: number;
    normalizeToUnitSquare?: boolean;
    preferredAxis?: 'x' | 'y' | 'z' | 'auto';
  } = {}): number {
    return MeshOperations.smartUnwrapUVs(this.geometry, options);
  }

  /**
   * Validates the mesh for common issues.
   * @returns An array of strings describing validation issues found.
   */
  validate(): string[] {
    return MeshOperations.validate(this.geometry);
  }

  /**
   * Removes degenerate faces from the mesh.
   * @returns The number of degenerate faces removed.
   */
  removeDegenerateFaces(): number {
    return MeshOperations.removeDegenerateFaces(this.geometry);
  }

  /**
   * Removes orphaned edges from the mesh.
   * @returns The number of orphaned edges removed.
   */
  removeOrphanedEdges(): number {
    return MeshOperations.removeOrphanedEdges(this.geometry);
  }

  /**
   * Removes orphaned vertices from the mesh.
   * @returns The number of orphaned vertices removed.
   */
  removeOrphanedVertices(): number {
    return MeshOperations.removeOrphanedVertices(this.geometry);
  }

  /**
   * Cleans up material indices by removing references to non-existent materials.
   * @returns The number of invalid material references cleaned.
   */
  cleanMaterialIndices(): number {
    return MeshOperations.cleanMaterialIndices(this.geometry);
  }

  /**
   * Creates a deep clone of this mesh.
   * @returns A new Mesh instance that is a clone of this one.
   */
  clone(): Mesh {
    const newMesh = new Mesh(this.name + '_copy');
    newMesh.geometry = MeshOperations.clone(this.geometry);
    newMesh.metadata = JSON.parse(JSON.stringify(this.metadata));
    newMesh.computeBoundingBox();
    return newMesh;
  }

  // Delegated analysis operations

  /**
   * Computes the axis-aligned bounding box for the mesh.
   */
  computeBoundingBox(): void {
    const boundingBox = MeshAnalysis.computeBoundingBox(this.geometry);
    if (boundingBox) {
      this.boundingBoxMin = boundingBox.min;
      this.boundingBoxMax = boundingBox.max;
    } else {
      this.boundingBoxMin = null;
      this.boundingBoxMax = null;
    }
  }

  /**
   * Calculates the total surface area of the mesh.
   * @returns The total surface area.
   */
  calculateSurfaceArea(): number {
    return MeshAnalysis.calculateSurfaceArea(this.geometry);
  }

  /**
   * Calculates the volume of the mesh.
   * @returns The volume of the mesh.
   */
  calculateVolume(): number {
    return MeshAnalysis.calculateVolume(this.geometry);
  }

  /**
   * Calculates basic mesh statistics.
   * @returns An object containing various mesh statistics.
   */
  calculateStatistics() {
    return MeshAnalysis.calculateStatistics(this.geometry);
  }

  // Delegated serialization operations

  /**
   * Serializes the mesh to a JSON object.
   * @returns A JSON representation of the mesh.
   */
  toJSON() {
    return MeshSerialization.toJSON(
      this.geometry,
      this.id,
      this.name,
      this.boundingBoxMin,
      this.boundingBoxMax,
      this.metadata
    );
  }

  /**
   * Creates a mesh from a JSON object.
   * @param json - The JSON object representing the mesh.
   * @returns A new Mesh instance.
   */
  static fromJSON(json: any): Mesh {
    const result = MeshSerialization.fromJSON(json);
    const mesh = new Mesh(result.meshName);
    mesh.id = result.meshId;
    mesh.geometry = result.geometry;
    mesh.boundingBoxMin = result.boundingBoxMin;
    mesh.boundingBoxMax = result.boundingBoxMax;
    mesh.metadata = result.metadata;

    // Ensure nextId is updated to avoid collisions
    if (result.meshId >= Mesh.nextId) {
      Mesh.nextId = result.meshId + 1;
    }

    return mesh;
  }

  /**
   * Resets the global ID counter for Mesh instances.
   * Use with caution.
   */
  static resetIdCounter(): void {
    Mesh.nextId = 0;
  }

  /**
   * Returns a string representation of the mesh.
   * @returns String representation.
   */
  toString(): string {
    return `Mesh(${this.id}, "${this.name}", V:${this.vertices.size}, E:${this.edges.size}, F:${this.faces.size}, M:${this.materials.size})`;
  }
}
