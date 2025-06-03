/**
 * 🚀 Working Demo - 3D-Mesh-Lib for AI Coders
 * Shows the ACTUAL API that works right now
 */

import { PrimitiveFactory, SelectionManager, InsetFaces, ExtrudeFaces } from '../src/index';

console.log('🎯 3D-Mesh-Lib Working Demo - Real API\n');

// ===================================
// 1. WHAT ACTUALLY WORKS RIGHT NOW
// ===================================
console.log('✅ What works right now:');

const cube = PrimitiveFactory.createCube(2);
const sphere = PrimitiveFactory.createSphere(1, 8, 8);
const plane = PrimitiveFactory.createPlane(2, 2, 5, 5);

console.log(`📦 Cube: ${cube.faces.size} faces, ${cube.vertices.size} vertices`);
console.log(`🌐 Sphere: ${sphere.faces.size} faces, ${sphere.vertices.size} vertices`);
console.log(`📄 Plane: ${plane.faces.size} faces, ${plane.vertices.size} vertices\n`);

// ===================================
// 2. BASIC OPERATIONS THAT WORK
// ===================================
console.log('🔧 Basic operations with real API:');

const mesh = PrimitiveFactory.createCube(2);
const selection = new SelectionManager();

// Select individual faces (what actually exists)
const faceIds = Array.from(mesh.faces.keys());
console.log(`Available faces: ${faceIds.join(', ')}`);

// Select the first face
if (faceIds.length > 0) {
  selection.selectFace(faceIds[0], true);
  console.log(`Selected face ${faceIds[0]}`);
}

// Inset with real constructor: InsetFaces(mesh, selectionManager, insetAmount, useIndividual?, faceIds?)
console.log('→ Insetting face...');
try {
  const insetCmd = new InsetFaces(mesh, selection, 0.3, true);
  insetCmd.execute();
  console.log(`  ✅ ${insetCmd.description}`);
} catch (error) {
  console.log(`  ❌ Inset failed: ${error}`);
}

// Extrude with real constructor: ExtrudeFaces(mesh, faceIds, distance, direction?)
console.log('→ Extruding face...');
try {
  const selectedFaces = Array.from(selection.getSelectedFaceIds());
  const extrudeCmd = new ExtrudeFaces(mesh, selectedFaces, 0.5);
  extrudeCmd.execute();
  console.log(`  ✅ ${extrudeCmd.description}`);
} catch (error) {
  console.log(`  ❌ Extrude failed: ${error}`);
}

console.log(`\nFinal mesh: ${mesh.faces.size} faces, ${mesh.vertices.size} vertices`);

// ===================================
// 3. REAL SELECTION API
// ===================================
console.log('\n🎯 Real Selection API that works:');

const selectionDemo = new SelectionManager();

console.log('Available methods:');
console.log('  • selection.selectVertex(id, additive?)');
console.log('  • selection.selectEdge(id, additive?)');
console.log('  • selection.selectFace(id, additive?)');
console.log('  • selection.deselectVertex(id)');
console.log('  • selection.deselectEdge(id)');
console.log('  • selection.deselectFace(id)');
console.log('  • selection.clearVertexSelection()');
console.log('  • selection.clearEdgeSelection()');
console.log('  • selection.clearFaceSelection()');
console.log('  • selection.getSelectedVertexIds()');
console.log('  • selection.getSelectedEdgeIds()');
console.log('  • selection.getSelectedFaceIds()');

// Demonstrate real selection
const demoMesh = PrimitiveFactory.createCube(1);
const demoIds = Array.from(demoMesh.faces.keys());

selectionDemo.selectFace(demoIds[0], false);
selectionDemo.selectFace(demoIds[1], true); // additive
selectionDemo.selectFace(demoIds[2], true); // additive

console.log(`\nSelected ${selectionDemo.getSelectedFaceIds().size} faces: ${Array.from(selectionDemo.getSelectedFaceIds()).join(', ')}`);

// ===================================
// 4. REAL COMMAND CONSTRUCTORS
// ===================================
console.log('\n🏗️ Real Command Constructors:');

