import { Mesh } from '@/core/Mesh';
import { Vector3D } from '@/utils/Vector3D';
import type { Vertex } from '@/core/Vertex'; // For type reference, not direct instantiation in export
import type { Material } from '@/core/Material';

/**
 * Handles import and export of Mesh objects to/from the Wavefront OBJ format.
 */
export class ObjIO {
  /**
   * Exports a Mesh object to an OBJ format string.
   * @param mesh - The Mesh object to export.
   * @returns An OBJ format string representing the mesh.
   */
  /**
   * Exports a Mesh object to an OBJ format string and optionally generates an MTL string.
   * @param mesh - The Mesh object to export.
   * @param mtlFileName - Optional name for the MTL file to be referenced in the OBJ. Defaults to `mesh.name + '.mtl'` if materials exist.
   * @returns An object containing the OBJ string and the MTL string (or null if no materials).
   */
  static exportMesh(mesh: Mesh, mtlFileName?: string): { obj: string, mtl: string | null } {
    const mtlString = ObjIO.generateMtlString(mesh);
    let actualMtlFileName: string | undefined = undefined;

    if (mtlString) {
      actualMtlFileName = mtlFileName || `${mesh.name}.mtl`;
    }
    let objString = `# Exported by @yourlib/core
`;
    objString += `# Mesh Name: ${mesh.name}
`;
    objString += `o ${mesh.name}\n`;
    if (actualMtlFileName) {
      objString += `mtllib ${actualMtlFileName}\n`;
    }
    objString += `\n`;

    const vertices: Vector3D[] = [];
    const normals: Vector3D[] = [];
    const uvs: { u: number; v: number }[] = [];

    // Map our vertex IDs to 1-based OBJ indices for v, vn, vt
    const vIndexMap = new Map<number, number>();
    const vnIndexMap = new Map<number, number>();
    const vtIndexMap = new Map<number, number>();

    let vCount = 1;
    let vnCount = 1;
    let vtCount = 1;

    mesh.vertices.forEach(vertex => {
      vertices.push(vertex.position);
      objString += `v ${vertex.position.x.toFixed(6)} ${vertex.position.y.toFixed(6)} ${vertex.position.z.toFixed(6)}\n`;
      vIndexMap.set(vertex.id, vCount++);

      if (vertex.normal) {
        // Check if this normal is already listed to avoid duplicates (optional optimization)
        normals.push(vertex.normal);
        objString += `vn ${vertex.normal.x.toFixed(6)} ${vertex.normal.y.toFixed(6)} ${vertex.normal.z.toFixed(6)}\n`;
        vnIndexMap.set(vertex.id, vnCount++); // Simple mapping for now, assumes one normal per vertex ID
      }
      if (vertex.uv) {
        uvs.push(vertex.uv);
        objString += `vt ${vertex.uv.u.toFixed(6)} ${vertex.uv.v.toFixed(6)}\n`;
        vtIndexMap.set(vertex.id, vtCount++); // Simple mapping, assumes one UV per vertex ID
      }
    });

    objString += `\n`;

    let currentMaterialName: string | null = null;

    mesh.faces.forEach(face => {
      if (face.materialIndex !== null && face.materialIndex !== undefined && mesh.materials.has(face.materialIndex)) {
        const material = mesh.materials.get(face.materialIndex)!;
        if (material.name !== currentMaterialName) {
          objString += `usemtl ${material.name.replace(/\s+/g, '_')}\n`; // Ensure material name is valid for OBJ
          currentMaterialName = material.name;
        }
      }
      objString += `f`;
      face.vertices.forEach(vertex => {
        const vIdxVal = vIndexMap.get(vertex.id);

        if (vIdxVal === undefined) {
          // This should ideally not happen if mesh and maps are consistent
          console.warn(`OBJ Exporter: Vertex ID ${vertex.id} not found in vIndexMap. Skipping vertex in face.`);
          return; // Skip this vertex component
        }

        let faceVertexString = ` ${vIdxVal}`;

        let vtIdxVal: number | undefined;
        if (vertex.uv) {
          vtIdxVal = vtIndexMap.get(vertex.id);
        }

        let vnIdxVal: number | undefined;
        if (vertex.normal) {
          vnIdxVal = vnIndexMap.get(vertex.id);
        }

        if (vtIdxVal !== undefined && vnIdxVal !== undefined) {
          faceVertexString += `/${vtIdxVal}/${vnIdxVal}`;
        } else if (vtIdxVal !== undefined) {
          faceVertexString += `/${vtIdxVal}`;
        } else if (vnIdxVal !== undefined) {
          faceVertexString += `//${vnIdxVal}`;
        }
        objString += faceVertexString;
      });
      objString += `\n`;
    });

    return { obj: objString, mtl: mtlString };
  }

