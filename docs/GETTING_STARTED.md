# 🚀 Getting Started with 3D-Mesh-Lib

Welcome to your ultimate 3D mesh co-pilot! This guide will get you up and running with professional 3D mesh editing, animation, and file format support in just a few minutes.

## 📦 Installation

```bash
npm install 3d-mesh-lib
```

## 🎯 Quick Start

### The Big 4 Operations (90% of what you'll use)

```typescript
import { cube } from '3d-mesh-lib';

// 1. CREATE a shape
const building = cube(3)
  // 2. SELECT faces (almost always selectAllFaces)
  .selectAllFaces()
  // 3. INSET to add detail
  .inset(0.3)
  // 4. EXTRUDE to give depth
  .extrude(2)
  // Bonus: Add smooth edges
  .bevel(0.1);

console.log(building.info());
// Output: "Mesh: 54 faces, 64 vertices..."
```

That's it! You've created a detailed 3-story building with window frames and smooth edges in just 5 lines of code.

## 🎯 File Format Support (7 Formats)

### GLTF 2.0 - Recommended for Animation ⭐

```typescript
import { GltfIO } from '3d-mesh-lib';

// Import complete scene with animations
const result = await GltfIO.importComplete('character.glb');
console.log(`Imported ${result.animations.length} animations`);

// Export with full animation data
const glbBuffer = await GltfIO.exportComplete(result);
```

### Blender Files - Direct Integration

```typescript
import { BlenderIO } from '3d-mesh-lib';

// Import any .blend file (requires Blender installed)
const blenderScene = await BlenderIO.importComplete('scene.blend', {
  includeAnimations: true,
  includeSkeleton: true
});

// Export back to Blender format
await BlenderIO.exportMesh(mesh, 'exported.blend');
```

### FBX - Game Development Standard

```typescript
import { FbxIO } from '3d-mesh-lib';

// Import FBX (requires FBX2glTF or Assimp)
const fbxResult = await FbxIO.importComplete('character.fbx');

// Export with animations
await FbxIO.exportComplete(result, 'exported.fbx');
```

### Universal Formats

```typescript
import { ObjIO, StlIO, JsonIO } from '3d-mesh-lib';

// OBJ+MTL - Works everywhere
const { obj, mtl } = ObjIO.exportMesh(mesh, 'materials.mtl');

// STL - 3D printing
const stlData = StlIO.exportMeshToBinary(mesh);

// JSON - Human readable debugging
const jsonString = JsonIO.exportComplete(result, { prettyPrint: true });
```

## 🦴 Character Animation System

### Create a Character Skeleton

```typescript
import { createHumanoidSkeleton, cylinder, SkinWeights, SkinBinder } from '3d-mesh-lib';

// 1. Create skeleton
const skeleton = createHumanoidSkeleton('MainCharacter');

// 2. Create character mesh
const characterMesh = cylinder(0.8, 4, 12).mesh;

// 3. Automatic skinning
const skinWeights = new SkinWeights(characterMesh);
const binder = new SkinBinder(characterMesh, skeleton);
binder.bindVerticesAutomatically(skinWeights);

// 4. Pose the character
skeleton.saveRestPose();
skeleton.savePose('action', 'Character in action pose');
skeleton.blendPoses('rest', 'action', 0.5); // 50% blend

// 5. Apply deformation
skinWeights.applySkeleton(skeleton);
```

### Keyframe Animation

```typescript
import { AnimationClip, Animator, BoneAnimationTarget } from '3d-mesh-lib';

// Create animation clip
const walkCycle = new AnimationClip('walk', 2.0); // 2 second walk cycle

// Add position animation
walkCycle.addTrack('transform.position', [
  { time: 0, value: new Vector3D(0, 0, 0) },
  { time: 1, value: new Vector3D(2, 0, 0) },
  { time: 2, value: new Vector3D(0, 0, 0) }
], 'easeInOut');

// Add rotation animation
walkCycle.addTrack('transform.rotation.y', [
  { time: 0, value: 0 },
  { time: 1, value: Math.PI },
  { time: 2, value: Math.PI * 2 }
], 'linear');

// Animate a bone
const bone = skeleton.getBone('left_upper_arm');
const animator = new Animator();
const target = new BoneAnimationTarget(bone);

animator.addTarget(target);
animator.addClip(walkCycle);
animator.play('walk');

// In your game loop
function gameLoop(deltaTime) {
  animator.update(deltaTime);
  skinWeights.applySkeleton(skeleton);
}
```

### Pre-built Animations

```typescript
import { createSpinAnimation, createPulseAnimation, animateBone } from '3d-mesh-lib';

// Quick animations
const spinClip = createSpinAnimation('y', 2.0, 3); // 3 rotations in 2 seconds
const pulseClip = createPulseAnimation(1.0, 1.5, 1.0); // Pulse from 1x to 1.5x

// Apply to bone
const animator = animateBone(bone, spinClip, 1.5); // 1.5x speed
```

## 🔧 Advanced Mesh Operations

### Building Complex Geometry

```typescript
import { cube, sphere, cylinder } from '3d-mesh-lib';

// Create a detailed house
const house = cube(4, 3, 4)
  .selectAllFaces()
  .inset(0.2)
  .selectFacesByNormal(new Vector3D(0, 1, 0)) // Select roof
  .extrude(1)
  .scale(0.8)
  .selectFacesByNormal(new Vector3D(0, 0, 1)) // Select front wall
  .subdivide(2)
  .selectRandom(0.3) // Select 30% of faces randomly
  .inset(0.1)
  .extrude(0.2); // Create windows

// Add a tower
const tower = cylinder(0.8, 6, 8)
  .selectAllFaces()
  .selectEveryNth(2) // Select every 2nd face
  .inset(0.15)
  .extrude(0.3);

console.log(house.info());
console.log(tower.info());
```

