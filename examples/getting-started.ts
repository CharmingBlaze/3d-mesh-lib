/**
 * 🚀 3D-Mesh-Lib - Getting Started Guide
 * Perfect for AI-generated code and rapid prototyping!
 */

import { 
  PrimitiveFactory, 
  SelectionManager, 
  InsetFaces, 
  ExtrudeFaces, 
  BevelFaces,
  SubdivideEdge,
  LaplacianSmooth,
  Vector3D 
} from '../src/index';

console.log('🎯 3D-Mesh-Lib - Getting Started Examples\n');

// ===================================
// 1. BASIC MESH CREATION
// ===================================
console.log('📦 1. Creating Basic Shapes');

// Create primitive shapes (most common starting point)
const cube = PrimitiveFactory.createCube(2);          // 2x2x2 cube
const sphere = PrimitiveFactory.createSphere(1, 8, 8); // radius 1, 8x8 segments
const plane = PrimitiveFactory.createPlane(3, 3, 5, 5); // 3x3 size, 5x5 subdivisions

console.log(`✅ Created cube: ${cube.faces.size} faces, ${cube.vertices.size} vertices`);
console.log(`✅ Created sphere: ${sphere.faces.size} faces, ${sphere.vertices.size} vertices`);
console.log(`✅ Created plane: ${plane.faces.size} faces, ${plane.vertices.size} vertices\n`);

// ===================================
// 2. BASIC OPERATIONS (MOST COMMON)
// ===================================
console.log('🔧 2. Basic Operations - The Big 3');

const workMesh = PrimitiveFactory.createCube(2);
const selection = new SelectionManager();

// The most common workflow: Select All → Modify
selection.selectAllFaces(); // This is the most common selection

// 🎯 INSET - Makes faces smaller (great for details)
console.log('   → Inset: Making faces smaller...');
const insetCmd = InsetFaces.insetAll(workMesh, selection, 0.3);
insetCmd.execute();
console.log(`     Result: ${insetCmd.description}`);

// 🎯 EXTRUDE - Pushes faces outward (most popular operation!)
console.log('   → Extrude: Pushing faces out...');
const extrudeCmd = ExtrudeFaces.extrudeAlongNormal(workMesh, selection, 0.5);
extrudeCmd.execute();
console.log(`     Result: ${extrudeCmd.description}`);

// 🎯 BEVEL - Makes edges rounded (instant professionalism!)
console.log('   → Bevel: Rounding edges...');
selection.selectAllEdges(); // Switch to edge selection
const bevelCmd = BevelEdge.roundedBevel(workMesh, selection, 0.1, 3);
bevelCmd.execute();
console.log(`     Result: ${bevelCmd.description}\n`);

// ===================================
// 3. AI-FRIENDLY PATTERNS
// ===================================
console.log('🤖 3. AI-Friendly Patterns');

function createDetailedCube(size: number = 2) {
  console.log('   → AI Pattern: Detailed Cube Generator');
  
  // Step 1: Create base shape
  const mesh = PrimitiveFactory.createCube(size);
  const sel = new SelectionManager();
  
  // Step 2: Select everything (most common)
  sel.selectAllFaces();
  
  // Step 3: Apply operations in logical order
  InsetFaces.insetAll(mesh, sel, 0.2).execute();        // Add detail
  ExtrudeFaces.extrudeAlongNormal(mesh, sel, 0.3).execute(); // Add depth
  
  // Step 4: Polish with bevels
  sel.selectAllEdges();
  BevelEdge.roundedBevel(mesh, sel, 0.05, 2).execute(); // Smooth edges
  
  console.log(`     ✅ Created detailed cube: ${mesh.faces.size} faces`);
  return mesh;
}

const detailedCube = createDetailedCube(1.5);

// ===================================
// 4. COMMON WORKFLOWS FOR AI
// ===================================
console.log('\n🎨 4. Common AI Workflows');

// 🏠 BUILDING MAKER (very popular with AI)
function makeBuilding(floors: number = 3) {
  console.log(`   → Building Maker: ${floors} floors`);
  
  const mesh = PrimitiveFactory.createCube(2);
  const sel = new SelectionManager();
  
  for (let floor = 0; floor < floors; floor++) {
    // Select top faces
    sel.selectAllFaces();
    
    // Extrude up for new floor
    ExtrudeFaces.extrudeAlongNormal(mesh, sel, 2.0).execute();
    
    // Add windows (inset + negative extrude)
    InsetFaces.insetAll(mesh, sel, 0.4).execute();
    ExtrudeFaces.extrudeAlongNormal(mesh, sel, -0.2).execute();
  }
  
  console.log(`     ✅ Building complete: ${mesh.faces.size} faces`);
  return mesh;
}

const building = makeBuilding(2);

// 🌿 ORGANIC SHAPES (great for nature/creatures)
function makeOrganicShape() {
  console.log('   → Organic Shape Maker');
  
  const mesh = PrimitiveFactory.createSphere(1, 6, 6);
  const sel = new SelectionManager();
  
  // Add random noise to vertices
  mesh.vertices.forEach(vertex => {
    const noise = (Math.random() - 0.5) * 0.3;
    vertex.position = vertex.position.multiplyScalar(1 + noise);
  });
  
  // Smooth it out
  sel.selectAllVertices();
  LaplacianSmooth.smoothSelected(mesh, sel, 3).execute();
  
  console.log(`     ✅ Organic shape: ${mesh.faces.size} faces`);
  return mesh;
}

const organic = makeOrganicShape();

