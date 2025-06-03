import { Mesh } from './Mesh';
import { SelectionManager } from './SelectionManager';
import { ICommand } from './ICommand';
import { Vector3D } from '@/utils/Vector3D';
import { Face } from './Face';

interface SolidifyState {
  originalFaceIds: number[];
  newInnerFaceIds: number[];
  newOuterFaceIds: number[];
  sideFaceIds: number[];
  thickness: number;
  offset: number;
}

/**
 * Command to solidify faces by adding thickness.
 * Creates shell geometry by extruding faces inward and/or outward.
 */
export class SolidifyFaces implements ICommand {
  private mesh: Mesh;
  private selectionManager: SelectionManager;
  private faceIds: number[];
  private thickness: number;
  private offset: number; // 0 = centered, -1 = inward only, +1 = outward only
  private evenThickness: boolean;
  
  // Store original state for undo
  private solidifyState: SolidifyState | null = null;
  
  public readonly description: string;

  /**
   * Creates an instance of SolidifyFaces command.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param thickness - Thickness of the solidification.
   * @param offset - Offset direction (-1 to +1, 0 = centered).
   * @param evenThickness - Whether to maintain even thickness.
   * @param faceIds - Optional specific face IDs, uses selection if not provided.
   */
  constructor(
    mesh: Mesh,
    selectionManager: SelectionManager,
    thickness: number,
    offset: number = 0,
    evenThickness: boolean = true,
    faceIds?: number[]
  ) {
    this.mesh = mesh;
    this.selectionManager = selectionManager;
    this.thickness = Math.abs(thickness);
    this.offset = Math.max(-1, Math.min(1, offset));
    this.evenThickness = evenThickness;
    
    // Use provided face IDs or get from selection
    this.faceIds = faceIds || Array.from(selectionManager.getSelectedFaceIds());
    
    this.description = this.buildDescription();
  }

  execute(): void {
    this.solidifyState = null;
    
    if (this.faceIds.length === 0) {
      console.warn('SolidifyFaces: No faces selected or specified.');
      return;
    }

    const solidifyResult = this.createSolidification();
    if (solidifyResult) {
      this.solidifyState = solidifyResult;
    }

    // Update mesh bounding box
    this.mesh.computeBoundingBox();
  }

  undo(): void {
    if (!this.solidifyState) return;

    // Remove all created faces
    [
      ...this.solidifyState.newInnerFaceIds,
      ...this.solidifyState.newOuterFaceIds,
      ...this.solidifyState.sideFaceIds
    ].forEach(faceId => {
      this.mesh.removeFace(faceId);
    });

    // Note: Restoring original faces and cleaning up vertices is complex
    console.warn('SolidifyFaces: Undo is not fully implemented. Solidification is currently irreversible.');
    
    // Clear stored state
    this.solidifyState = null;
  }

  /**
   * Creates the solidification of the selected faces.
   * @returns Solidify state or null if failed.
   */
  private createSolidification(): SolidifyState | null {
    const originalFaceIds: number[] = [];
    const newInnerFaceIds: number[] = [];
    const newOuterFaceIds: number[] = [];
    const sideFaceIds: number[] = [];

    // Calculate thickness distribution
    const innerThickness = this.offset <= 0 ? this.thickness * (1 + this.offset) / 2 : 0;
    const outerThickness = this.offset >= 0 ? this.thickness * (1 - this.offset) / 2 : 0;

    // Process each face
    this.faceIds.forEach(faceId => {
      const face = this.mesh.getFace(faceId);
      if (!face) {
        console.warn(`SolidifyFaces: Face with ID ${faceId} not found.`);
        return;
      }

      const solidifyResult = this.solidifyFace(face, innerThickness, outerThickness);
      if (solidifyResult) {
        originalFaceIds.push(faceId);
        if (solidifyResult.innerFaceId) newInnerFaceIds.push(solidifyResult.innerFaceId);
        if (solidifyResult.outerFaceId) newOuterFaceIds.push(solidifyResult.outerFaceId);
        sideFaceIds.push(...solidifyResult.sideFaceIds);
      }
    });

    return {
      originalFaceIds,
      newInnerFaceIds,
      newOuterFaceIds,
      sideFaceIds,
      thickness: this.thickness,
      offset: this.offset
    };
  }