### Edge Loop Operations

```typescript
import { EasyMesh } from '3d-mesh-lib';

const detailed = EasyMesh.cube(2)
  .selectAllEdges()
  .insertEdgeLoop() // Add edge loops
  .selectAllFaces()
  .bevel(0.1) // Smooth all edges
  .selectFacesByMaterial(0)
  .subdivide(1) // Add more detail
  .smooth(); // Smooth the mesh
```

## 🎲 Primitive Shapes

All shapes support the fluent API:

```typescript
import { cube, sphere, plane, cylinder, cone, torus } from '3d-mesh-lib';

// Basic shapes
const myCube = cube(2); // 2x2x2 cube
const mySphere = sphere(1.5, 32); // radius 1.5, 32 segments
const myPlane = plane(5, 5); // 5x5 plane
const myCylinder = cylinder(1, 3, 16); // radius 1, height 3, 16 segments

// Advanced shapes
const myCone = cone(1, 2, 12); // radius 1, height 2, 12 segments  
const myTorus = torus(2, 0.5, 16, 8); // major radius 2, minor 0.5

// All support chaining
const complex = sphere(2)
  .selectAllFaces()
  .subdivide(2)
  .selectRandom(0.4)
  .extrude(0.3)
  .bevel(0.05);
```

## 🔍 Selection Tools

```typescript
// Face selection
mesh.selectAllFaces()
    .selectFacesByNormal(new Vector3D(0, 1, 0)) // Top faces
    .selectFacesByMaterial(materialId)
    .selectConnectedFaces()
    .selectRandom(0.3) // 30% random
    .selectEveryNth(2) // Every 2nd face
    .growSelection(1) // Grow selection by 1 ring
    .shrinkSelection(1); // Shrink selection

// Edge selection  
mesh.selectAllEdges()
    .selectBoundaryEdges()
    .selectEdgeRing()
    .selectEdgeLoop();

// Vertex selection
mesh.selectAllVertices()
    .selectVerticesByPosition(center, radius)
    .selectBoundaryVertices();
```

## 📊 Mesh Analysis

```typescript
// Get mesh information
console.log(mesh.info());
// Output: "Mesh: 245 faces, 123 vertices, 3 materials"

// Check mesh quality
console.log(mesh.isManifold()); // true/false
console.log(mesh.getBoundaryEdges()); // Array of boundary edges
console.log(mesh.getBoundingBox()); // Min/max coordinates

// Statistics
const stats = mesh.getStats();
console.log(`Triangles: ${stats.triangles}, Quads: ${stats.quads}`);
```

## 🎯 Format Selection Guide

| Use Case | Recommended Format | Why |
|----------|-------------------|-----|
| **Animation & Rigging** | GLTF 2.0 (.glb) | Complete animation support, industry standard |
| **Blender Workflow** | Blender (.blend) | Direct integration, all features preserved |
| **Game Development** | FBX (.fbx) | Industry standard, wide tool support |
| **Legacy Projects** | DirectX (.x) | Compatibility with older engines |
| **Universal Compatibility** | OBJ+MTL (.obj) | Works with any 3D software |
| **3D Printing** | STL (.stl) | Manufacturing standard |
| **Development/Debug** | JSON (.json) | Human-readable, version control friendly |

## 🏃‍♂️ Performance Tips

1. **Use selectAllFaces()** - Most operations work on selected faces
2. **Chain operations** - More efficient than separate calls
3. **Limit subdivisions** - Each level multiplies face count by 4
4. **Use binary formats** - GLB and binary STL are much smaller
5. **Enable autoUpdate: false** - For batch operations

```typescript
// Efficient batch operations
mesh.autoUpdate = false; // Disable auto-calculations
mesh.selectAllFaces()
    .inset(0.2)
    .extrude(0.5)
    .bevel(0.1);
mesh.autoUpdate = true; // Re-enable and update once
```

## 🚨 Troubleshooting

### Build Errors
```bash
# Clean build
npm run clean && npm run build
```

### Format Import Issues
```typescript
// Check if tools are installed
const blenderInfo = await BlenderIO.detectBlender();
const fbxInfo = await FbxIO.detectConverter();
const dxInfo = await DirectXIO.detectConverter();

console.log('Blender:', blenderInfo.found);
console.log('FBX Converter:', fbxInfo.found);
console.log('DirectX Converter:', dxInfo.found);
```

### Memory Issues with Large Files
```typescript
// Use streaming for large files
const options = { 
  cleanup: true, // Clean temp files
  maxVertices: 100000 // Limit complexity
};
```

## 🎓 Next Steps

1. **Run the demos**: `npm run format-demo`, `npm run animation-demo`
2. **Read the docs**: Check `/docs/SUPPORTED_FORMATS.md`
3. **Try the examples**: Look in `/examples/` folder
4. **Build something awesome!** 🚀

---

**Happy 3D modeling!** 🎯✨

For more advanced features, check out:
- [Supported Formats Guide](./SUPPORTED_FORMATS.md)
- [GLTF Animation Guide](./GLTF_ANIMATION_GUIDE.md)
- [API Examples](../examples/) 