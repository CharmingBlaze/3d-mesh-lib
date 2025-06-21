/**
 * 🚀 EasyAPI Demo - Shows the super simple API for AI coders
 * This demonstrates the fluent, chainable interface that makes 3D modeling easy!
 */

import { cube, sphere, plane, cylinder, EasyMesh } from '../src/index';

console.log('🎯 3D-Mesh-Lib - EasyAPI Demo\n');

// ===================================
// 🎲 1. SHAPE CREATION (One-liners!)
// ===================================
console.log('🎲 1. Creating shapes with EasyAPI...\n');

// The easiest way to start - just call the function!
const myCube = cube(2);
const myBall = sphere(1.5, 16);
const ground = plane(10, 10, 4);
const pillar = cylinder(0.5, 3, 12);

console.log(`📦 Cube: ${myCube.info()}`);
console.log(`🌐 Sphere: ${myBall.info()}`);
console.log(`📄 Plane: ${ground.info()}`);
console.log(`🥫 Cylinder: ${pillar.info()}\n`);

// ===================================
// 🔗 2. CHAINABLE OPERATIONS (The magic!)
// ===================================
console.log('🔗 2. Chainable operations - this is where it gets fun!\n');

// Create a detailed cube in one beautiful chain
console.log('→ Creating detailed cube with method chaining...');
const detailedCube = cube(2)
  .selectAllFaces()    // Select everything
  .log()               // Print current state (6 faces selected)
  .inset(0.3)          // Make faces smaller (adds detail)
  .log()               // Print after inset (24 faces now!)
  .extrude(0.2)        // Push the inset faces out
  .log()               // Print final result
  .bevel(0.1, 2);      // Round the edges (professional look!)

console.log(`Final detailed cube: ${detailedCube.info()}\n`);

// ===================================
// 🏠 3. BUILDING GENERATOR (AI Favorite!)
// ===================================
console.log('🏠 3. Building generator - perfect for AI prompts!\n');

console.log('→ Creating a 3-story building...');
const building = cube(3)
  .selectAllFaces()
  .extrude(2)          // First floor
  .log()
  .extrude(2)          // Second floor
  .log()  
  .extrude(2)          // Third floor
  .log()
  .inset(0.4)          // Create window frames
  .extrude(-0.2)       // Recessed windows
  .bevel(0.1);         // Smooth finish

console.log(`Finished building: ${building.info()}\n`);

// ===================================
// 🌿 4. ORGANIC SHAPES (Smooth & Natural)
// ===================================
console.log('🌿 4. Organic shape creation...\n');

console.log('→ Creating smooth organic form...');
const organicShape = sphere(2, 8)  // Start with low-poly sphere
  .selectAllFaces()
  .subdivide(1)        // Add geometry for detail
  .log()
  .bevel(0.15, 3);     // Smooth everything out

console.log(`Organic shape: ${organicShape.info()}\n`);

// ===================================
// 🎯 5. SELECTIVE EDITING (Precision!)
// ===================================
console.log('🎯 5. Selective editing - when you need precision...\n');

console.log('→ Creating a box with just top modified...');
const selectiveBox = cube(2)
  .clearSelection()    // Start fresh
  .selectFace(0)       // Just the top face (index 0)
  .log()
  .inset(0.4)          // Inset only the top
  .extrude(0.5);       // Extrude only the top

console.log(`Selective box: ${selectiveBox.info()}\n`);

console.log('→ Creating a die with multiple face selection...');
const die = cube(1.5)
  .selectFaces(0, 2, 4)  // Top, front, right faces
  .log()
  .inset(0.2)            // Create dot recesses
  .extrude(-0.1)         // Push them in
  .bevel(0.05);          // Smooth the dots

console.log(`Die: ${die.info()}\n`);

// ===================================
// 🔧 6. ADVANCED PATTERNS (For Power Users)
// ===================================
console.log('🔧 6. Advanced patterns...\n');

// Create multiple variations from one base
console.log('→ Creating multiple variations...');
const baseMesh = cube(2).selectAllFaces().inset(0.2);

console.log('  Variant 1: Extruded version');
const variant1 = baseMesh.clone().extrude(0.3).bevel(0.1);
console.log(`    ${variant1.info()}`);

console.log('  Variant 2: Subdivided version');  
const variant2 = baseMesh.clone().subdivide(1).bevel(0.05);
console.log(`    ${variant2.info()}`);

// Chain with class methods too
console.log('\n→ Mixing static and instance methods...');
const mixedStyle = EasyMesh.cube(1.5)
  .selectAllFaces()
  .inset(0.25)
  .extrude(0.15)
  .bevel(0.08, 3);

console.log(`Mixed style result: ${mixedStyle.info()}\n`);

// ===================================
// ✨ 7. REAL-WORLD EXAMPLES
// ===================================
console.log('✨ 7. Real-world examples that AI loves...\n');

// Computer monitor
console.log('→ Creating computer monitor...');
const monitor = cube(4)
  .selectFace(0)       // Front face
  .inset(0.3)          // Create screen bezel
  .extrude(-0.1)       // Recess the screen
  .clearSelection()
  .selectAllFaces()
  .bevel(0.1, 2);      // Smooth all edges

console.log(`Monitor: ${monitor.info()}`);

// Tree trunk
console.log('→ Creating tree trunk...');
const trunk = cylinder(0.8, 5, 8)  // Octagonal trunk
  .selectAllFaces()
  .subdivide(1)        // Add geometry
  .bevel(0.2, 4);      // Make it organic

console.log(`Tree trunk: ${trunk.info()}`);

// Terrain base
console.log('→ Creating terrain base...');
const terrain = plane(20, 20, 10)  // Large detailed plane
  .selectAllFaces()
  .subdivide(1)        // Lots of faces for terrain
  .bevel(0.1, 2);      // Smooth transitions

console.log(`Terrain: ${terrain.info()}\n`);

// ===================================
// 🎉 SUMMARY
// ===================================
console.log('🎉 EasyAPI Demo Complete!\n');

console.log('📋 What you learned:');
console.log('  ✅ cube(), sphere(), plane(), cylinder() - Easy creation');
console.log('  ✅ .selectAllFaces() - Most common selection');
console.log('  ✅ .inset() - Add surface detail');
console.log('  ✅ .extrude() - Create volume (#1 operation!)');
console.log('  ✅ .bevel() - Professional smooth edges');
console.log('  ✅ .subdivide() - Add geometry for detail');
console.log('  ✅ .log() - Debug your progress');
console.log('  ✅ Method chaining - Fluent, readable code');
console.log('  ✅ Selective editing - Precision control');
console.log('');

console.log('🎯 The EasyAPI Philosophy:');
console.log('  • Sensible defaults (no complex parameters)');
console.log('  • Chainable methods (fluent interface)');
console.log('  • Copy-paste friendly (perfect for AI)');
console.log('  • Instant feedback (.log() everywhere)');
console.log('  • Professional results (bevel makes everything pretty!)');
console.log('');

console.log('🚀 You\'re ready to create amazing 3D models with AI assistance!');
console.log('💡 Try prompting AI with: "create a building using cube().selectAllFaces()..."'); 