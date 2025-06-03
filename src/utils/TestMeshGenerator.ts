import { Mesh } from '../core/Mesh';
import { Vertex } from '../core/Vertex';
import { Face } from '../core/Face';
import { Material } from '../core/Material';
import { Vector3D } from './Vector3D';

/**
 * Creates a test mesh with a specified number of primitives.
 * Each primitive is a simple quad with its own material index.
 * @param numberOfPrimitives The number of quads (primitives) to generate.
 * @returns A Mesh object.
 */
export function createMultiPrimitiveTestMesh(
  numberOfPrimitives: number
): Mesh {
  const mesh = new Mesh();
  // ID counters are not strictly necessary if Vertex/Face constructors handle IDs internally
  // and we use those internal IDs for map keys. But we might need them if we want
  // to control material IDs or other external references.

  const defaultNormalVec = new Vector3D(0, 0, 1);
  const defaultUVCoords = { u: 0, v: 0 }; // Will be overridden per vertex

  for (let i = 0; i < numberOfPrimitives; i++) {
    // Create a new material for each primitive
    const material = new Material(`Material_${i}`);
    // Assuming Material class might also have internal ID or needs one set explicitly.
    // For now, let's assume Material constructor handles its ID or it's not critical for mesh.materials map key.
    // If Material needs an ID for the map, and doesn't self-assign, we'd do: material.id = i;
    mesh.materials.set(i, material); // Using loop index 'i' as material ID for simplicity
    const currentMaterialIndex = i;

    // Offset each primitive slightly so they don't all overlap perfectly
    const offsetX = (i % 10) * 2.5; // Arrange in a grid, 2.5 units apart
    const offsetY = Math.floor(i / 10) * 2.5;

    // Vertex constructor: Vertex(x: number, y: number, z: number, normal?: Vector3D, uv?: { u: number; v: number })
    // Normals and UVs can be passed directly to constructor or set after.
    // Let's pass them directly for cleaner code.
    const v0 = new Vertex(offsetX,     offsetY,     0, defaultNormalVec.clone(), { u: 0, v: 0 });
    const v1 = new Vertex(offsetX + 1, offsetY,     0, defaultNormalVec.clone(), { u: 1, v: 0 });
    const v2 = new Vertex(offsetX + 1, offsetY + 1, 0, defaultNormalVec.clone(), { u: 1, v: 1 });
    const v3 = new Vertex(offsetX,     offsetY + 1, 0, defaultNormalVec.clone(), { u: 0, v: 1 });

    // Vertices are added to the map using their internally generated IDs.
    mesh.vertices.set(v0.id, v0);
    mesh.vertices.set(v1.id, v1);
    mesh.vertices.set(v2.id, v2);
    mesh.vertices.set(v3.id, v3);

    // Face constructor: Face(vertices: Vertex[], materialIndex?: number)
    // IDs are internally generated.
    const face1 = new Face([v0, v1, v2], currentMaterialIndex);
    mesh.faces.set(face1.id, face1);

    const face2 = new Face([v0, v2, v3], currentMaterialIndex);
    mesh.faces.set(face2.id, face2);
  }
  return mesh;
}
