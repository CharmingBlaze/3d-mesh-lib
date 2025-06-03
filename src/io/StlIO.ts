import { Mesh } from '@/core/Mesh';
import { Vector3D } from '@/utils/Vector3D';
import { weldVertices } from '../utils/MeshUtils';

/**
 * Sanitizes a string for use in STL headers (solid name, binary header).
 * Removes non-ASCII characters and replaces whitespace with underscores.
 * @param name - The string to sanitize.
 * @returns The sanitized string.
 */
function sanitizeName(name: string): string {
  // Limit to ASCII, replace common problematic characters, and ensure it's not empty
  const sanitized = name.replace(/[\x00-\x1F\x7F-\xFF]/g, '').replace(/\s+/g, '_').substring(0, 70); // STL binary header is 80 bytes, leave some room
  return sanitized.length > 0 ? sanitized : 'default_mesh_name';
}

/**
 * Handles import and export of Mesh objects to/from the STL format.
 */
export class StlIO {
  /**
   * Imports a Mesh object from either an ASCII STL string or a binary STL ArrayBuffer.
   * Auto-detects the format based on the input type.
   * Note: STL format inherently does not share vertices between triangles.
   * This importer first creates unique vertices for each triangle corner.
   * Then, the `weldVertices` utility from `MeshUtils` is applied to merge coincident vertices.
   * @param stlData - The STL data, either as a string (ASCII) or ArrayBuffer (binary).
   * @returns A new Mesh object reconstructed from the STL data, with coincident vertices welded. The welding process returns a new mesh instance.
   * @throws Error if the binary buffer is too small or appears malformed (for binary import), or if input type is invalid.
   */
  static importMesh(stlData: string | ArrayBuffer): Mesh {
    let rawMesh: Mesh;
    if (typeof stlData === 'string') {
      rawMesh = StlIO.importMeshFromAscii(stlData);
    } else if (stlData instanceof ArrayBuffer) {
      rawMesh = StlIO.importMeshFromBinary(stlData);
    } else {
    // This case should ideally not be reached if TypeScript's type checking is effective,
    // but as a runtime safeguard:
      throw new Error('Invalid input type for importMesh. Expected string or ArrayBuffer.');
    }
    // Apply vertex welding. weldVertices returns a new mesh.
    const weldedMesh = weldVertices(rawMesh); // Default epsilon is 1e-6
    return weldedMesh;
  }

