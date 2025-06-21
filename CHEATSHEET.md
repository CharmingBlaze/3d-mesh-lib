# 🎯 3D-Mesh-Lib - AI-Friendly Cheat Sheet

**Perfect for AI code generation and rapid prototyping!**

## 🚀 Quick Start (Copy-Paste Ready)

```typescript
import { PrimitiveFactory, SelectionManager, InsetFaces, ExtrudeFaces } from '3d-mesh-lib';

// Create mesh
const mesh = PrimitiveFactory.createCube(2);
const selection = new SelectionManager();

// Select and modify
const faceIds = Array.from(mesh.faces.keys());
selection.selectFace(faceIds[0], true);

const insetCmd = new InsetFaces(mesh, selection, 0.3, true);
insetCmd.execute();

const selectedIds = Array.from(selection.getSelectedFaceIds());
const extrudeCmd = new ExtrudeFaces(mesh, selectedIds, 0.5);
extrudeCmd.execute();

console.log(`Result: ${mesh.faces.size} faces, ${mesh.vertices.size} vertices`);
```

## 🎲 Primitive Creation

```typescript
import { PrimitiveFactory } from '3d-mesh-lib';

// Basic shapes
const cube = PrimitiveFactory.createCube(2);                    // 2x2x2 cube
const sphere = PrimitiveFactory.createSphere(1, 32);           // radius 1, 32 segments
const plane = PrimitiveFactory.createPlane(5, 5);              // 5x5 plane
const cylinder = PrimitiveFactory.createCylinder(1, 3, 16);    // radius 1, height 3, 16 segments

// Get mesh info
console.log(`Cube: ${cube.faces.size} faces, ${cube.vertices.size} vertices`);
```

## 🎯 Selection Patterns

```typescript
import { SelectionManager } from '3d-mesh-lib';

const selection = new SelectionManager();

// Select individual elements
selection.selectFace(123, false);      // Select face 123, replace selection
selection.selectFace(124, true);       // Add face 124 to selection
selection.selectEdge(456, true);       // Add edge 456 to selection
selection.selectVertex(789, true);     // Add vertex 789 to selection

// Get selections
const selectedFaces = Array.from(selection.getSelectedFaceIds());
const selectedEdges = Array.from(selection.getSelectedEdgeIds());
const selectedVertices = Array.from(selection.getSelectedVertexIds());

// Clear selections
selection.clearFaceSelection();
selection.clearEdgeSelection();
selection.clearVertexSelection();
```

## 🔧 Face Operations (Most Common)

```typescript
import { InsetFaces, ExtrudeFaces, BevelFaces, SubdivideFaces, DeleteFaces } from '3d-mesh-lib';

// Inset faces (adds detail)
const insetCmd = new InsetFaces(mesh, selection, 0.3, true);  // amount, individual
insetCmd.execute();

// Extrude faces (adds depth)
const faceIds = Array.from(selection.getSelectedFaceIds());
const extrudeCmd = new ExtrudeFaces(mesh, faceIds, 0.5);      // distance
extrudeCmd.execute();

// Bevel faces (smooth corners)
const bevelCmd = new BevelFaces(mesh, selection, undefined, 0.1, 3);  // amount, segments
bevelCmd.execute();

// Subdivide faces (add geometry)
const subdivideCmd = new SubdivideFaces(mesh, selection, undefined, 2);  // subdivisions
subdivideCmd.execute();

// Delete faces
const deleteCmd = new DeleteFaces(mesh, selection);
deleteCmd.execute();
```

## 🎨 Material Operations

```typescript
import { Material, Vector3D } from '3d-mesh-lib';

// Add material to mesh
const redMaterial = mesh.addMaterial('Red Material', {
  color: new Vector3D(1.0, 0.0, 0.0),  // RGB red
  metallic: 0.0,
  roughness: 0.8,
  opacity: 1.0
});

// Assign material to faces
import { AssignMaterialToFaces } from '3d-mesh-lib';
const assignCmd = new AssignMaterialToFaces(mesh, selection, redMaterial.id);
assignCmd.execute();
```

