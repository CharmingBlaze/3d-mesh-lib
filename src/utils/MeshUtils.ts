import { Mesh } from '../core/Mesh';
import { Vertex } from '../core/Vertex';

/**
 * Welds coincident vertices in a mesh.
 * Creates a new mesh where vertices closer than epsilon are merged.
 * Faces are updated to use the new vertex indices. Degenerate faces are removed.
 *
 * @param originalMesh The mesh to process.
 * @param epsilon The tolerance distance for considering vertices coincident. Defaults to 1e-6.
 * @returns A new Mesh instance with welded vertices.
 */
export function weldVertices(originalMesh: Mesh, epsilon: number = 1e-6): Mesh {
  const newMesh = new Mesh(originalMesh.name ? `${originalMesh.name}_welded` : 'welded_mesh');

  // 1. Clone materials
  originalMesh.materials.forEach(mat => {
    if (mat) {
      const clonedMaterial = mat.clone();
      newMesh.materials.set(clonedMaterial.id, clonedMaterial);
    }
  });

  const uniqueNewVertices: Vertex[] = []; // Stores actual Vertex instances added to newMesh
  const oldToNewVertexIdMap = new Map<number, number>(); // Maps old vertex ID to new vertex ID

  // 2. Process vertices
  // Performance note: For very large meshes, a spatial hashing structure (e.g., grid or k-d tree)
  // would be more efficient for finding nearby vertices than iterating `uniqueNewVertices` each time.
  for (const oldVertex of originalMesh.vertexArray) {
    let foundMatch = false;
    for (const newVertexCandidate of uniqueNewVertices) {
      if (oldVertex.position.distanceTo(newVertexCandidate.position) < epsilon) {
        oldToNewVertexIdMap.set(oldVertex.id, newVertexCandidate.id);
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      // No existing new vertex is close enough, so add this one (or a clone) to newMesh
      const newVertex = newMesh.addVertex(oldVertex.position.x, oldVertex.position.y, oldVertex.position.z);
      if (oldVertex.normal) {
        newVertex.normal = oldVertex.normal.clone();
      }
      if (oldVertex.uv) {
        newVertex.uv = { ...oldVertex.uv };
      }
      uniqueNewVertices.push(newVertex);
      oldToNewVertexIdMap.set(oldVertex.id, newVertex.id);
    }
  }

  // 3. Process faces
  for (const oldFace of originalMesh.faceArray) {
    const newFaceVertexIds: number[] = [];
    for (const oldVertex of oldFace.vertices) {
      const newId = oldToNewVertexIdMap.get(oldVertex.id);
      if (newId !== undefined) {
        newFaceVertexIds.push(newId);
      } else {
        // This should not happen if all old vertices were processed
        console.warn(`weldVertices: Could not find mapping for old vertex ID ${oldVertex.id} when creating face ${oldFace.id}`);
      }
    }

    // Check for degenerate faces (less than 3 unique vertices after mapping)
    const uniqueIdsInFace = new Set(newFaceVertexIds);
    if (uniqueIdsInFace.size >= 3) {
      try {
        // Attempt to add the face. Mesh.addFace will handle vertex lookup by ID.
        newMesh.addFace(Array.from(uniqueIdsInFace), oldFace.materialIndex === null ? undefined : oldFace.materialIndex);
      } catch (error) {
        console.warn(`weldVertices: Error adding face with new vertex IDs [${Array.from(uniqueIdsInFace).join(', ')}]: ${error}`);
      }
    } else {
        // console.log(`weldVertices: Skipping degenerate face ${oldFace.id} (original vertices: ${oldFace.vertices.map(v => v.id).join(', ')}; new mapped unique IDs: ${Array.from(uniqueIdsInFace).join(', ')})`);
    }
  }

  newMesh.computeBoundingBox();
  return newMesh;
}