  /**
   * Exports a Mesh object to an ASCII STL format string.
   * All faces will be triangulated if they are not already triangles.
   * Degenerate faces (faces that cannot form a valid normal) will be skipped.
   * @param mesh - The Mesh object to export.
   * @returns An ASCII STL format string representing the mesh.
   */
  static exportMeshToAscii(mesh: Mesh): string {
        const meshDisplayName = sanitizeName(mesh.name || 'ExportedMesh');
    let stlString = `solid ${meshDisplayName}\n`;

    mesh.faces.forEach(face => {
      // Ensure face normal is available
            const normal = face.normal ?? face.calculateNormal();
            if (!normal) {
        console.warn(`Face ID ${face.id} is degenerate or could not calculate a normal. Skipping in ASCII STL export.`);
        return;
      }

      const vertices = face.vertices;
      if (vertices.length < 3) {
        console.warn(`Face ID ${face.id} has less than 3 vertices. Skipping in STL export.`);
        return;
      }

      // Triangulate polygon using simple fan triangulation (v0, v1, v2; v0, v2, v3; ...)
      for (let i = 0; i < vertices.length - 2; i++) {
        const v0 = vertices[0].position;
        const v1 = vertices[i + 1].position;
        const v2 = vertices[i + 2].position;

        stlString += `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
        stlString += `    outer loop\n`;
        stlString += `      vertex ${v0.x.toFixed(6)} ${v0.y.toFixed(6)} ${v0.z.toFixed(6)}\n`;
        stlString += `      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(6)} ${v1.z.toFixed(6)}\n`;
        stlString += `      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(6)} ${v2.z.toFixed(6)}\n`;
        stlString += `    endloop\n`;
        stlString += `  endfacet\n`;
      }
    });

        stlString += `endsolid ${meshDisplayName}\n`;
    return stlString;
  }

  /**
   * Imports a Mesh object from an ASCII STL format string.
   * Note: STL format inherently does not share vertices between triangles.
   * This importer creates unique vertices for each triangle corner.
   * The main `StlIO.importMesh` method will subsequently weld coincident vertices.
   * @param stlString - The ASCII STL format string to parse.
   * @returns A new Mesh object reconstructed from the STL data (pre-welding).
   */
  static importMeshFromAscii(stlString: string): Mesh {
    const lines = stlString.split('\n').map(line => line.trim());
    let meshName = 'ImportedStlMesh';
    const mesh = new Mesh(meshName);

    let currentFacetVertices: Vector3D[] = [];
    let currentFacetNormal: Vector3D | null = null;

    for (const line of lines) {
      const parts = line.split(/\s+/);
      const keyword = parts[0];

      if (keyword === 'solid' && parts.length > 1) {
                // Sanitize name read from STL, though it should ideally be ASCII already
        mesh.name = sanitizeName(parts.slice(1).join('_'));
      } else if (keyword === 'facet' && parts[1] === 'normal') {
        currentFacetVertices = [];
        currentFacetNormal = new Vector3D(
          parseFloat(parts[2]),
          parseFloat(parts[3]),
          parseFloat(parts[4])
        );
      } else if (keyword === 'vertex' && currentFacetVertices.length < 3) {
        currentFacetVertices.push(new Vector3D(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        ));
      } else if (keyword === 'endfacet') {
        if (currentFacetVertices.length === 3 && currentFacetNormal) {
          const vIds: number[] = [];
          currentFacetVertices.forEach(pos => {
            // For STL, normals are per-face, not per-vertex. Vertices in Mesh can store normals,
            // but for direct STL import, we might leave vertex normals undefined or use face normal.
            // Here, we pass the face normal to be potentially used by the Vertex if it's the first face using it.
            // Or, more simply, add vertex without normal, and set face normal explicitly.
            const vertex = mesh.addVertex(pos.x, pos.y, pos.z /*, currentFacetNormal */);
            vIds.push(vertex.id);
          });
          const newFace = mesh.addFace(vIds);
          if (newFace && currentFacetNormal) {
            newFace.normal = currentFacetNormal; // Assign the parsed normal to the face
          }
        } else {
          console.warn('STL Import: Incomplete facet data. Skipping.');
        }
        currentFacetVertices = [];
        currentFacetNormal = null;
      } else if (keyword === 'endsolid') {
        break; // End of solid data
      }
    }
    return mesh;
  }

  /**
   * Exports a Mesh object to a binary STL format ArrayBuffer.
   * All faces will be triangulated.
   * Degenerate faces will be skipped.
   * @param mesh - The Mesh object to export.
   * @returns An ArrayBuffer containing the binary STL data.
   */
  static exportMeshToBinary(mesh: Mesh): ArrayBuffer {
    const triangles: { normal: Vector3D, v0: Vector3D, v1: Vector3D, v2: Vector3D }[] = [];

    mesh.faces.forEach(face => {
      const normal = face.normal ?? face.calculateNormal();
      if (!normal) {
        console.warn(`Face ID ${face.id} is degenerate or could not calculate a normal. Skipping in binary STL export.`);
        return;
      }

      const vertices = face.vertices;
      if (vertices.length < 3) {
        console.warn(`Face ID ${face.id} has less than 3 vertices. Skipping face.`);
        return;
      }

      for (let i = 0; i < vertices.length - 2; i++) {
        triangles.push({
          normal: normal,
          v0: vertices[0].position,
          v1: vertices[i + 1].position,
          v2: vertices[i + 2].position,
        });
      }
    });

    const numTriangles = triangles.length;
    const bufferSize = 80 + 4 + (numTriangles * 50);
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Header (80 bytes) - can be empty or a description
    const headerText = sanitizeName(`Binary STL export by 3d-react-3dedit-core - ${mesh.name || 'ExportedMesh'}`).substring(0, 80);
    for (let i = 0; i < 80; i++) {
      if (i < headerText.length) {
        view.setUint8(offset + i, headerText.charCodeAt(i));
      } else {
        view.setUint8(offset + i, 0); // Pad with null characters
      }
    }
    offset += 80;

    // Number of triangles (4 bytes, uint32_t)
    view.setUint32(offset, numTriangles, true); // true for little-endian
    offset += 4;

    // Triangles (50 bytes each)
    triangles.forEach(tri => {
      // Normal (3 floats, 12 bytes)
      view.setFloat32(offset, tri.normal.x, true); offset += 4;
      view.setFloat32(offset, tri.normal.y, true); offset += 4;
      view.setFloat32(offset, tri.normal.z, true); offset += 4;

      // Vertex 1 (3 floats, 12 bytes)
      view.setFloat32(offset, tri.v0.x, true); offset += 4;
      view.setFloat32(offset, tri.v0.y, true); offset += 4;
      view.setFloat32(offset, tri.v0.z, true); offset += 4;

      // Vertex 2 (3 floats, 12 bytes)
      view.setFloat32(offset, tri.v1.x, true); offset += 4;
      view.setFloat32(offset, tri.v1.y, true); offset += 4;
      view.setFloat32(offset, tri.v1.z, true); offset += 4;

      // Vertex 3 (3 floats, 12 bytes)
      view.setFloat32(offset, tri.v2.x, true); offset += 4;
      view.setFloat32(offset, tri.v2.y, true); offset += 4;
      view.setFloat32(offset, tri.v2.z, true); offset += 4;

      // Attribute byte count (2 bytes, uint16_t) - usually 0
      view.setUint16(offset, 0, true); offset += 2;
    });

    return buffer;
  }

  /**
   * Imports a Mesh object from a binary STL format ArrayBuffer.
   * Note: This basic importer creates unique vertices for each triangle corner.
   * A separate vertex welding utility would be needed to optimize the mesh.
   * @param buffer - The ArrayBuffer containing the binary STL data.
   * @returns A new Mesh object reconstructed from the STL data.
   * @throws Error if the buffer is too small or appears malformed.
   */
    /**
   * Imports a Mesh object from a binary STL format ArrayBuffer.
   * Note: STL format inherently does not share vertices between triangles.
   * This importer creates unique vertices for each triangle corner.
   * For a topologically connected mesh, use a vertex welding utility after import.
   * (TODO: Implement and export `weldVertices(mesh: Mesh, epsilon = 1e-6): Mesh`)
   * @param buffer - The ArrayBuffer containing the binary STL data.
   * @returns A new Mesh object reconstructed from the STL data.
   * @throws Error if the buffer is too small or appears malformed.
   */
  /**
   * Imports a Mesh object from a binary STL format ArrayBuffer.
   * Note: STL format inherently does not share vertices between triangles.
   * This importer creates unique vertices for each triangle corner.
   * For a topologically connected mesh, use a vertex welding utility after import.
   * (TODO: Implement and export `weldVertices(mesh: Mesh, epsilon = 1e-6): Mesh`)
   * @param buffer - The ArrayBuffer containing the binary STL data.
   * @returns A new Mesh object reconstructed from the STL data.
   * @throws Error if the buffer is too small or appears malformed.
   */
  static importMeshFromBinary(buffer: ArrayBuffer): Mesh {
    const view = new DataView(buffer);
    let offset = 0;

    // Header (80 bytes)
    let header = '';
    for (let i = 0; i < 80; i++) {
      const charCode = view.getUint8(offset + i);
      if (charCode === 0) break; // Stop at null terminator if present
      header += String.fromCharCode(charCode);
    }
    offset += 80;

    if (offset + 4 > buffer.byteLength) {
      throw new Error('Invalid STL binary file: too short for triangle count.');
    }

    // Number of triangles (4 bytes, uint32_t)
    const numTriangles = view.getUint32(offset, true); // true for little-endian
    offset += 4;

    const expectedByteLength = 80 + 4 + (numTriangles * 50);
    if (buffer.byteLength < expectedByteLength) {
      throw new Error(
        `Invalid STL binary file: expected ${expectedByteLength} bytes for ${numTriangles} triangles, but got ${buffer.byteLength} bytes.`
      );
    }

    // Attempt to use a name from the header, or default
        const meshName = header.trim().length > 0 ? sanitizeName(header.trim()) : 'ImportedBinaryStlMesh';
    const mesh = new Mesh(meshName);

    for (let i = 0; i < numTriangles; i++) {
      if (offset + 50 > buffer.byteLength) {
        throw new Error(`Invalid STL binary file: unexpected end of file while reading triangle ${i + 1}.`);
      }
      // Normal (3 floats, 12 bytes)
      const normal = new Vector3D(
        view.getFloat32(offset, true),      // Nx
        view.getFloat32(offset + 4, true),  // Ny
        view.getFloat32(offset + 8, true)   // Nz
      );
      offset += 12;

      // Vertex 1 (3 floats, 12 bytes)
      const v1Pos = new Vector3D(
        view.getFloat32(offset, true),      // V1x
        view.getFloat32(offset + 4, true),  // V1y
        view.getFloat32(offset + 8, true)   // V1z
      );
      offset += 12;

      // Vertex 2 (3 floats, 12 bytes)
      const v2Pos = new Vector3D(
        view.getFloat32(offset, true),      // V2x
        view.getFloat32(offset + 4, true),  // V2y
        view.getFloat32(offset + 8, true)   // V2z
      );
      offset += 12;

      // Vertex 3 (3 floats, 12 bytes)
      const v3Pos = new Vector3D(
        view.getFloat32(offset, true),      // V3x
        view.getFloat32(offset + 4, true),  // V3y
        view.getFloat32(offset + 8, true)   // V3z
      );
      offset += 12;

      // Attribute byte count (2 bytes, uint16_t) - typically ignored
      // const attributeByteCount = view.getUint16(offset, true);
      offset += 2;

      // Add vertices and face
      const v1 = mesh.addVertex(v1Pos.x, v1Pos.y, v1Pos.z);
      const v2 = mesh.addVertex(v2Pos.x, v2Pos.y, v2Pos.z);
      const v3 = mesh.addVertex(v3Pos.x, v3Pos.y, v3Pos.z);
      const newFace = mesh.addFace([v1.id, v2.id, v3.id]);
      
      if (newFace) {
        newFace.normal = normal; // Assign the parsed normal to the face
      }
    }

    return mesh;
  }
}