## 🗃️ File I/O (7 Formats)

```typescript
import { GltfIO, ObjIO, StlIO, JsonIO } from '3d-mesh-lib';

// GLTF (Recommended - supports animation)
const gltfResult = await GltfIO.importComplete('model.glb');
const glbBuffer = await GltfIO.exportComplete(gltfResult);

// OBJ (Universal compatibility)
const objResult = ObjIO.importMesh('model.obj', 'materials.mtl');
const { obj, mtl } = ObjIO.exportMesh(mesh, 'output.mtl');

// STL (3D printing)
const stlMesh = StlIO.importMesh('model.stl');
const stlBinary = StlIO.exportMeshToBinary(mesh);

// JSON (Human-readable)
const jsonMesh = JsonIO.importMesh('model.json');
const jsonString = JsonIO.exportMesh(mesh, { prettyPrint: true });
```

## 🦴 Skeletal Animation

```typescript
import { 
  createHumanoidSkeleton, 
  SkinWeights, 
  SkinBinder,
  AnimationClip,
  Animator 
} from '3d-mesh-lib';

// Create skeleton
const skeleton = createHumanoidSkeleton('Character');

// Bind mesh to skeleton
const skinWeights = new SkinWeights(mesh);
const binder = new SkinBinder(mesh, skeleton);
binder.bindVerticesAutomatically(skinWeights);

// Create animation
const animator = new Animator();
const clip = new AnimationClip('walk_cycle', 2.0);  // 2 second duration

// Add keyframes
clip.addTrack('transform.position', [
  { time: 0, value: new Vector3D(0, 0, 0) },
  { time: 1, value: new Vector3D(2, 0, 0) },
  { time: 2, value: new Vector3D(0, 0, 0) }
], 'easeInOut');

animator.addClip(clip);
animator.play('walk_cycle');
```

## 🔍 Mesh Analysis

```typescript
// Get mesh statistics
console.log(`Faces: ${mesh.faces.size}`);
console.log(`Vertices: ${mesh.vertices.size}`);
console.log(`Edges: ${mesh.edges.size}`);
console.log(`Materials: ${mesh.materials?.size || 0}`);

// Compute bounding box
mesh.computeBoundingBox();
console.log(`Bounds: ${mesh.boundingBox?.min} to ${mesh.boundingBox?.max}`);

// Check mesh validity
const isManifold = mesh.isManifold();
const hasHoles = mesh.hasBoundaryEdges();
console.log(`Manifold: ${isManifold}, Has holes: ${hasHoles}`);
```

## 🎯 Common Patterns for AI

### Building Creation
```typescript
// Create detailed building
const building = PrimitiveFactory.createCube(3);
const sel = new SelectionManager();

// Select all faces
const allFaces = Array.from(building.faces.keys());
allFaces.forEach(id => sel.selectFace(id, true));

// Add window frames
const inset = new InsetFaces(building, sel, 0.3, true);
inset.execute();

// Add depth
const selectedIds = Array.from(sel.getSelectedFaceIds());
const extrude = new ExtrudeFaces(building, selectedIds, 0.5);
extrude.execute();
```

### Organic Shape Creation
```typescript
// Create organic shape
const organic = PrimitiveFactory.createSphere(1, 16);
const sel = new SelectionManager();

// Select random faces
const faceIds = Array.from(organic.faces.keys());
for (let i = 0; i < 5; i++) {
  const randomId = faceIds[Math.floor(Math.random() * faceIds.length)];
  sel.selectFace(randomId, true);
}

// Add detail
const subdivide = new SubdivideFaces(organic, sel, undefined, 2);
subdivide.execute();

const bevel = new BevelFaces(organic, sel, undefined, 0.1, 2);
bevel.execute();
```

