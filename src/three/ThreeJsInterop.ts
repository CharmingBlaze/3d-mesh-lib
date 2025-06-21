import * as THREE from 'three';
import { Mesh } from '../core/Mesh';
import { Face } from '../core/Face';
// Vertex and Vector3D removed as they are unused

/**
 * Converts a core Mesh instance to a THREE.BufferGeometry instance.
 * This function triangulates faces and creates flat arrays for positions, normals, and UVs.
 * @param mesh - The core Mesh instance to convert.
 * @returns A THREE.BufferGeometry instance.
 */
export function meshToBufferGeometry(mesh: Mesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  // Create a mapping from core material ID to Three.js material index
  const materialIdToArrayIndex = new Map<number | undefined, number>();
  let nextMaterialArrayIndex = 0;

  // Ensure consistent ordering for material indices, handle undefined materialId as group 0
  materialIdToArrayIndex.set(undefined, nextMaterialArrayIndex++); 
  mesh.materials.forEach(material => {
    if (!materialIdToArrayIndex.has(material.id)) {
      materialIdToArrayIndex.set(material.id, nextMaterialArrayIndex++);
    }
  });

  // Group faces by their target material array index
  const facesByMaterialIndex = new Map<number, Face[]>();
  mesh.faces.forEach(face => {
    // face.materialIndex (type: number | null) holds the ID of the material assigned to this face.
    // This ID should be used as a key in materialIdToArrayIndex.
    // If face.materialIndex is null, it means no specific material, so we use 'undefined' as the key for the default group.
    const keyForMaterialMap = face.materialIndex === null ? undefined : face.materialIndex;
    const targetMaterialArrayIndex = materialIdToArrayIndex.get(keyForMaterialMap) ?? materialIdToArrayIndex.get(undefined)!;
    
    if (!facesByMaterialIndex.has(targetMaterialArrayIndex)) {
      facesByMaterialIndex.set(targetMaterialArrayIndex, []);
    }
    facesByMaterialIndex.get(targetMaterialArrayIndex)!.push(face);
  });

  let currentVertexOffset = 0; // Tracks the number of vertices added so far

  // Iterate through material groups in the order of their array index
  for (let matIdx = 0; matIdx < nextMaterialArrayIndex; matIdx++) {
    const facesInGroup = facesByMaterialIndex.get(matIdx);
    if (!facesInGroup || facesInGroup.length === 0) {
      continue; // Skip if no faces for this material index
    }

    const groupStartVertex = currentVertexOffset;
    let verticesInThisGroup = 0;

    facesInGroup.forEach(face => {
      const faceVertices = face.vertices;
      if (faceVertices.length < 3) {
        console.warn(`Skipping degenerate face ${face.id} with ${faceVertices.length} vertices.`);
        return;
      }

      const numVerticesInFace = faceVertices.length;
      for (let i = 1; i < numVerticesInFace - 1; i++) {
        const triangleVertexIndicesInFace = [0, i, i + 1]; // Defines one triangle in the fan
        
        triangleVertexIndicesInFace.forEach(vertexIndexInFace => {
          const vertex = faceVertices[vertexIndexInFace];
          positions.push(vertex.position.x, vertex.position.y, vertex.position.z);

          if (vertex.normal) {
            normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
          } else if (face.normal) {
            normals.push(face.normal.x, face.normal.y, face.normal.z);
          } else {
            normals.push(0, 1, 0);
          }

          if (vertex.uv) {
            uvs.push(vertex.uv.u, vertex.uv.v);
          } else {
            uvs.push(0, 0);
          }
          verticesInThisGroup++;
        });
      }
    });

    if (verticesInThisGroup > 0) {
      geometry.addGroup(groupStartVertex, verticesInThisGroup, matIdx);
      currentVertexOffset += verticesInThisGroup;
    }
  }

  if (positions.length > 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  }
  if (normals.length > 0) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  if (uvs.length > 0) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }

  if (positions.length > 0) {
    geometry.computeBoundingSphere();
    // geometry.computeVertexNormals(); // Only if we didn't provide our own good normals
  }

  return geometry;
}

// TODO: Implement bufferGeometryToMesh if needed
// export function bufferGeometryToMesh(geometry: THREE.BufferGeometry): Mesh {
//   // This would be more complex, involving parsing attributes and reconstructing Mesh topology.
//   const mesh = new Mesh('ImportedMesh');
//   // ... implementation ...
//   return mesh;
// }