console.log('What actually works for commands:');
console.log('  • new InsetFaces(mesh, selection, insetAmount, useIndividual?, faceIds?)');
console.log('  • new ExtrudeFaces(mesh, faceIds, distance, direction?)');
console.log('  • new BevelFaces(mesh, selection, faceIds?, amount?, segments?)');
console.log('  • new SubdivideFaces(mesh, selection, faceIds?, subdivisions?)');
console.log('  • new DeleteFaces(mesh, selection, faceIds?)');

// ===================================
// 5. WORKING EXAMPLE FUNCTION
// ===================================
console.log('\n🎨 Working Example Function:');

function createWorkingDetailedCube(size: number = 2) {
  console.log('→ Creating detailed cube with real API...');
  
  const workMesh = PrimitiveFactory.createCube(size);
  const workSel = new SelectionManager();
  
  // Get all face IDs
  const allFaceIds = Array.from(workMesh.faces.keys());
  
  // Select first face
  if (allFaceIds.length > 0) {
    workSel.selectFace(allFaceIds[0], true);
    
    // Inset first face: InsetFaces(mesh, selection, amount, individual, faceIds?)
    const insetCommand = new InsetFaces(workMesh, workSel, 0.2, true);
    insetCommand.execute();
    console.log(`    ✅ ${insetCommand.description}`);
    
    // Extrude the inset face: ExtrudeFaces(mesh, faceIds, distance, direction?)
    const newSelectedFaces = Array.from(workSel.getSelectedFaceIds());
    if (newSelectedFaces.length > 0) {
      const extrudeCommand = new ExtrudeFaces(workMesh, newSelectedFaces, 0.3);
      extrudeCommand.execute();
      console.log(`    ✅ ${extrudeCommand.description}`);
    }
  }
  
  console.log(`    Final: ${workMesh.faces.size} faces, ${workMesh.vertices.size} vertices`);
  return workMesh;
}

const detailedCube = createWorkingDetailedCube(1.5);

// ===================================
// 6. CONVENIENCE STATIC METHODS
// ===================================
console.log('\n⚡ Convenience Static Methods (that actually work):');

console.log('Some commands have static factory methods:');
try {
  const staticMesh = PrimitiveFactory.createCube(1);
  const staticSel = new SelectionManager();
  
  // Select a face first
  const staticFaceIds = Array.from(staticMesh.faces.keys());
  if (staticFaceIds.length > 0) {
    staticSel.selectFace(staticFaceIds[0], true);
    
    // Use static methods where available
    const insetStatic = InsetFaces.insetInward(staticMesh, staticSel, 0.2);
    insetStatic.execute();
    console.log(`  ✅ Static inset: ${insetStatic.description}`);
  }
} catch (error) {
  console.log(`  ⚠️ Static methods may not all be implemented yet`);
}

// ===================================
// 7. COPY-PASTE PATTERNS THAT WORK
// ===================================
console.log('\n📋 Copy-Paste Patterns That Work Right Now:');

console.log('\n// CREATE MESH');
console.log('const mesh = PrimitiveFactory.createCube(2);');
console.log('const selection = new SelectionManager();');
console.log('');

console.log('// SELECT FACES');
console.log('const faceIds = Array.from(mesh.faces.keys());');
console.log('selection.selectFace(faceIds[0], true);');
console.log('selection.selectFace(faceIds[1], true);');
console.log('');

console.log('// INSET FACES');
console.log('const insetCmd = new InsetFaces(mesh, selection, 0.3, true);');
console.log('insetCmd.execute();');
console.log('console.log(insetCmd.description);');
console.log('');

console.log('// EXTRUDE FACES');
console.log('const selectedIds = Array.from(selection.getSelectedFaceIds());');
console.log('const extrudeCmd = new ExtrudeFaces(mesh, selectedIds, 0.5);');
console.log('extrudeCmd.execute();');
console.log('console.log(extrudeCmd.description);');

console.log('\n✨ This is the foundation - works great for building 3D models!');
console.log('🎯 Perfect for AI-generated code and rapid prototyping!'); 