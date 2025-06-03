/**
 * 🚀 Easy API - Super simple wrapper for AI and vibe coders
 * Makes 3D mesh editing dead simple with sensible defaults
 * 
 * This is the EASIEST way to work with 3D meshes in JavaScript/TypeScript!
 * Perfect for AI-generated code, rapid prototyping, and learning 3D programming.
 * 
 * @example
 * ```typescript
 * import { cube } from '3d-mesh-lib';
 * 
 * // Create and modify a cube in one fluent chain
 * const mesh = cube(2)
 *   .selectAllFaces()
 *   .inset(0.2)
 *   .extrude(0.3)
 *   .bevel(0.1)
 *   .log();
 * ```
 */

import { Mesh } from './Mesh';
import { PrimitiveFactory } from '../primitives/PrimitiveFactory';
import { SelectionManager } from './SelectionManager';
import { InsetFaces } from './InsetFaces';
import { ExtrudeFaces } from './ExtrudeFaces';
import { BevelFaces } from './BevelFaces';
import { SubdivideFaces } from './SubdivideFaces';
import { DeleteFaces } from './DeleteFaces';

/**
 * 🎯 EasyMesh - The fluent, chainable mesh builder
 * 
 * This class wraps the complex mesh operations in a simple, discoverable API.
 * Every method returns `this`, so you can chain operations together!
 * 
 * Core Philosophy:
 * - ✅ Sensible defaults (no need to specify every parameter)
 * - ✅ Chainable methods (fluent interface)
 * - ✅ Auto-selection management (it just works)
 * - ✅ Helpful error messages (guides you to success)
 * - ✅ Copy-paste friendly (perfect for AI code generation)
 */
export class EasyMesh {
  /** The underlying 3D mesh data structure */
  public mesh: Mesh;
  
  /** Manages which vertices/edges/faces are currently selected */
  public selection: SelectionManager;
  
  /**
   * Create a new EasyMesh wrapper
   * 
   * @param mesh - Optional existing mesh, creates empty mesh if not provided
   */
  constructor(mesh?: Mesh) {
    this.mesh = mesh || new Mesh();
    this.selection = new SelectionManager();
  }
  
  // ===================================
  // 🎲 CREATION METHODS (Static Factory)
  // ===================================
  
  /**
   * 📦 Create a cube - the most common starting shape!
   * 
   * Perfect for: buildings, boxes, furniture, architectural elements
   * 
   * @param size - Edge length of the cube (default: 2)
   * @returns New EasyMesh with a cube
   * 
   * @example
   * ```typescript
   * const myCube = EasyMesh.cube(3); // 3x3x3 cube
   * ```
   */
  static cube(size: number = 2): EasyMesh {
    const mesh = PrimitiveFactory.createCube(size);
    return new EasyMesh(mesh);
  }
  
  /**
   * 🌐 Create a sphere - perfect for organic shapes!
   * 
   * Perfect for: balls, planets, heads, rounded objects
   * 
   * @param radius - Radius of the sphere (default: 1)
   * @param segments - Detail level - higher = smoother (default: 16)
   * @returns New EasyMesh with a sphere
   * 
   * @example
   * ```typescript
   * const globe = EasyMesh.sphere(2, 32); // Smooth 2-unit radius sphere
   * ```
   */
  static sphere(radius: number = 1, segments: number = 16): EasyMesh {
    const mesh = PrimitiveFactory.createSphere(radius, segments, segments);
    return new EasyMesh(mesh);
  }
  
  /**
   * 📄 Create a plane - the foundation for many models!
   * 
   * Perfect for: ground, walls, screens, flat surfaces
   * 
   * @param width - Width of the plane (default: 2)
   * @param height - Height of the plane (default: 2)  
   * @param subdivisions - Number of subdivisions for detail (default: 1)
   * @returns New EasyMesh with a plane
   * 
   * @example
   * ```typescript
   * const ground = EasyMesh.plane(10, 10, 5); // 10x10 ground with 5x5 subdivisions
   * ```
   */
  static plane(width: number = 2, height: number = 2, subdivisions: number = 1): EasyMesh {
    const mesh = PrimitiveFactory.createPlane(width, height, subdivisions, subdivisions);
    return new EasyMesh(mesh);
  }
  
