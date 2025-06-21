import { ICommand } from './ICommand';
import { Mesh } from './Mesh';
import { Face } from './Face';
import { Edge } from './Edge';
import { Vertex } from './Vertex';

interface OriginalTriangleData {
  id: number;
  vertexIds: number[];
  materialId: number | null;
}

interface JoinTrianglesUndoState {
  originalTriangle1Data: OriginalTriangleData;
  originalTriangle2Data: OriginalTriangleData;
  newQuadFaceId: number | null;
}

export class JoinTrianglesToQuad implements ICommand {
  private mesh: Mesh;
  private triangleId1: number;
  private triangleId2: number;
  private undoState: JoinTrianglesUndoState | null = null;
  public readonly description: string;

  constructor(mesh: Mesh, triangleId1: number, triangleId2: number, description?: string) {
    this.mesh = mesh;
    this.triangleId1 = triangleId1;
    this.triangleId2 = triangleId2;
    this.description = description || `Join triangles ${triangleId1} and ${triangleId2} to quad`;
  }

  private findSharedEdgeAndUniqueVertices(
    triangle1: Face, 
    triangle2: Face
  ): { sharedEdge: Edge; uV1: Vertex; uV2: Vertex } | null {
    let sharedEdge: Edge | null = null;
    for (const edge of triangle1.edges) {
      if (edge.faces.has(triangle2.id)) {
        if (sharedEdge) return null; // More than one shared edge
        sharedEdge = edge;
      }
    }
    if (!sharedEdge) return null; // No shared edge

    let uV1: Vertex | null = null;
    for (const v of triangle1.vertices) {
      if (v.id !== sharedEdge.v0.id && v.id !== sharedEdge.v1.id) {
        uV1 = v;
        break;
      }
    }

    let uV2: Vertex | null = null;
    for (const v of triangle2.vertices) {
      if (v.id !== sharedEdge.v0.id && v.id !== sharedEdge.v1.id) {
        uV2 = v;
        break;
      }
    }

    if (!uV1 || !uV2) return null; // Should not happen if triangles and shared edge are valid

    return { sharedEdge, uV1, uV2 };
  }
  
  private getQuadVertexLoop(uV1: Vertex, uV2: Vertex, sharedEdge: Edge, triangle1Vertices: Vertex[]): number[] {
    // Determine the order of shared vertices in triangle1 relative to uV1
    // Example: if t1 is (uV1, sA, sB), then quad is (uV1, sA, uV2, sB)
    const sV0 = sharedEdge.v0;
    const sV1 = sharedEdge.v1;

    const uV1_idx = triangle1Vertices.findIndex(v => v.id === uV1.id);

    // Check winding: (uV1_idx, sV_A_idx, sV_B_idx) form a cycle
    // if (sV_A_idx === (uV1_idx + 1) % 3) -> sV_A is next after uV1
    // then sV_B must be (sV_A_idx + 1) % 3

    // Simplified: find sA such that edge (uV1, sA) exists on triangle1
    // and sB such that edge (uV1, sB) does not exist (sB is the other shared vertex)
    // This determines the order around uV1 on triangle1.
    let sA_id: number, sB_id: number;

    // Find which shared vertex follows uV1 in triangle1's order
    const vNextToUV1 = triangle1Vertices[(uV1_idx + 1) % 3].id;
    const vPrevToUV1 = triangle1Vertices[(uV1_idx + 2) % 3].id;

    if (vNextToUV1 === sV0.id && vPrevToUV1 === sV1.id) {
        sA_id = sV0.id; sB_id = sV1.id;
    } else if (vNextToUV1 === sV1.id && vPrevToUV1 === sV0.id) {
        sA_id = sV1.id; sB_id = sV0.id;
    } else {
        console.error("JoinTrianglesToQuad: Could not determine vertex order for quad.");
        return []; // Should not happen with valid triangle geometry
    }
    
    return [uV1.id, sA_id, uV2.id, sB_id];
}


  execute(): void {
    this.undoState = null;
    const t1 = this.mesh.getFace(this.triangleId1);
    const t2 = this.mesh.getFace(this.triangleId2);

    if (!t1 || !t2) {
      console.warn('JoinTrianglesToQuad: One or both triangles not found.'); return;
    }
    if (t1.vertices.length !== 3 || t2.vertices.length !== 3) {
      console.warn('JoinTrianglesToQuad: One or both faces are not triangles.'); return;
    }
    if (t1.id === t2.id) {
        console.warn('JoinTrianglesToQuad: Cannot join a triangle to itself.'); return;
    }

    const edgeInfo = this.findSharedEdgeAndUniqueVertices(t1, t2);
    if (!edgeInfo) {
      console.warn('JoinTrianglesToQuad: Triangles do not share exactly one edge or unique vertices not found.'); return;
    }
    const { sharedEdge, uV1, uV2 } = edgeInfo;

    const quadVertexIds = this.getQuadVertexLoop(uV1, uV2, sharedEdge, t1.vertices);
    if (quadVertexIds.length !== 4) {
        console.warn('JoinTrianglesToQuad: Failed to determine quad vertex loop.'); return;
    }

    // Optional: Add planarity check for the new quad here

    this.undoState = {
      originalTriangle1Data: { id: t1.id, vertexIds: t1.vertices.map(v => v.id), materialId: t1.materialIndex },
      originalTriangle2Data: { id: t2.id, vertexIds: t2.vertices.map(v => v.id), materialId: t2.materialIndex },
      newQuadFaceId: null,
    };

    if (!this.mesh.removeFace(t1.id) || !this.mesh.removeFace(t2.id)) {
      console.error('JoinTrianglesToQuad: Failed to remove one of the original triangles.');
      // Attempt to restore if one was removed and other failed - complex.
      this.undoState = null; // Invalidate undo state
      return;
    }

    // Use material from t1, or average, or prompt. For now, t1's.
    const newQuadFace = this.mesh.addFace(quadVertexIds, t1.materialIndex === null ? undefined : t1.materialIndex);
    if (!newQuadFace) {
      console.error('JoinTrianglesToQuad: Failed to create the new quad face. Restoring original triangles.');
      this.mesh.addFace(this.undoState.originalTriangle1Data.vertexIds, this.undoState.originalTriangle1Data.materialId === null ? undefined : this.undoState.originalTriangle1Data.materialId);
      this.mesh.addFace(this.undoState.originalTriangle2Data.vertexIds, this.undoState.originalTriangle2Data.materialId === null ? undefined : this.undoState.originalTriangle2Data.materialId);
      this.undoState = null; // Invalidate undo state
      return;
    }
    this.undoState.newQuadFaceId = newQuadFace.id;
  }

  undo(): void {
    if (!this.undoState || this.undoState.newQuadFaceId === null) return;

    if (!this.mesh.removeFace(this.undoState.newQuadFaceId)) {
      console.error('JoinTrianglesToQuad (undo): Failed to remove the new quad face.');
    }

    const r1 = this.mesh.addFace(this.undoState.originalTriangle1Data.vertexIds, this.undoState.originalTriangle1Data.materialId === null ? undefined : this.undoState.originalTriangle1Data.materialId);
    const r2 = this.mesh.addFace(this.undoState.originalTriangle2Data.vertexIds, this.undoState.originalTriangle2Data.materialId === null ? undefined : this.undoState.originalTriangle2Data.materialId);
    if (!r1 || !r2) {
        console.error('JoinTrianglesToQuad (undo): Failed to restore one or both original triangles.');
    }

    this.undoState = null; // Clear state after undo
  }
}