  /**
   * Imports a Mesh object from an OBJ format string.
   * @param objString - The OBJ format string to parse.
   * @param meshName - Optional name for the imported mesh if not found in OBJ.
   * @returns A new Mesh object reconstructed from the OBJ data.
   */
  /**
   * Generates an MTL format string from the materials in a Mesh.
   * @param mesh - The Mesh object containing materials.
   * @returns An MTL format string, or null if the mesh has no materials.
   */
  static generateMtlString(mesh: Mesh): string | null {
    if (mesh.materials.size === 0) {
      return null;
    }

    let mtlContent = `# MTL Library generated by @yourlib/core
`;
    mtlContent += `# Mesh Name: ${mesh.name}\n\n`;

    mesh.materials.forEach(material => {
      const matName = material.name.replace(/\s+/g, '_'); // OBJ/MTL names shouldn't have spaces
      mtlContent += `newmtl ${matName}\n`;
      // Ambient Color (Ka) - using diffuse color
      mtlContent += `Ka ${material.color.x.toFixed(4)} ${material.color.y.toFixed(4)} ${material.color.z.toFixed(4)}\n`;
      // Diffuse Color (Kd)
      mtlContent += `Kd ${material.color.x.toFixed(4)} ${material.color.y.toFixed(4)} ${material.color.z.toFixed(4)}\n`;
      // Specular Color (Ks) - default to gray, or could be derived if PBR metallic is high
      // For simplicity, using a moderate gray. Could also be material.color if non-metallic.
      const specularColor = new Vector3D(0.5, 0.5, 0.5); // Default specular
      mtlContent += `Ks ${specularColor.x.toFixed(4)} ${specularColor.y.toFixed(4)} ${specularColor.z.toFixed(4)}\n`;
      // Emissive Color (Ke)
      mtlContent += `Ke ${material.emissiveColor.x.toFixed(4)} ${material.emissiveColor.y.toFixed(4)} ${material.emissiveColor.z.toFixed(4)}\n`;
      // Specular Exponent (Ns) - PBR roughness could be mapped to Ns. Higher roughness = lower Ns.
      // Ns = (2 / roughness^4) - 2. Clamped. Or simpler: (1-roughness)*255. Max Ns is 1000 for OBJ.
      const ns = Math.min(1000, Math.max(2, (2 / Math.pow(material.roughness + 0.001, 4)) - 2)); // Avoid div by zero
      mtlContent += `Ns ${ns.toFixed(2)}\n`;
      // Opacity (d)
      mtlContent += `d ${material.opacity.toFixed(4)}\n`;
      // Illumination model (illum)
      // 0: Color on and Ambient off
      // 1: Color on and Ambient on
      // 2: Highlight on (diffuse and specular shading)
      // ... many more, 2 is common for standard materials
      mtlContent += `illum 2\n`;
      // Could add Ni (optical density/index of refraction) if available
      // Could add map_Kd, map_Ks, map_Bump etc. if textures were supported
      mtlContent += `\n`;
    });

    return mtlContent;
  }

  /**
   * Imports a Mesh object from an OBJ format string.
   * @param objString - The OBJ format string to parse.
   * @param meshName - Optional name for the imported mesh if not found in OBJ.
   * @returns A new Mesh object reconstructed from the OBJ data.
   * @remarks Material import (from .mtl) is not yet supported.
   */
  static importMesh(objString: string, meshName: string = 'ImportedObjMesh'): Mesh {
    const mesh = new Mesh(meshName);

    const geoVertices: Vector3D[] = [];
    const texCoords: { u: number; v: number; w?: number }[] = []; // OBJ supports 3D tex coords
    const normals: Vector3D[] = [];

    // Map from OBJ face corner string (e.g., "v/vt/vn") to our Mesh's Vertex ID
    const cornerToVertexIdMap = new Map<string, number>();

    const lines = objString.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
        continue;
      }

      const parts = trimmedLine.split(/\s+/);
      const type = parts[0];

      switch (type) {
        case 'o':
          mesh.name = parts.length > 1 ? parts.slice(1).join(' ') : meshName;
          break;
        case 'v':
          geoVertices.push(new Vector3D(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])));
          break;
        case 'vn':
          normals.push(new Vector3D(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])));
          break;
        case 'vt':
          texCoords.push({ 
            u: parseFloat(parts[1]), 
            v: parts.length > 2 ? parseFloat(parts[2]) : 0,
            w: parts.length > 3 ? parseFloat(parts[3]) : undefined
          });
          break;
        case 'f':
          const faceVertexIds: number[] = [];
          for (let i = 1; i < parts.length; i++) {
            const cornerStr = parts[i];
            if (cornerToVertexIdMap.has(cornerStr)) {
              faceVertexIds.push(cornerToVertexIdMap.get(cornerStr)!);
            } else {
              const indices = cornerStr.split('/'); // v, v/vt, v//vn, v/vt/vn
              const vIdx = parseInt(indices[0]);
              const vtIdx = indices.length > 1 && indices[1] !== '' ? parseInt(indices[1]) : null;
              const vnIdx = indices.length > 2 && indices[2] !== '' ? parseInt(indices[2]) : null;

              // OBJ indices are 1-based, adjust to 0-based for array access
              const pos = geoVertices[vIdx - 1];
              if (!pos) throw new Error(`Invalid vertex index ${vIdx} in face definition.`);

              const uv = vtIdx !== null && texCoords[vtIdx - 1] ? { u: texCoords[vtIdx - 1].u, v: texCoords[vtIdx - 1].v } : undefined;
              const norm = vnIdx !== null && normals[vnIdx - 1] ? normals[vnIdx - 1].clone() : undefined;
              
              const newVertex = mesh.addVertex(pos.x, pos.y, pos.z, norm, uv);
              cornerToVertexIdMap.set(cornerStr, newVertex.id);
              faceVertexIds.push(newVertex.id);
            }
          }
          if (faceVertexIds.length >= 3) {
            mesh.addFace(faceVertexIds);
          } else {
            console.warn(`Skipping face with less than 3 vertices: ${trimmedLine}`);
          }
          break;
        // TODO: Handle mtllib, usemtl, g, s
        default:
          // console.warn(`OBJ keyword not currently supported: ${type}`);
          break;
      }
    }
    return mesh;
  }
}
