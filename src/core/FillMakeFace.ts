import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Edge } from './Edge';

interface FillState {
  newFaceIds: number[];
  usedVertexIds: number[];
  fillType: 'simple' | 'triangulated' | 'grid';
}

/**
 * Command to fill edge loops or create faces from vertices.
 * Creates faces from selected boundary edges or vertex loops.
 */
export class FillMakeFace implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private edgeIds: number[];
  private vertexIds: number[];
  private fillType: 'simple' | 'triangulated' | 'grid';
  private materialIndex?: number;
  
  // Store original state for undo
  private fillState: FillState | null = null;
  
  public readonly description: string;

  /**
   * Creates an instance of FillMakeFace command.
   * @param mesh - The mesh containing edges/vertices.
   * @param selectionManager - The selection manager.
   * @param fillType - Type of fill operation.
   * @param materialIndex - Optional material index for new faces.
   * @param edgeIds - Optional specific edge IDs.
   * @param vertexIds - Optional specific vertex IDs.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    fillType: 'simple' | 'triangulated' | 'grid' = 'simple',
    materialIndex?: number,
    edgeIds?: number[],
    vertexIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.fillType = fillType;
    this.materialIndex = materialIndex;
    
    // Use provided IDs or get from selection
    this.edgeIds = edgeIds || Array.from(selectionManager.getSelectedEdgeIds());
    this.vertexIds = vertexIds || Array.from(selectionManager.getSelectedVertexIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.fillState = null;
    
    if (this.edgeIds.length === 0 && this.vertexIds.length === 0) {
      console.warn('FillMakeFace: No edges or vertices selected.');
      return;
    }

    const fillResult = this.performFill();
    if (fillResult) {
      this.fillState = fillResult;
    }

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    if (!this.fillState) return;

    // Remove created faces
    this.fillState.newFaceIds.forEach(faceId => {
      this.mesh.removeFace(faceId);
    });

    this.fillState = null;
  }

  /**
   * Performs the fill operation based on available input.
   * @returns Fill state or null if failed.
   */
  private performFill(): FillState | null {
    // Priority: try edge loops first, then vertex loops
    if (this.edgeIds.length > 0) {
      return this.fillFromEdges();
    } else if (this.vertexIds.length > 0) {
      return this.fillFromVertices();
    }
    
    return null;
  }

  /**
   * Creates faces from selected edges (edge loop filling).
   * @returns Fill state or null if failed.
   */
  private fillFromEdges(): FillState | null {
    // Convert edges to ordered vertex loop
    const vertexLoop = this.edgesToVertexLoop(this.edgeIds);
    if (!vertexLoop || vertexLoop.length < 3) {
      console.warn('FillMakeFace: Could not create valid vertex loop from edges.');
      return null;
    }

    return this.createFacesFromVertexLoop(vertexLoop);
  }

  /**
   * Creates faces from selected vertices.
   * @returns Fill state or null if failed.
   */
  private fillFromVertices(): FillState | null {
    if (this.vertexIds.length < 3) {
      console.warn('FillMakeFace: Need at least 3 vertices to create a face.');
      return null;
    }

    // For vertex selection, order them appropriately
    const orderedVertices = this.orderVerticesForFace(this.vertexIds);
    return this.createFacesFromVertexLoop(orderedVertices);
  }

  /**
   * Converts edge IDs to an ordered vertex loop.
   * @param edgeIds - Array of edge IDs.
   * @returns Ordered vertex IDs or null if can't form loop.
   */
  private edgesToVertexLoop(edgeIds: number[]): number[] | null {
    if (edgeIds.length === 0) return null;

    const edges = edgeIds.map(id => this.findEdgeById(id)).filter(edge => edge !== null) as Edge[];
    if (edges.length === 0) return null;

    const vertexLoop: number[] = [];
    const usedEdges = new Set<string>();
    
    // Start with first edge
    let currentEdge = edges[0];
    vertexLoop.push(currentEdge.v0.id);
    vertexLoop.push(currentEdge.v1.id);
    usedEdges.add(currentEdge.key);

    // Find connected edges to form loop
    while (usedEdges.size < edges.length) {
      const lastVertexId = vertexLoop[vertexLoop.length - 1];
      let foundNext = false;

      for (const edge of edges) {
        if (usedEdges.has(edge.key)) continue;

        if (edge.v0.id === lastVertexId) {
          vertexLoop.push(edge.v1.id);
          usedEdges.add(edge.key);
          foundNext = true;
          break;
        } else if (edge.v1.id === lastVertexId) {
          vertexLoop.push(edge.v0.id);
          usedEdges.add(edge.key);
          foundNext = true;
          break;
        }
      }

      if (!foundNext) break;
    }

    // Remove duplicate if it's a closed loop
    if (vertexLoop.length > 2 && vertexLoop[0] === vertexLoop[vertexLoop.length - 1]) {
      vertexLoop.pop();
    }

    return vertexLoop;
  }

  /**
   * Orders vertices appropriately for face creation.
   * @param vertexIds - Unordered vertex IDs.
   * @returns Ordered vertex IDs.
   */
  private orderVerticesForFace(vertexIds: number[]): number[] {
    // Simple ordering by angle around centroid
    const vertices = vertexIds.map(id => this.mesh.getVertex(id)).filter(v => v !== null);
    if (vertices.length < 3) return vertexIds;

    // Calculate centroid
    const centroid = vertices.reduce(
      (sum, vertex) => sum.add(vertex!.position),
      new Vector3D(0, 0, 0)
    ).multiplyScalar(1 / vertices.length);

    // Sort by angle around centroid
    const verticesWithAngles = vertices.map(vertex => {
      const direction = vertex!.position.subtract(centroid);
      const angle = Math.atan2(direction.y, direction.x);
      return { vertex: vertex!, angle };
    });

    verticesWithAngles.sort((a, b) => a.angle - b.angle);
    
    return verticesWithAngles.map(item => item.vertex.id);
  }

  /**
   * Creates faces from an ordered vertex loop.
   * @param vertexLoop - Ordered vertex IDs.
   * @returns Fill state or null if failed.
   */
  private createFacesFromVertexLoop(vertexLoop: number[]): FillState | null {
    const newFaceIds: number[] = [];

    switch (this.fillType) {
      case 'simple':
        // Create single n-gon face
        const simpleFace = this.mesh.addFace(vertexLoop, this.materialIndex);
        newFaceIds.push(simpleFace.id);
        break;

      case 'triangulated':
        // Fan triangulation from first vertex
        for (let i = 1; i < vertexLoop.length - 1; i++) {
          const triangleVertices = [
            vertexLoop[0],
            vertexLoop[i],
            vertexLoop[i + 1]
          ];
          const triangleFace = this.mesh.addFace(triangleVertices, this.materialIndex);
          newFaceIds.push(triangleFace.id);
        }
        break;

      case 'grid':
        // Grid fill for rectangular loops
        const gridFaces = this.createGridFill(vertexLoop);
        newFaceIds.push(...gridFaces);
        break;
    }

    return {
      newFaceIds,
      usedVertexIds: [...vertexLoop],
      fillType: this.fillType
    };
  }

  /**
   * Creates a grid fill for rectangular vertex loops.
   * @param vertexLoop - Ordered vertex IDs (should be rectangular).
   * @returns Array of new face IDs.
   */
  private createGridFill(vertexLoop: number[]): number[] {
    const newFaceIds: number[] = [];

    // For simplicity, assume 4-vertex rectangular loop and create center vertex
    if (vertexLoop.length === 4) {
      // Calculate center position
      const vertices = vertexLoop.map(id => this.mesh.getVertex(id)).filter(v => v !== null);
      const centerPosition = vertices.reduce(
        (sum, vertex) => sum.add(vertex!.position),
        new Vector3D(0, 0, 0)
      ).multiplyScalar(1 / vertices.length);

      // Create center vertex
      const centerVertex = this.mesh.addVertex(
        centerPosition.x,
        centerPosition.y,
        centerPosition.z
      );

      // Create 4 triangular faces from center to each edge
      for (let i = 0; i < vertexLoop.length; i++) {
        const nextI = (i + 1) % vertexLoop.length;
        const triangleVertices = [
          centerVertex.id,
          vertexLoop[i],
          vertexLoop[nextI]
        ];
        const triangleFace = this.mesh.addFace(triangleVertices, this.materialIndex);
        newFaceIds.push(triangleFace.id);
      }
    } else {
      // Fallback to triangulation for non-rectangular loops
      for (let i = 1; i < vertexLoop.length - 1; i++) {
        const triangleVertices = [
          vertexLoop[0],
          vertexLoop[i],
          vertexLoop[i + 1]
        ];
        const triangleFace = this.mesh.addFace(triangleVertices, this.materialIndex);
        newFaceIds.push(triangleFace.id);
      }
    }

    return newFaceIds;
  }

  /**
   * Finds an edge by its ID.
   * @param edgeId - The edge ID to find.
   * @returns The edge or null if not found.
   */
  private findEdgeById(edgeId: number): Edge | null {
    for (const edge of this.mesh.edges.values()) {
      if (edge.id === edgeId) {
        return edge;
      }
    }
    return null;
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const inputType = this.edgeIds.length > 0 ? 
      `${this.edgeIds.length} edges` : 
      `${this.vertexIds.length} vertices`;
    return `Fill/Make face from ${inputType} (${this.fillType})`;
  }

  /**
   * Gets fill statistics.
   * @returns Statistics object.
   */
  getFillStats(): {
    facesCreated: number;
    verticesUsed: number;
    fillType: 'simple' | 'triangulated' | 'grid';
  } {
    return {
      facesCreated: this.fillState?.newFaceIds.length || 0,
      verticesUsed: this.fillState?.usedVertexIds.length || 0,
      fillType: this.fillType
    };
  }

  /**
   * Static factory method to create simple face fill.
   * @param mesh - The mesh.
   * @param selectionManager - The selection manager.
   * @param materialIndex - Optional material index.
   * @returns FillMakeFace command instance.
   */
  static fillSimple(
    mesh: Mesh,
    selectionManager: SelectionManager,
    materialIndex?: number
  ): FillMakeFace {
    return new FillMakeFace(mesh, selectionManager, 'simple', materialIndex);
  }

  /**
   * Static factory method to create triangulated fill.
   * @param mesh - The mesh.
   * @param selectionManager - The selection manager.
   * @param materialIndex - Optional material index.
   * @returns FillMakeFace command instance.
   */
  static fillTriangulated(
    mesh: Mesh,
    selectionManager: SelectionManager,
    materialIndex?: number
  ): FillMakeFace {
    return new FillMakeFace(mesh, selectionManager, 'triangulated', materialIndex);
  }

  /**
   * Static factory method to create grid fill.
   * @param mesh - The mesh.
   * @param selectionManager - The selection manager.
   * @param materialIndex - Optional material index.
   * @returns FillMakeFace command instance.
   */
  static fillGrid(
    mesh: Mesh,
    selectionManager: SelectionManager,
    materialIndex?: number
  ): FillMakeFace {
    return new FillMakeFace(mesh, selectionManager, 'grid', materialIndex);
  }
} 