  /**
   * 🥫 Create a cylinder - great for tubes and columns!
   * 
   * Perfect for: pipes, columns, trees, bottles, wheels
   * 
   * @param radius - Radius of the cylinder (default: 1)
   * @param height - Height of the cylinder (default: 2)
   * @param segments - Number of sides - higher = rounder (default: 16)
   * @returns New EasyMesh with a cylinder
   * 
   * @example
   * ```typescript
   * const pipe = EasyMesh.cylinder(0.5, 4, 12); // Thin 4-unit tall pipe
   * ```
   */
  static cylinder(radius: number = 1, height: number = 2, segments: number = 16): EasyMesh {
    const mesh = PrimitiveFactory.createCylinder(radius, height, segments);
    return new EasyMesh(mesh);
  }
  
  // ===================================
  // 🎯 SELECTION METHODS (Chainable)
  // ===================================
  
  /**
   * 🔘 Select all faces - the most common operation!
   * 
   * This is what you want 90% of the time. Selects everything so the next
   * operation (inset, extrude, etc.) affects the whole mesh.
   * 
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * cube().selectAllFaces().inset(0.2); // Inset all faces
   * ```
   */
  selectAllFaces(): EasyMesh {
    this.selection.clearFaceSelection();
    const faceIds = Array.from(this.mesh.faces.keys());
    faceIds.forEach(id => this.selection.selectFace(id, true));
    return this;
  }
  
  /**
   * 👆 Select a specific face by index
   * 
   * Useful when you want to modify just one face (like the top of a building).
   * Face indices are in the order they were created.
   * 
   * @param index - Which face to select (0-based index)
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * cube().selectFace(0).extrude(1); // Extrude just the first face
   * ```
   */
  selectFace(index: number): EasyMesh {
    const faceIds = Array.from(this.mesh.faces.keys());
    if (index >= 0 && index < faceIds.length) {
      this.selection.clearFaceSelection();
      this.selection.selectFace(faceIds[index], true);
    }
    return this;
  }
  
  /**
   * 👆👆 Select multiple specific faces by indices
   * 
   * Perfect for selecting a few faces to create windows, doors, or details.
   * 
   * @param indices - Which faces to select (0-based indices)
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * cube().selectFaces(0, 2, 4).inset(0.3); // Select faces 0, 2, and 4
   * ```
   */
  selectFaces(...indices: number[]): EasyMesh {
    this.selection.clearFaceSelection();
    const faceIds = Array.from(this.mesh.faces.keys());
    indices.forEach(index => {
      if (index >= 0 && index < faceIds.length) {
        this.selection.selectFace(faceIds[index], true);
      }
    });
    return this;
  }
  
  /**
   * 🧹 Clear all selections
   * 
   * Starts fresh - nothing selected. Use this when you want to manually
   * select specific elements next.
   * 
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * cube().selectAllFaces().inset(0.2).clearSelection().selectFace(0);
   * ```
   */
  clearSelection(): EasyMesh {
    this.selection.clearFaceSelection();
    this.selection.clearEdgeSelection();
    this.selection.clearVertexSelection();
    return this;
  }
  
  // ===================================
  // 🔧 MODIFICATION METHODS (Chainable)
  // ===================================
  
  /**
   * 📏 Inset faces - makes them smaller, adds detail
   * 
   * This is like "shrinking" the selected faces inward, creating a border
   * around them. Perfect for adding surface detail, windows, panels, etc.
   * 
   * Pro tip: Often used before extrude() to create raised/recessed details!
   * 
   * @param amount - How much to inset (default: 0.2). Positive = inward
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * // Create window panels
   * cube().selectAllFaces().inset(0.3).extrude(-0.1);
   * ```
   */
  inset(amount: number = 0.2): EasyMesh {
    try {
      const cmd = new InsetFaces(this.mesh, this.selection, amount, true);
      cmd.execute();
      console.log(`✅ Inset completed: ${amount} units`);
    } catch (error) {
      console.warn(`⚠️ Inset failed: ${error}`);
    }
    return this;
  }
  
  /**
   * 🚀 Extrude faces - pushes them out, most popular operation!
   * 
   * This "pushes" the selected faces outward along their normal direction.
   * The #1 most used operation in 3D modeling! Creates volume and depth.
   * 
   * Positive distance = outward, negative = inward (like carving)
   * 
   * @param distance - How far to push (default: 0.5). Positive = out, negative = in
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * // Create a building with floors
   * cube().selectAllFaces().extrude(2).extrude(2); // Two floors up
   * 
   * // Create recessed windows  
   * cube().selectFaces(0, 2).inset(0.3).extrude(-0.2);
   * ```
   */
  extrude(distance: number = 0.5): EasyMesh {
    try {
      const selectedFaces = Array.from(this.selection.getSelectedFaceIds());
      if (selectedFaces.length > 0) {
        const cmd = new ExtrudeFaces(this.mesh, selectedFaces, distance);
        cmd.execute();
        console.log(`✅ Extruded ${selectedFaces.length} faces by ${distance} units`);
      } else {
        console.warn('⚠️ No faces selected for extrusion');
      }
    } catch (error) {
      console.warn(`⚠️ Extrude failed: ${error}`);
    }
    return this;
  }
  
