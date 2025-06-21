import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Face } from './Face';

interface ConversionState {
  originalFaceId: number;
  newFaceIds: number[];
  conversionType: 'triangulate' | 'quadrangulate';
}

/**
 * Command to convert between triangles and quads.
 * Triangulate converts quads to triangles, Quadrangulate joins adjacent triangles into quads.
 */
export class TriangulateQuadrangulate implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  private mode: 'triangulate' | 'quadrangulate' | 'auto';
  
  // Store original state for undo
  private conversionStates: ConversionState[] = [];
  
  public readonly description: string;

  /**
   * Creates an instance of TriangulateQuadrangulate command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param mode - Conversion mode: 'triangulate', 'quadrangulate', or 'auto'.
   * @param faceIds - Optional specific face IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    mode: 'triangulate' | 'quadrangulate' | 'auto' = 'auto',
    faceIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.mode = mode;
    
    // Use provided face IDs or get from selection
    this.faceIds = faceIds || Array.from(selectionManager.getSelectedFaceIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.conversionStates = [];
    
    if (this.faceIds.length === 0) {
      console.warn('TriangulateQuadrangulate: No faces selected or specified.');
      return;
    }

    // Process each face for conversion
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) {
        console.warn(`TriangulateQuadrangulate: Face with ID ${faceId} not found.`);
        return;
      }

      const conversionResult = this.convertFace(face);
      if (conversionResult) {
        this.conversionStates.push(conversionResult);
      }
    });

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    // Note: Full undo is complex due to topology changes
    console.warn('TriangulateQuadrangulate: Undo is not fully implemented. Conversion is currently irreversible.');
    
    // Clear stored state
    this.conversionStates = [];
  }

  /**
   * Converts a single face based on the mode.
   * @param face - The face to convert.
   * @returns Conversion state or null if no conversion needed.
   */
  private convertFace(face: Face): ConversionState | null {
    const vertexCount = face.vertices.length;
    
    if (this.mode === 'triangulate' || (this.mode === 'auto' && vertexCount > 3)) {
      return this.triangulateFace(face);
    } else if (this.mode === 'quadrangulate' && vertexCount === 3) {
      return this.quadrangulateFace(face);
    }
    
    return null; // No conversion needed
  }

  /**
   * Triangulates a face (converts to triangles).
   * @param face - The face to triangulate.
   * @returns Conversion state or null if failed.
   */
  private triangulateFace(face: Face): ConversionState | null {
    const vertices = face.vertices;
    
    if (vertices.length <= 3) {
      return null; // Already a triangle or invalid
    }

    const originalFaceId = face.id;
    const materialIndex = face.materialIndex;
    const newFaceIds: number[] = [];

    // Remove original face
    this.mesh.removeFace(originalFaceId);

    // Create triangles using fan triangulation
    for (let i = 1; i < vertices.length - 1; i++) {
      const triangleVertexIds = [
        vertices[0].id,
        vertices[i].id,
        vertices[i + 1].id
      ];

      const newFace = this.mesh.addFace(triangleVertexIds, materialIndex ?? undefined);
      newFaceIds.push(newFace.id);
    }

    return {
      originalFaceId,
      newFaceIds,
      conversionType: 'triangulate'
    };
  }

  /**
   * Attempts to quadrangulate a triangular face by merging with an adjacent triangle.
   * @param face - The triangular face to quadrangulate.
   * @returns Conversion state or null if failed.
   */
  private quadrangulateFace(face: Face): ConversionState | null {
    if (face.vertices.length !== 3) {
      return null; // Not a triangle
    }

    // Find an adjacent triangle to merge with
    const adjacentTriangle = this.findAdjacentTriangle(face);
    if (!adjacentTriangle) {
      return null; // No suitable adjacent triangle
    }

    const originalFaceId = face.id;
    const materialIndex = face.materialIndex;

    // Find the shared edge and create quad
    const sharedEdge = this.findSharedEdge(face, adjacentTriangle);
    if (!sharedEdge) {
      return null;
    }

    // Get all unique vertices from both triangles
    const face1Vertices = face.vertices.map(v => v.id);
    const face2Vertices = adjacentTriangle.vertices.map(v => v.id);
    const sharedVertexIds = [sharedEdge.v0.id, sharedEdge.v1.id];
    
    // Find the unique vertices (not shared)
    const uniqueVertex1 = face1Vertices.find(id => !sharedVertexIds.includes(id));
    const uniqueVertex2 = face2Vertices.find(id => !sharedVertexIds.includes(id));
    
    if (!uniqueVertex1 || !uniqueVertex2) {
      return null;
    }

    // Remove both triangular faces
    this.mesh.removeFace(face.id);
    this.mesh.removeFace(adjacentTriangle.id);

    // Create quad face with proper vertex order
    const quadVertexIds = [
      uniqueVertex1,
      sharedVertexIds[0],
      uniqueVertex2,
      sharedVertexIds[1]
    ];

    const newFace = this.mesh.addFace(quadVertexIds, materialIndex ?? undefined);

    return {
      originalFaceId,
      newFaceIds: [newFace.id],
      conversionType: 'quadrangulate'
    };
  }

  /**
   * Finds an adjacent triangle suitable for quadrangulation.
   * @param face - The triangle to find adjacent triangle for.
   * @returns Adjacent triangle face or null.
   */
  private findAdjacentTriangle(face: Face): Face | null {
    for (const edge of face.edges) {
      // Find faces that share this edge
      for (const otherFaceId of edge.faces) {
        if (otherFaceId === face.id) continue;
        
        const otherFace = this.mesh.getFace(otherFaceId);
        if (otherFace && otherFace.vertices.length === 3) {
          // Check if materials match
          if (face.materialIndex === otherFace.materialIndex) {
            return otherFace;
          }
        }
      }
    }
    return null;
  }

  /**
   * Finds the shared edge between two faces.
   * @param face1 - First face.
   * @param face2 - Second face.
   * @returns Shared edge or null.
   */
  private findSharedEdge(face1: Face, face2: Face): any | null {
    for (const edge of face1.edges) {
      if (edge.faces.has(face2.id)) {
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
    const faceCount = this.faceIds.length;
    const modeStr = this.mode === 'auto' ? 'auto-convert' : this.mode;
    return `${modeStr} ${faceCount} face${faceCount === 1 ? '' : 's'}`;
  }

  /**
   * Gets conversion statistics.
   * @returns Statistics object.
   */
  getConversionStats(): {
    facesProcessed: number;
    triangulations: number;
    quadrangulations: number;
  } {
    const triangulations = this.conversionStates.filter(s => s.conversionType === 'triangulate').length;
    const quadrangulations = this.conversionStates.filter(s => s.conversionType === 'quadrangulate').length;

    return {
      facesProcessed: this.conversionStates.length,
      triangulations,
      quadrangulations
    };
  }

  /**
   * Static factory method to triangulate faces.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @returns TriangulateQuadrangulate command instance.
   */
  static triangulate(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): TriangulateQuadrangulate {
    return new TriangulateQuadrangulate(mesh, selectionManager, 'triangulate');
  }

  /**
   * Static factory method to quadrangulate faces.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @returns TriangulateQuadrangulate command instance.
   */
  static quadrangulate(
    mesh: Mesh,
    selectionManager: SelectionManager
  ): TriangulateQuadrangulate {
    return new TriangulateQuadrangulate(mesh, selectionManager, 'quadrangulate');
  }
} 