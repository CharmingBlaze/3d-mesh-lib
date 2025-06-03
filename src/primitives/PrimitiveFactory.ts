import { Mesh } from '@/core/Mesh';
import { Vector3D } from '@/utils/Vector3D';

/**
 * A factory class for creating primitive 3D shapes as Mesh objects.
 */
export class PrimitiveFactory {
  /**
   * Creates a cube mesh.
   * @param size - The length of each side of the cube. Defaults to 1.
   * @param center - The center point of the cube. Defaults to (0,0,0).
   * @returns A new Mesh object representing a cube.
   */
  static createCube(
    size: number = 1,
    center: Vector3D = new Vector3D(0, 0, 0),
    options?: { uniqueVerticesPerFace?: boolean; materialIndex?: number }
  ): Mesh {
    const uniqueVerticesPerFace = options?.uniqueVerticesPerFace ?? true;
    const materialIndex = options?.materialIndex;

    const mesh = new Mesh('Cube');
    const halfSize = size / 2;

    // Define the 8 unique corner positions of the cube relative to its local origin
    const corners = [
      new Vector3D(-halfSize, -halfSize, halfSize), // 0: Front-Bottom-Left
      new Vector3D(halfSize, -halfSize, halfSize),  // 1: Front-Bottom-Right
      new Vector3D(halfSize, halfSize, halfSize),   // 2: Front-Top-Right
      new Vector3D(-halfSize, halfSize, halfSize),  // 3: Front-Top-Left
      new Vector3D(-halfSize, -halfSize, -halfSize), // 4: Back-Bottom-Left
      new Vector3D(halfSize, -halfSize, -halfSize),  // 5: Back-Bottom-Right
      new Vector3D(halfSize, halfSize, -halfSize),   // 6: Back-Top-Right
      new Vector3D(-halfSize, halfSize, -halfSize)   // 7: Back-Top-Left
    ];

    // Define the UV coordinates for a single face (bottom-left, bottom-right, top-right, top-left)
    const faceUVs = [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 1, v: 1 },
      { u: 0, v: 1 },
    ];

    // Define the 6 faces of the cube. Each face has:
    // - normal: The outward normal vector of the face.
    // - cornerIndices: The indices (from the `corners` array) of the 4 vertices forming the face, in CCW order from outside.
    const faceDefinitions = [
      // Vertex indices for faces (referring to the 'corners' array)
      // Front (+Z), Back (-Z), Top (+Y), Bottom (-Y), Right (+X), Left (-X)
      { name: 'Front', normal: new Vector3D(0, 0, 1), cornerIndices: [0, 1, 2, 3] },
      { name: 'Back', normal: new Vector3D(0, 0, -1), cornerIndices: [5, 4, 7, 6] }, 
      { name: 'Top', normal: new Vector3D(0, 1, 0), cornerIndices: [3, 2, 6, 7] },   
      { name: 'Bottom', normal: new Vector3D(0, -1, 0), cornerIndices: [4, 5, 1, 0] }, 
      { name: 'Right', normal: new Vector3D(1, 0, 0), cornerIndices: [1, 5, 6, 2] },  
      { name: 'Left', normal: new Vector3D(-1, 0, 0), cornerIndices: [4, 0, 3, 7] }, 
    ];

    if (uniqueVerticesPerFace) {
      // Create 24 vertices (4 per face) for unique UVs and normals per face
      for (const faceDef of faceDefinitions) {
        const faceVertexIds: number[] = [];
        for (let i = 0; i < 4; i++) {
          const cornerIndex = faceDef.cornerIndices[i];
          const position = corners[cornerIndex];
          const uv = faceUVs[i]; // Use pre-defined UVs for this corner of the face
          
          const vertex = mesh.addVertex(
            position.x + center.x,
            position.y + center.y,
            position.z + center.z,
            faceDef.normal.clone(), // Use the specific per-face normal
            uv                      // Use the specific per-vertex UV for this face instance
          );
          faceVertexIds.push(vertex.id);
        }
        mesh.addFace(faceVertexIds, materialIndex);
      }
    } else {
      // Create 8 shared vertices
      const sharedVertexIds: number[] = [];
      for (let i = 0; i < corners.length; i++) {
        const position = corners[i];
        // For shared vertices, normal is averaged (normalized position vector if centered at origin)
        const normal = position.clone().normalize(); 
        // Basic/placeholder UVs for shared vertices
        const uv = { u: 0, v: 0 }; // Or assign more distinct basic UVs if desired, e.g. based on corner index

        const vertex = mesh.addVertex(
          position.x + center.x,
          position.y + center.y,
          position.z + center.z,
          normal,
          uv
        );
        sharedVertexIds.push(vertex.id);
      }

      // Create 6 faces using the 8 shared vertices
      for (const faceDef of faceDefinitions) {
        const faceVertexIds = faceDef.cornerIndices.map(cornerIdx => sharedVertexIds[cornerIdx]);
        mesh.addFace(faceVertexIds, materialIndex);
      }
    }

