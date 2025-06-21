/**
 * 🚀 Simple Demo - 3D-Mesh-Lib for AI Coders
 * Shows the core patterns without complex operations
 */

import { PrimitiveFactory, SelectionManager, InsetFaces, ExtrudeFaces, SelectFace } from '../src/index';

console.log('🎯 3D-Mesh-Lib Simple Demo\n');

// ===================================
// 1. CREATE BASIC SHAPES
// ===================================
console.log('📦 Creating shapes...');

const cube = PrimitiveFactory.createCube(2);
const sphere = PrimitiveFactory.createSphere(1, 8, 8);

console.log(`✅ Cube: ${cube.faces.size} faces, ${cube.vertices.size} vertices`);
console.log(`✅ Sphere: ${sphere.faces.size} faces, ${sphere.vertices.size} vertices\n`);

// ===================================
// 2. BASIC OPERATIONS
// ===================================
console.log('🔧 Basic operations...');

const mesh = PrimitiveFactory.createCube(2);
const selection = new SelectionManager();

// Select all faces
SelectFace.selectAll(mesh, selection).execute();
console.log(`Selected ${selection.getSelectedFaceIds().size} faces`);

// Inset faces
console.log('→ Insetting faces...');
try {
  const insetCmd = new InsetFaces(mesh, selection, 0.3);
  insetCmd.execute();
  console.log(`  ✅ ${insetCmd.description}`);
} catch (error) {
  console.log(`  ❌ Inset failed: ${error}`);
}

// Extrude faces  
console.log('→ Extruding faces...');
try {
  const selectedFaceIds = Array.from(selection.getSelectedFaceIds());
  const extrudeCmd = new ExtrudeFaces(mesh, selectedFaceIds, 0.5);
  extrudeCmd.execute();
  console.log(`  ✅ ${extrudeCmd.description}`);
} catch (error) {
  console.log(`  ❌ Extrude failed: ${error}`);
}

console.log(`\nFinal mesh: ${mesh.faces.size} faces, ${mesh.vertices.size} vertices`);

// ===================================
// 3. AI-FRIENDLY PATTERNS
// ===================================
console.log('\n🤖 AI-Friendly Patterns');

function createSimpleBuilding() {
  const buildingMesh = PrimitiveFactory.createCube(2);
  const sel = new SelectionManager();
  
  console.log('→ Building generator...');
  
  // Add 2 floors
  for (let floor = 0; floor < 2; floor++) {
    SelectFace.selectAll(buildingMesh, sel).execute();
    
    // Simple extrude without complex operations
    const selectedFaceIds = Array.from(sel.getSelectedFaceIds());
    const extrudeCmd = new ExtrudeFaces(buildingMesh, selectedFaceIds, 1.5);
    extrudeCmd.execute();
    
    console.log(`  Floor ${floor + 1}: ${buildingMesh.faces.size} faces`);
  }
  
  return buildingMesh;
}

const building = createSimpleBuilding();

// ===================================
// 4. SUMMARY
// ===================================
console.log('\n🎉 Demo Complete!');
console.log('');
console.log('📋 What you learned:');
console.log('  1. PrimitiveFactory.createCube(size) - Create shapes');
console.log('  2. new SelectionManager() - Manage selections'); 
console.log('  3. SelectFace.selectAll().execute() - Select geometry');
console.log('  4. new InsetFaces().execute() - Modify mesh');
console.log('  5. new ExtrudeFaces().execute() - Add geometry');
console.log('');
console.log('✨ You can now create amazing 3D models!');
console.log('🚀 Check README.md and CHEATSHEET.md for more patterns!'); 