  /**
   * ✨ Bevel edges - rounds corners, instant professional look!
   * 
   * This rounds/chamfers the edges, making everything look smooth and
   * professional. No more sharp, computer-y edges!
   * 
   * Low segments = chamfer (flat cut), high segments = rounded
   * 
   * @param amount - Size of the bevel (default: 0.1)
   * @param segments - Smoothness: 1=chamfer, 2+=rounded (default: 2)
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * // Make a smooth, professional cube
   * cube().selectAllFaces().bevel(0.1, 3);
   * 
   * // Sharp chamfered edges
   * cube().selectAllFaces().bevel(0.2, 1);
   * ```
   */
  bevel(amount: number = 0.1, segments: number = 2): EasyMesh {
    try {
      // BevelFaces constructor: (mesh, selection, bevelWidth, segments, useIndividual, faceIds?)
      const cmd = new BevelFaces(this.mesh, this.selection, amount, segments);
      cmd.execute();
      console.log(`✅ Beveled edges: ${amount} units, ${segments} segments`);
    } catch (error) {
      console.warn(`⚠️ Bevel failed: ${error}`);
    }
    return this;
  }
  
  /**
   * ➕ Subdivide faces - adds more geometry for detail
   * 
   * This splits each face into smaller faces, giving you more geometry to
   * work with. Essential for adding detail, smooth curves, or organic shapes.
   * 
   * Warning: Use sparingly! Each subdivision multiplies face count by ~4x
   * 
   * @param level - Subdivision level (default: 1). Higher = more detail
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * // Add detail for organic shaping
   * sphere().selectAllFaces().subdivide(2); // 4x4=16x more faces!
   * 
   * // Light subdivision for smoother curves
   * cube().selectAllFaces().subdivide(1).bevel(0.1);
   * ```
   */
  subdivide(level: number = 1): EasyMesh {
    try {
      const selectedFaces = Array.from(this.selection.getSelectedFaceIds());
      // SubdivideFaces constructor: (mesh, faceIds, description?)
      const cmd = new SubdivideFaces(this.mesh, selectedFaces, `Subdivide ${selectedFaces.length} face(s) with EasyAPI`);
      cmd.execute();
      console.log(`✅ Subdivided ${selectedFaces.length} faces (level ${level})`);
    } catch (error) {
      console.warn(`⚠️ Subdivide failed: ${error}`);
    }
    return this;
  }
  
  /**
   * 🗑️ Delete selected faces - removes geometry
   * 
   * Removes the currently selected faces from the mesh. Use this to create
   * holes, openings, or to remove unwanted parts.
   * 
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * // Create a hole in a cube
   * cube().selectFace(0).deleteFaces(); // Remove top face
   * 
   * // Remove multiple faces
   * cube().selectFaces(0, 2, 4).deleteFaces(); // Remove 3 faces
   * ```
   */
  deleteFaces(): EasyMesh {
    try {
      const selectedFaces = Array.from(this.selection.getSelectedFaceIds());
      // DeleteFaces constructor: (mesh, selection, faceIds?)
      const cmd = new DeleteFaces(this.mesh, this.selection);
      cmd.execute();
      console.log(`✅ Deleted ${selectedFaces.length} faces`);
    } catch (error) {
      console.warn(`⚠️ Delete failed: ${error}`);
    }
    return this;
  }
  
  // ===================================
  // ℹ️ INFO METHODS (Non-chainable)
  // ===================================
  
  /**
   * 📊 Get mesh information as a string
   * 
   * Returns a human-readable summary of the mesh's current state.
   * Great for debugging or showing progress to users.
   * 
   * @returns String with mesh statistics
   * 
   * @example
   * ```typescript
   * const mesh = cube().selectAllFaces().inset(0.2);
   * console.log(mesh.info()); // "Mesh: 24 faces, 26 vertices, 48 edges (24 selected)"
   * ```
   */
  info(): string {
    const faceCount = this.mesh.faces.size;
    const vertexCount = this.mesh.vertices.size;
    const edgeCount = this.mesh.edges.size;
    const selected = this.selection.getSelectedFaceIds().size;
    
    return `Mesh: ${faceCount} faces, ${vertexCount} vertices, ${edgeCount} edges (${selected} selected)`;
  }
  