### Mechanical Part
```typescript
// Create mechanical part
const part = PrimitiveFactory.createCylinder(1, 2, 8);
const sel = new SelectionManager();

// Select top face
const faces = Array.from(part.faces.keys());
sel.selectFace(faces[0], false);

// Create mounting holes
const inset = new InsetFaces(part, sel, 0.2, true);
inset.execute();

const selectedIds = Array.from(sel.getSelectedFaceIds());
const extrude = new ExtrudeFaces(part, selectedIds, -0.3);  // Negative = inward
extrude.execute();
```

## 🎨 Material Presets

```typescript
// Common material presets
const materials = {
  red: mesh.addMaterial('Red', { 
    color: new Vector3D(1, 0, 0), 
    roughness: 0.8 
  }),
  
  metal: mesh.addMaterial('Metal', { 
    color: new Vector3D(0.7, 0.7, 0.7), 
    metallic: 1.0, 
    roughness: 0.2 
  }),
  
  plastic: mesh.addMaterial('Plastic', { 
    color: new Vector3D(0, 0.5, 1), 
    metallic: 0.0, 
    roughness: 0.9 
  }),
  
  glass: mesh.addMaterial('Glass', { 
    color: new Vector3D(1, 1, 1), 
    metallic: 0.0, 
    roughness: 0.0, 
    opacity: 0.3 
  })
};
```

## 🚀 Performance Tips

```typescript
// Batch operations for better performance
const commands = [
  new InsetFaces(mesh, selection, 0.2, true),
  new ExtrudeFaces(mesh, faceIds, 0.3),
  new BevelFaces(mesh, selection, undefined, 0.1, 2)
];

// Execute all at once
commands.forEach(cmd => cmd.execute());

// Or use history manager for undo/redo
import { HistoryManager } from '3d-mesh-lib';
const history = new HistoryManager();
commands.forEach(cmd => history.executeCommand(cmd));
```

## 🎯 Error Handling

```typescript
try {
  const mesh = PrimitiveFactory.createCube(2);
  const selection = new SelectionManager();
  
  // Always check if faces exist before selecting
  const faceIds = Array.from(mesh.faces.keys());
  if (faceIds.length > 0) {
    selection.selectFace(faceIds[0], true);
    
    const cmd = new InsetFaces(mesh, selection, 0.3, true);
    cmd.execute();
    
    console.log(`Success: ${cmd.description}`);
  }
} catch (error) {
  console.error('Mesh operation failed:', error.message);
}
```

## 📋 Command Reference

### ✅ Working Commands
- `InsetFaces(mesh, selection, amount, individual?)`
- `ExtrudeFaces(mesh, faceIds, distance, direction?)`
- `BevelFaces(mesh, selection, faceIds?, amount?, segments?)`
- `SubdivideFaces(mesh, selection, faceIds?, subdivisions?)`
- `DeleteFaces(mesh, selection, faceIds?)`
- `DuplicateFaces(mesh, selection, faceIds?)`
- `AssignMaterialToFaces(mesh, selection, materialId)`

### 🎲 Primitives
- `PrimitiveFactory.createCube(size)`
- `PrimitiveFactory.createSphere(radius, segments)`
- `PrimitiveFactory.createPlane(width, height)`
- `PrimitiveFactory.createCylinder(radius, height, segments)`

### 🗃️ File Formats
- `GltfIO` - GLTF 2.0 (.gltf/.glb) ⭐ Recommended
- `ObjIO` - Wavefront OBJ (.obj/.mtl)
- `StlIO` - Stereolithography (.stl)
- `JsonIO` - Custom JSON format
- `BlenderIO` - Blender files (requires Blender)
- `FbxIO` - FBX files (requires converter)
- `DirectXIO` - DirectX files (requires converter)

---

**🎯 Perfect for AI code generation and rapid 3D prototyping!** 