    return mesh;
  }

  /**
   * Creates a sphere mesh.
   * @param radius - The radius of the sphere. Defaults to 0.5 (for a diameter of 1).
   * @param widthSegments - Number of horizontal segments. Minimum 3. Defaults to 16.
   * @param heightSegments - Number of vertical segments. Minimum 2. Defaults to 8.
   * @param center - The center point of the sphere. Defaults to (0,0,0).
   * @returns A new Mesh object representing a sphere.
   */
  static createSphere(
    radius: number = 0.5,
    widthSegments: number = 16,
    heightSegments: number = 8,
    center: Vector3D = new Vector3D(0, 0, 0)
  ): Mesh {
    const mesh = new Mesh('Sphere');
    widthSegments = Math.max(3, Math.floor(widthSegments));
    heightSegments = Math.max(2, Math.floor(heightSegments));

    const vertexGrid: number[][] = []; // Stores vertex IDs in a grid [height][width]

    // Generate vertices
    for (let iy = 0; iy <= heightSegments; iy++) {
      const verticesRow: number[] = [];
      const v = iy / heightSegments; // Vertical progress (0 to 1)

      // let radiusModifier = Math.sin(v * Math.PI); // This variable was unused

      for (let ix = 0; ix <= widthSegments; ix++) {
        const u = ix / widthSegments; // Horizontal progress (0 to 1)

        const posX = -radius * Math.cos(u * Math.PI * 2) * Math.sin(v * Math.PI);
        const posY = radius * Math.cos(v * Math.PI);
        const posZ = radius * Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI);
        
        // TODO: Calculate normals and UVs for sphere vertices
        // For now, normals can be derived from position relative to center (normalized position)
        // UVs can be u, v
        const normal = new Vector3D(posX, posY, posZ).normalize(); // Simple normal calculation
        const uv = { u: u, v: 1 - v }; // UV mapping

        const vertex = mesh.addVertex(
          posX + center.x,
          posY + center.y,
          posZ + center.z,
          normal,
          uv
        );
        verticesRow.push(vertex.id);
      }
      vertexGrid.push(verticesRow);
    }

    // Generate faces (triangles)
    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = vertexGrid[iy][ix + 1];
        const b = vertexGrid[iy][ix];
        const c = vertexGrid[iy + 1][ix];
        const d = vertexGrid[iy + 1][ix + 1];

        if (iy !== 0) { // Not the top pole
          mesh.addFace([a, b, d]);
        }
        if (iy !== heightSegments - 1) { // Not the bottom pole
          mesh.addFace([b, c, d]);
        }
      }
    }
    return mesh;
  }

  /**
   * Creates a cylinder or cone mesh.
   * @param radiusTop - Radius of the top circle. Defaults to 0.5.
   * @param radiusBottom - Radius of the bottom circle. Defaults to 0.5.
   * @param height - Height of the cylinder. Defaults to 1.
   * @param radialSegments - Number of segments around the circumference. Minimum 3. Defaults to 16.
   * @param heightSegments - Number of segments along the height. Minimum 1. Defaults to 1.
   * @param openEnded - If true, the cylinder will not have top and bottom caps. Defaults to false.
   * @param center - The center point of the cylinder (midpoint of its height axis). Defaults to (0,0,0).
   * @returns A new Mesh object representing a cylinder or cone.
   */
  static createCylinder(
    radiusTop: number = 0.5,
    radiusBottom: number = 0.5,
    height: number = 1,
    radialSegments: number = 16,
    heightSegments: number = 1,
    openEnded: boolean = false,
    center: Vector3D = new Vector3D(0, 0, 0)
  ): Mesh {
    const mesh = new Mesh('Cylinder');
    radialSegments = Math.max(3, Math.floor(radialSegments));
    heightSegments = Math.max(1, Math.floor(heightSegments));

    const halfHeight = height / 2;
    const vertexGrid: number[][] = []; // Stores vertex IDs [heightSegment][radialSegment]
    const normals: Vector3D[] = []; // Store normals for side vertices
    const uvs: { u: number; v: number }[] = []; // Store UVs for side vertices

    // Generate vertices for the sides
    for (let y = 0; y <= heightSegments; y++) {
      const verticesRow: number[] = [];
      const v = y / heightSegments; // Vertical progress (0 to 1)
      const radius = v * (radiusBottom - radiusTop) + radiusTop;

      for (let x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments; // Horizontal progress (0 to 1)

        const posX = radius * Math.sin(u * Math.PI * 2);
        const posZ = radius * Math.cos(u * Math.PI * 2);
        const posY = -v * height + halfHeight; // Y goes from halfHeight to -halfHeight

        // Normal calculation for sides (approximated for cones)
        // For a perfect cylinder, normal.y is 0. For a cone, it points away from the axis.
        // A more accurate normal for cones would involve the slope.
        let normal = new Vector3D(Math.sin(u * Math.PI * 2), 0, Math.cos(u * Math.PI * 2));
        if (radiusTop !== radiusBottom) { // Cone or tapered cylinder
            const slope = (radiusBottom - radiusTop) / height;
            normal = new Vector3D(Math.sin(u * Math.PI * 2), slope, Math.cos(u * Math.PI * 2)).normalize();
        }
        
        const uv = { u: u, v: 1 - v }; 

        const vertex = mesh.addVertex(
          posX + center.x,
          posY + center.y,
          posZ + center.z,
          normal,
          uv
        );
        verticesRow.push(vertex.id);
        if (x < radialSegments) { // Avoid duplicating normals/uvs for the seam vertex
            normals.push(normal);
            uvs.push(uv);
        }
      }
      vertexGrid.push(verticesRow);
    }

    // Generate faces for the sides
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < radialSegments; x++) {
        const v1 = vertexGrid[y][x];
        const v2 = vertexGrid[y + 1][x];
        const v3 = vertexGrid[y + 1][x + 1];
        const v4 = vertexGrid[y][x + 1];

        mesh.addFace([v1, v2, v3, v4]);
      }
    }

    // Generate caps if not openEnded
    if (!openEnded) {
      // Top cap
      if (radiusTop > 0) {
        const topCenterVertex = mesh.addVertex(center.x, halfHeight + center.y, center.z, new Vector3D(0,1,0), {u:0.5, v:0.5});
        for (let x = 0; x < radialSegments; x++) {
          const v1 = vertexGrid[0][x];
          const v2 = vertexGrid[0][x + 1];
          mesh.addFace([topCenterVertex.id, v2, v1]); // Order for outward normal (Y-up)
        }
      }

      // Bottom cap
      if (radiusBottom > 0) {
        const bottomCenterVertex = mesh.addVertex(center.x, -halfHeight + center.y, center.z, new Vector3D(0,-1,0), {u:0.5, v:0.5});
        for (let x = 0; x < radialSegments; x++) {
          const v1 = vertexGrid[heightSegments][x + 1];
          const v2 = vertexGrid[heightSegments][x];
          mesh.addFace([bottomCenterVertex.id, v2, v1]); // Order for outward normal (Y-down)
        }
      }
    }

    return mesh;
  }

  // static createCone(radius: number, height: number, radialSegments: number, heightSegments: number, openEnded?: boolean, center?: Vector3D): Mesh // Covered by createCylinder

  /**
   * Creates a torus mesh.
   * @param radius - The distance from the center of the hole to the center of the tube. Defaults to 0.4.
   * @param tubeRadius - The radius of the tube. Defaults to 0.1.
   * @param radialSegments - Number of segments around the main ring of the torus. Minimum 3. Defaults to 16.
   * @param tubularSegments - Number of segments around the tube. Minimum 3. Defaults to 8.
   * @param arc - Angle in radians for the sweep of the torus. Defaults to 2 * PI (full torus). Minimum 0.01.
   * @param center - The center point of the torus. Defaults to (0,0,0).
   * @returns A new Mesh object representing a torus.
   */
  static createTorus(
    radius: number = 0.4,
    tubeRadius: number = 0.1,
    radialSegments: number = 16,
    tubularSegments: number = 8,
    arc: number = Math.PI * 2,
    center: Vector3D = new Vector3D(0, 0, 0)
  ): Mesh {
    const mesh = new Mesh('Torus');
    radialSegments = Math.max(3, Math.floor(radialSegments));
    tubularSegments = Math.max(3, Math.floor(tubularSegments));
    arc = Math.max(0.01, arc);

    const vertexGrid: number[][] = [];

    // Generate vertices, normals, and UVs
    for (let j = 0; j <= radialSegments; j++) {
      const verticesRow: number[] = [];
      const currentRadialAngle = (j / radialSegments) * arc;

      for (let i = 0; i <= tubularSegments; i++) {
        const currentTubularAngle = (i / tubularSegments) * Math.PI * 2;

        // Calculate vertex position
        const cosRadial = Math.cos(currentRadialAngle);
        const sinRadial = Math.sin(currentRadialAngle);
        const cosTubular = Math.cos(currentTubularAngle);
        const sinTubular = Math.sin(currentTubularAngle);

        const posX = (radius + tubeRadius * cosTubular) * cosRadial;
        const posY = tubeRadius * sinTubular;
        const posZ = (radius + tubeRadius * cosTubular) * sinRadial;

        // Calculate normal
        // The normal points outwards from the surface of the tube.
        // It can be found by taking a point on the tube's cross-section circle (ignoring main radius for a moment),
        // then rotating this point around the Y axis by the main radial angle.
        const normalX = cosTubular * cosRadial;
        const normalY = sinTubular;
        const normalZ = cosTubular * sinRadial;
        const normal = new Vector3D(normalX, normalY, normalZ).normalize(); // Normal is already normalized if tubeRadius=1

        // Calculate UVs
        const u = j / radialSegments;
        const v = i / tubularSegments;
        const uv = { u: u, v: 1 - v }; // Invert v for common texture mapping convention

        const vertex = mesh.addVertex(
          posX + center.x,
          posY + center.y,
          posZ + center.z,
          normal,
          uv
        );
        verticesRow.push(vertex.id);
      }
      vertexGrid.push(verticesRow);
    }

    // Generate faces (quads, made of two triangles)
    for (let j = 0; j < radialSegments; j++) {
      for (let i = 0; i < tubularSegments; i++) {
        const a = vertexGrid[j][i + 1];
        const b = vertexGrid[j][i];
        const c = vertexGrid[j + 1][i];
        const d = vertexGrid[j + 1][i + 1];

        mesh.addFace([a, b, d]);
        mesh.addFace([b, c, d]);
      }
    }

    return mesh;
  }

  // static createTorus(radius: number, tube: number, radialSegments: number, tubularSegments: number, arc?: number, center?: Vector3D): Mesh // Implemented above

  /**
   * Creates a plane mesh, lying in the XZ plane, facing positive Y.
   * @param width - Width of the plane (along X-axis). Defaults to 1.
   * @param depth - Depth of the plane (along Z-axis). Defaults to 1.
   * @param widthSegments - Number of segments along the width. Minimum 1. Defaults to 1.
   * @param depthSegments - Number of segments along the depth. Minimum 1. Defaults to 1.
   * @param center - The center point of the plane. Defaults to (0,0,0).
   * @returns A new Mesh object representing a plane.
   */
  static createPlane(
    width: number = 1,
    depth: number = 1,
    widthSegments: number = 1,
    depthSegments: number = 1,
    center: Vector3D = new Vector3D(0, 0, 0)
  ): Mesh {
    const mesh = new Mesh('Plane');
    widthSegments = Math.max(1, Math.floor(widthSegments));
    depthSegments = Math.max(1, Math.floor(depthSegments));

    const halfWidth = width / 2;
    const halfDepth = depth / 2;

    const segmentWidth = width / widthSegments;
    const segmentDepth = depth / depthSegments;

    const vertexGrid: number[][] = [];
    const normal = new Vector3D(0, 1, 0); // Plane faces +Y

    // Generate vertices and UVs
    for (let iz = 0; iz <= depthSegments; iz++) {
      const verticesRow: number[] = [];
      const posZ = (iz * segmentDepth) - halfDepth;
      const v = iz / depthSegments;

      for (let ix = 0; ix <= widthSegments; ix++) {
        const posX = (ix * segmentWidth) - halfWidth;
        const u = ix / widthSegments;

        const vertex = mesh.addVertex(
          posX + center.x,
          0 + center.y, // Plane is at Y=0 relative to its center
          posZ + center.z,
          normal.clone(),
          { u: u, v: 1 - v } // Invert v for common texture mapping
        );
        verticesRow.push(vertex.id);
      }
      vertexGrid.push(verticesRow);
    }

    // Generate faces (quads, made of two triangles)
    for (let iz = 0; iz < depthSegments; iz++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = vertexGrid[iz][ix];
        const b = vertexGrid[iz + 1][ix];
        const c = vertexGrid[iz + 1][ix + 1];
        const d = vertexGrid[iz][ix + 1];

        mesh.addFace([a, b, c, d]); // Counter-clockwise for +Y normal
      }
    }

    return mesh;
  }

  // TODO: Implement other primitive creation methods:
  // static createPlane(width: number, height: number, widthSegments?: number, heightSegments?: number, center?: Vector3D): Mesh
  // static createCustomPoly(points: Vector3D[], center?: Vector3D): Mesh // For a 2D polygon extruded or as a flat mesh
}