  /**
   * Solidifies a single face.
   * @param face - The face to solidify.
   * @param innerThickness - Thickness toward inside.
   * @param outerThickness - Thickness toward outside.
   * @returns Solidification result or null if failed.
   */
  private solidifyFace(
    face: Face,
    innerThickness: number,
    outerThickness: number
  ): { innerFaceId?: number; outerFaceId?: number; sideFaceIds: number[] } | null {
    const faceNormal = face.normal;
    if (!faceNormal) {
      console.warn('SolidifyFaces: Face has no normal, cannot solidify.');
      return null;
    }

    const vertices = face.vertices;
    const materialIndex = face.materialIndex;
    const sideFaceIds: number[] = [];

    // Create inner and outer vertex sets
    const innerVertexIds: number[] = [];
    const outerVertexIds: number[] = [];

    vertices.forEach(vertex => {
      // Calculate vertex normal (average of adjacent face normals for smoother result)
      const vertexNormal = this.evenThickness ? 
        this.calculateVertexNormal(vertex) : faceNormal;

      // Create inner vertex
      if (innerThickness > 0) {
        const innerPosition = vertex.position.subtract(vertexNormal.multiplyScalar(innerThickness));
        const innerVertex = this.mesh.addVertex(
          innerPosition.x,
          innerPosition.y,
          innerPosition.z,
          vertexNormal.multiplyScalar(-1), // Flip normal for inner face
          vertex.uv ? { ...vertex.uv } : undefined
        );
        innerVertexIds.push(innerVertex.id);
      }

      // Create outer vertex
      if (outerThickness > 0) {
        const outerPosition = vertex.position.add(vertexNormal.multiplyScalar(outerThickness));
        const outerVertex = this.mesh.addVertex(
          outerPosition.x,
          outerPosition.y,
          outerPosition.z,
          vertexNormal.clone(),
          vertex.uv ? { ...vertex.uv } : undefined
        );
        outerVertexIds.push(outerVertex.id);
      }
    });

    // Create side faces connecting inner and outer edges
    for (let i = 0; i < vertices.length; i++) {
      const nextI = (i + 1) % vertices.length;
      
      const originalV1 = vertices[i].id;
      const originalV2 = vertices[nextI].id;
      
      // Create side faces based on what surfaces we have
      if (innerVertexIds.length > 0 && outerVertexIds.length > 0) {
        // Both inner and outer surfaces
        const innerV1 = innerVertexIds[i];
        const innerV2 = innerVertexIds[nextI];
        const outerV1 = outerVertexIds[i];
        const outerV2 = outerVertexIds[nextI];

        // Create side quad
        const sideFace = this.mesh.addFace([innerV1, innerV2, outerV2, outerV1], materialIndex ?? undefined);
        sideFaceIds.push(sideFace.id);
      } else if (innerVertexIds.length > 0) {
        // Only inner surface
        const innerV1 = innerVertexIds[i];
        const innerV2 = innerVertexIds[nextI];

        const sideFace = this.mesh.addFace([originalV1, originalV2, innerV2, innerV1], materialIndex ?? undefined);
        sideFaceIds.push(sideFace.id);
      } else if (outerVertexIds.length > 0) {
        // Only outer surface
        const outerV1 = outerVertexIds[i];
        const outerV2 = outerVertexIds[nextI];

        const sideFace = this.mesh.addFace([originalV1, outerV1, outerV2, originalV2], materialIndex ?? undefined);
        sideFaceIds.push(sideFace.id);
      }
    }

    // Create inner face (if we have inner vertices)
    let innerFaceId: number | undefined;
    if (innerVertexIds.length > 0) {
      // Reverse vertex order for inner face to maintain proper winding
      const reversedInnerIds = [...innerVertexIds].reverse();
      const innerFace = this.mesh.addFace(reversedInnerIds, materialIndex ?? undefined);
      innerFaceId = innerFace.id;
    }

    // Create outer face (if we have outer vertices)
    let outerFaceId: number | undefined;
    if (outerVertexIds.length > 0) {
      const outerFace = this.mesh.addFace(outerVertexIds, materialIndex ?? undefined);
      outerFaceId = outerFace.id;
    }

    // Remove original face
    this.mesh.removeFace(face.id);

    return {
      innerFaceId,
      outerFaceId,
      sideFaceIds
    };
  }

  /**
   * Calculates vertex normal by averaging adjacent face normals.
   * @param vertex - The vertex to calculate normal for.
   * @returns Averaged normal vector.
   */
  private calculateVertexNormal(vertex: any): Vector3D {
    let totalNormal = new Vector3D(0, 0, 0);
    let normalCount = 0;

    // Get normals from adjacent faces
    vertex.faces.forEach((faceId: number) => {
      const face = this.mesh.getFace(faceId);
      if (face && face.normal) {
        totalNormal = totalNormal.add(face.normal);
        normalCount++;
      }
    });

    if (normalCount === 0) {
      return new Vector3D(0, 0, 1); // Default up
    }

    return totalNormal.multiplyScalar(1 / normalCount).normalize();
  }

  /**
   * Builds description string for the command.
   * @returns Description string.
   */
  private buildDescription(): string {
    const faceCount = this.faceIds.length;
    const offsetStr = this.offset === 0 ? 'centered' : 
                     this.offset < 0 ? 'inward' : 'outward';
    return `Solidify ${faceCount} face${faceCount === 1 ? '' : 's'} (thickness: ${this.thickness.toFixed(3)}, ${offsetStr})`;
  }

  /**
   * Gets solidification statistics.
   * @returns Statistics object.
   */
  getSolidifyStats(): {
    facesProcessed: number;
    innerFacesCreated: number;
    outerFacesCreated: number;
    sideFacesCreated: number;
    thickness: number;
  } {
    if (!this.solidifyState) {
      return {
        facesProcessed: 0,
        innerFacesCreated: 0,
        outerFacesCreated: 0,
        sideFacesCreated: 0,
        thickness: this.thickness
      };
    }

    return {
      facesProcessed: this.solidifyState.originalFaceIds.length,
      innerFacesCreated: this.solidifyState.newInnerFaceIds.length,
      outerFacesCreated: this.solidifyState.newOuterFaceIds.length,
      sideFacesCreated: this.solidifyState.sideFaceIds.length,
      thickness: this.thickness
    };
  }

  /**
   * Static factory method to create outward solidification.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param thickness - Thickness value.
   * @returns SolidifyFaces command instance.
   */
  static solidifyOutward(
    mesh: Mesh,
    selectionManager: SelectionManager,
    thickness: number
  ): SolidifyFaces {
    return new SolidifyFaces(mesh, selectionManager, thickness, 1, true);
  }

  /**
   * Static factory method to create inward solidification.
   * @param mesh - The mesh containing faces.
   * @param selectionManager - The selection manager.
   * @param thickness - Thickness value.
   * @returns SolidifyFaces command instance.
   */
  static solidifyInward(
    mesh: Mesh,
    selectionManager: SelectionManager,
    thickness: number
  ): SolidifyFaces {
    return new SolidifyFaces(mesh, selectionManager, thickness, -1, true);
  }
} 