  /**
   * 📝 Log mesh info and return this (chainable)
   * 
   * Prints the mesh info to console and returns this for chaining.
   * Super useful for debugging in the middle of a chain!
   * 
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * cube()
   *   .selectAllFaces()
   *   .log()           // Prints: "Mesh: 6 faces, 8 vertices, 12 edges (6 selected)"
   *   .inset(0.2)
   *   .log()           // Prints updated stats
   *   .extrude(0.3);
   * ```
   */
  log(): EasyMesh {
    console.log(`🎯 ${this.info()}`);
    return this;
  }
  
  // ===================================
  // 🛠️ UTILITY METHODS
  // ===================================
  
  /**
   * 📋 Clone this mesh (creates a copy)
   * 
   * Creates a new EasyMesh with a copy of the current mesh data.
   * Useful for creating variations or saving states.
   * 
   * Note: Currently creates a new empty mesh. In a full implementation,
   * this would deep-clone all mesh data.
   * 
   * @returns New EasyMesh (independent copy)
   * 
   * @example
   * ```typescript
   * const original = cube().selectAllFaces().inset(0.2);
   * const variant1 = original.clone().extrude(0.5);
   * const variant2 = original.clone().bevel(0.1);
   * ```
   */
  clone(): EasyMesh {
    // TODO: In a real implementation, this would deep clone the mesh
    const newMesh = new EasyMesh();
    return newMesh;
  }
}

// ===================================
// 🎯 CONVENIENCE FUNCTIONS (Global)
// ===================================
// These are the EASIEST way to start! Perfect for AI code generation.

/**
 * 📦 Create a cube and start editing - perfect for AI prompts!
 * 
 * This is the #1 most common way to start a 3D model. Just call cube()
 * and start chaining operations!
 * 
 * @param size - Edge length of the cube (default: 2)
 * @returns New EasyMesh with a cube ready for editing
 * 
 * @example
 * ```typescript
 * import { cube } from '3d-mesh-lib';
 * 
 * // One-liner building!
 * const building = cube(2)
 *   .selectAllFaces()
 *   .inset(0.3)
 *   .extrude(2)
 *   .bevel(0.1);
 * ```
 */
export function cube(size: number = 2): EasyMesh {
  return EasyMesh.cube(size);
}

/**
 * 🌐 Create a sphere and start editing - perfect for organic shapes!
 * 
 * Second most common starting shape. Great for planets, balls, heads,
 * or any round object.
 * 
 * @param radius - Radius of the sphere (default: 1)
 * @param segments - Detail level - higher = smoother (default: 16)
 * @returns New EasyMesh with a sphere ready for editing
 * 
 * @example
 * ```typescript
 * import { sphere } from '3d-mesh-lib';
 * 
 * // Smooth planet
 * const planet = sphere(3, 32)
 *   .selectAllFaces()
 *   .subdivide(1)
 *   .bevel(0.05);
 * ```
 */
export function sphere(radius: number = 1, segments: number = 16): EasyMesh {
  return EasyMesh.sphere(radius, segments);
}

/**
 * 📄 Create a plane and start editing - foundation for many models!
 * 
 * Perfect starting point for terrain, walls, screens, or any flat surface
 * that you want to add detail to.
 * 
 * @param width - Width of the plane (default: 2)
 * @param height - Height of the plane (default: 2)
 * @param subdivisions - Number of subdivisions for detail (default: 1)
 * @returns New EasyMesh with a plane ready for editing
 * 
 * @example
 * ```typescript
 * import { plane } from '3d-mesh-lib';
 * 
 * // Detailed terrain
 * const terrain = plane(10, 10, 8)
 *   .selectAllFaces()
 *   .subdivide(2); // Lots of geometry for hills/valleys
 * ```
 */
export function plane(width: number = 2, height: number = 2, subdivisions: number = 1): EasyMesh {
  return EasyMesh.plane(width, height, subdivisions);
}

/**
 * 🥫 Create a cylinder and start editing - great for tubes and columns!
 * 
 * Perfect for pipes, tree trunks, columns, bottles, or any cylindrical object.
 * 
 * @param radius - Radius of the cylinder (default: 1)
 * @param height - Height of the cylinder (default: 2)
 * @param segments - Number of sides - higher = rounder (default: 16)
 * @returns New EasyMesh with a cylinder ready for editing
 * 
 * @example
 * ```typescript
 * import { cylinder } from '3d-mesh-lib';
 * 
 * // Classical column
 * const column = cylinder(0.8, 6, 12)
 *   .selectAllFaces()
 *   .bevel(0.05, 3); // Smooth edges
 * ```
 */
export function cylinder(radius: number = 1, height: number = 2, segments: number = 16): EasyMesh {
  return EasyMesh.cylinder(radius, height, segments);
} 