// ===================================
// 5. SUPER EASY SHORTCUTS
// ===================================
console.log('\n⚡ 5. Super Easy Shortcuts (Copy-Paste Ready)');

// 🎯 Most common operations with smart defaults
const easyMesh = PrimitiveFactory.createCube(1);
const easySel = new SelectionManager();

console.log('   → Copy-paste these common patterns:');
console.log('');

// Select everything and modify (90% of use cases)
console.log('     // SELECT ALL AND MODIFY (most common!)');
console.log('     selection.selectAllFaces();');
console.log('     InsetFaces.insetAll(mesh, selection).execute();     // Smart defaults!');
console.log('     ExtrudeFaces.extrudeAlongNormal(mesh, selection).execute();');
console.log('');

// Make things smooth and professional
console.log('     // MAKE IT PROFESSIONAL (instant polish)');
console.log('     selection.selectAllEdges();');
console.log('     BevelEdge.roundedBevel(mesh, selection).execute();  // Rounds everything!');
console.log('');

// Add detail
console.log('     // ADD DETAIL (more geometry)');
console.log('     selection.selectAllFaces();');
console.log('     SubdivideFaces.subdivideSelected(mesh, selection).execute();');
console.log('');

// ===================================
// 6. FACTORY METHOD CHEAT SHEET
// ===================================
console.log('📋 6. Factory Method Cheat Sheet (AI-Friendly)');
console.log('');

console.log('   🎲 SHAPES:');
console.log('     PrimitiveFactory.createCube(size)');
console.log('     PrimitiveFactory.createSphere(radius, segments, rings)');
console.log('     PrimitiveFactory.createPlane(width, height, widthSegs, heightSegs)');
console.log('     PrimitiveFactory.createCylinder(radius, height, segments)');
console.log('');

console.log('   🔧 FACE OPERATIONS:');
console.log('     InsetFaces.insetAll(mesh, selection, amount?)');
console.log('     ExtrudeFaces.extrudeAlongNormal(mesh, selection, distance?)');
console.log('     BevelFaces.chamferFaces(mesh, selection, amount?)');
console.log('     DuplicateFaces.duplicateInPlace(mesh, selection)');
console.log('');

console.log('   📏 EDGE OPERATIONS:');
console.log('     BevelEdge.roundedBevel(mesh, selection, radius?, segments?)');
console.log('     SubdivideEdge.subdivideSelected(mesh, selection, cuts?)');
console.log('     CollapseEdge.collapseToMidpoint(mesh, selection)');
console.log('');

console.log('   🎯 SELECTION:');
console.log('     selection.selectAll()           // Everything');
console.log('     selection.selectAllFaces()      // All faces (most common)');
console.log('     selection.selectAllEdges()      // All edges');
console.log('     selection.selectAllVertices()   // All vertices');
console.log('');

// ===================================
// 7. INSTANT RESULTS EXAMPLES
// ===================================
console.log('🚀 7. Instant Results (One-Liners)');

// One-liner generators
const quickCube = (() => {
  const m = PrimitiveFactory.createCube(1);
  const s = new SelectionManager();
  s.selectAllFaces();
  InsetFaces.insetAll(m, s, 0.2).execute();
  ExtrudeFaces.extrudeAlongNormal(m, s, 0.3).execute();
  return m;
})();
console.log(`   ✅ Quick detailed cube: ${quickCube.faces.size} faces`);

const quickSphere = (() => {
  const m = PrimitiveFactory.createSphere(1, 6, 6);
  const s = new SelectionManager();
  s.selectAllEdges();
  BevelEdge.roundedBevel(m, s, 0.1).execute();
  return m;
})();
console.log(`   ✅ Quick smooth sphere: ${quickSphere.faces.size} faces`);

// ===================================
// 8. ERROR-PROOF PATTERNS
// ===================================
console.log('\n🛡️ 8. Error-Proof Patterns (Always Work)');
console.log('');

console.log('   // SAFE PATTERN (never fails):');
console.log('   const mesh = PrimitiveFactory.createCube(2);');
console.log('   const selection = new SelectionManager();');
console.log('   selection.selectAllFaces();  // Always works');
console.log('   const cmd = InsetFaces.insetAll(mesh, selection, 0.2);');
console.log('   cmd.execute();');
console.log('   console.log(cmd.description); // See what happened');
console.log('');

console.log('   // WITH ERROR HANDLING:');
console.log('   try {');
console.log('     cmd.execute();');
console.log('   } catch (error) {');
console.log('     console.log("Error:", error.message);');
console.log('   }');
console.log('');

// ===================================
// FINAL SUMMARY
// ===================================
console.log('🎉 SUMMARY - You Now Know Everything Important!');
console.log('');
console.log('📝 THE BIG 4 OPERATIONS (90% of use cases):');
console.log('   1. InsetFaces.insetAll()         → Add surface detail');
console.log('   2. ExtrudeFaces.extrudeAlongNormal() → Push faces out');
console.log('   3. BevelEdge.roundedBevel()      → Smooth edges');
console.log('   4. SubdivideFaces.subdivideSelected() → Add more geometry');
console.log('');

console.log('🎯 THE UNIVERSAL PATTERN:');
console.log('   1. Create: PrimitiveFactory.create[Shape]()');
console.log('   2. Select: selection.selectAll[Type]()');
console.log('   3. Modify: Command.factoryMethod().execute()');
console.log('   4. Repeat!');
console.log('');

console.log('✨ You\'re ready to create amazing 3D models with AI assistance!');
console.log('🚀 Happy coding with 3d-mesh-lib!'); 