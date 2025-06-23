# 🎯 3D-Mesh-Lib - Your Ultimate 3D Mesh Co-Pilot


[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-GitHub-lightgrey)](https://github.com/sponsors/CharmingBlaze)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-blue)](https://coff.ee/charmingblaze)

---

**Robust, AI-friendly mesh editing in TypeScript/JavaScript.**  
From quick prototypes to high-end 3D tools, 3d-mesh-lib helps you build smarter, not harder.

---

## ☕ Support the Project

Hi, I’m Jesse—the developer behind 3d-mesh-lib.  
If this library has saved you time, taught you something, or helped you ship a cool project, please consider [buying me a coffee](https://coff.ee/charmingblaze) or [sponsoring on GitHub](https://github.com/sponsors/CharmingBlaze).

Every bit of support makes a difference. It keeps me caffeinated, motivated, and able to put more hours into making this project even better for you and the whole community. Thank you for making open source awesome. 🙏

---

## 🚀 Quick Start

```bash
npm install 3d-mesh-lib
```

```typescript
import { cube } from '3d-mesh-lib';

// Create a detailed building in one fluent chain
const building = cube(3)
  .selectAllFaces()
  .inset(0.3)      // Create window frames
  .extrude(2)      // Build up 3 floors
  .bevel(0.1);     // Professional smooth edges

console.log(building.info()); // "Mesh: 54 faces, 64 vertices..."
```

## ✨ Core Features

### 🎲 **The Big 4** - Most Common Operations
1. **Create** shapes: `cube()`, `sphere()`, `plane()`, `cylinder()`
2. **Select** faces: `.selectAllFaces()` (90% of the time you want this!)
3. **Inset** faces: `.inset(0.3)` (adds surface detail, perfect before extrude)
4. **Extrude** faces: `.extrude(0.5)` (the #1 most popular 3D operation!)

### 🎯 **7 File Format Support** - Import/Export Everything
- **GLTF 2.0** (.gltf/.glb) - Complete animation & skeletal support ⭐
- **Blender** (.blend) - Direct import via Blender CLI
- **FBX** (.fbx) - Import via FBX2glTF/Assimp converters  
- **DirectX** (.x) - Legacy format with Assimp support
- **OBJ+MTL** (.obj/.mtl) - Universal compatibility
- **STL** (.stl) - 3D printing standard
- **JSON** (.json) - Custom human-readable format

### 🦴 **Complete Bone System** - Professional Character Animation
- **Skeletal Hierarchies** - Full bone parent/child relationships
- **Automatic Skinning** - Intelligent vertex-to-bone weight binding
- **Pose Management** - Save, load, and blend between poses
- **Animation System** - Keyframe animation with smooth interpolation
- **Weight Painting** - Brush-based weight editing tools
- **Bone Constraints** - Rotation limits, IK solving, mirroring
- **Real-time Deformation** - Live mesh updates from bone movement

### 💎 **Easy API** - Perfect for AI Code Generation
- **Fluent Interface** - Chain operations: `cube().selectAllFaces().inset(0.2).extrude(0.5)`
- **Sensible Defaults** - No need to specify every parameter
- **Copy-Paste Friendly** - Works great with AI-generated code
- **Instant Feedback** - `.log()` anywhere in the chain for debugging

### 🔧 **17+ Advanced Operations**
- **Face Operations**: Extrude, Inset, Bevel, Subdivide, Bridge, Duplicate
- **Edge Operations**: Bevel edges, Insert edge loops, Select edge rings
- **Vertex Operations**: Smooth, Scale, Translate, Mirror, UV unwrap
- **Selection Tools**: Grow/shrink selection, select by material, connected faces
- **Mesh Analysis**: Boundary detection, manifold checking, statistics

## 📖 Documentation

### File Format Import/Export

```typescript
import { 
  GltfIO, BlenderIO, FbxIO, DirectXIO, 
  ObjIO, StlIO, JsonIO 
} from '3d-mesh-lib';

// GLTF 2.0 - Recommended for animations
const result = await GltfIO.importComplete('character.glb');
const glbBuffer = await GltfIO.exportComplete(result);

// Blender files (requires Blender installed)
const blenderResult = await BlenderIO.importComplete('scene.blend');
await BlenderIO.exportMesh(mesh, 'exported.blend');

// FBX files (requires FBX2glTF or Assimp)
const fbxResult = await FbxIO.importComplete('model.fbx');
await FbxIO.exportComplete(result, 'exported.fbx');

// DirectX .x files (requires Assimp)
const xResult = await DirectXIO.importComplete('legacy.x');

// Universal formats
const { obj, mtl } = ObjIO.exportMesh(mesh, 'materials.mtl');
const stlData = StlIO.exportMeshToBinary(mesh);
const jsonString = JsonIO.exportComplete(result, { prettyPrint: true });
```

### Basic Mesh Operations

```typescript
import { cube, sphere, plane, cylinder } from '3d-mesh-lib';

// Create shapes with the global functions (AI-friendly!)
const myCube = cube(2)
  .selectAllFaces()
  .inset(0.2)
  .extrude(0.3)
  .bevel(0.1);

// Or use the class methods
import { EasyMesh } from '3d-mesh-lib';
const myShape = EasyMesh.sphere(1.5, 32)
  .selectAllFaces()
  .subdivide(2)
  .bevel(0.05);
```

### Bone System and Character Animation

```typescript
import { 
  createHumanoidSkeleton, 
  SkinWeights, 
  SkinBinder,
  cylinder 
} from '3d-mesh-lib';

// Create complete character system
const skeleton = createHumanoidSkeleton('Character');
const characterMesh = cylinder(0.8, 4, 12).mesh;

// Automatic skinning
const skinWeights = new SkinWeights(characterMesh);
const binder = new SkinBinder(characterMesh, skeleton);
binder.bindVerticesAutomatically(skinWeights);

// Pose management
skeleton.saveRestPose();
skeleton.savePose('action', 'Character in action');
skeleton.blendPoses('rest', 'action', 0.5); // 50% blend

// Apply skeletal deformation
skinWeights.applySkeleton(skeleton);
```

### Animation System and Keyframes

```typescript
import { 
  Animator,
  AnimationClip,
  AnimationTrack,
  BoneAnimationTarget,
  createSpinAnimation,
  createPulseAnimation,
  animateBone 
} from '3d-mesh-lib';

// Create professional keyframe animation
const animator = new Animator();
const clip = new AnimationClip('complex_move', 3.0);

// Add multiple animated properties with easing
clip.addTrack('transform.position', [
  { time: 0, value: new Vector3D(0, 0, 0) },
  { time: 1.5, value: new Vector3D(3, 2, 0) },
  { time: 3, value: new Vector3D(0, 0, 0) }
], 'easeInOutBounce');

clip.addTrack('transform.rotation.y', [
  { time: 0, value: 0 },
  { time: 3, value: Math.PI * 2 } // Full rotation
], 'linear');

// Animate bones with the system
const bone = new Bone('animated_bone');
const target = new BoneAnimationTarget(bone);

animator.addTarget(target);
animator.addClip(clip);
animator.play('complex_move');

// Update in your game loop
animator.update(deltaTime);
```

### Pre-built Animations

```typescript
// Instant professional animations
const spinClip = createSpinAnimation('y', 2.0, 3); // 3 rotations in 2 seconds
const pulseClip = createPulseAnimation(1.0, 1.5, 1.0); // Pulse from 1x to 1.5x
const fadeClip = createFadeAnimation(0, 1, 2.0); // Fade in over 2 seconds

// Quick bone animation
const animator = animateBone(bone, spinClip, 1.5); // 1.5x speed

// 16 easing functions available: linear, easeInOut, easeOutBounce, 
// easeInElastic, easeOutBack, and 11 more!
```

### Individual Bone Creation

```typescript
import { Bone, Vector3D } from '3d-mesh-lib';

// Create bone hierarchy
const spine = new Bone('spine');
spine.transform.position.set(0, 0, 0);
const neck = new Bone('neck');
neck.transform.position.set(0, 2, 0);
const head = new Bone('head');
head.transform.position.set(0, 0.5, 0);

spine.addChild(neck);
neck.addChild(head);

// Pose the bones
spine.transform.rotation.set(0, 0, Math.PI / 6); // 30-degree bend
neck.transform.rotation.set(Math.PI / 12, 0, 0); // Look up slightly

console.log(spine.toString()); // Bone info with children count
```

### Bone Factory Methods

```typescript
import { 
  createSpineChain, 
  createArmChain, 
  createLegChain 
} from '3d-mesh-lib';

// Pre-built bone chains
const spine = createSpineChain(5, 1.2);        // 5 segments, 1.2 length each
const leftArm = createArmChain('left', 2, 1.5); // Upper: 2, forearm: 1.5
const rightLeg = createLegChain('right', 2.5, 2); // Thigh: 2.5, shin: 2

// Find bones in the chains
const shoulder = leftArm; // Root is shoulder
const upperArm = leftArm.children.find(b => b.name.includes('upper_arm'));
const forearm = leftArm.getDescendants().find(b => b.name.includes('forearm'));
```

### Weight Painting and Skinning

```typescript
import { SkinWeights, Vector3D } from '3d-mesh-lib';

const skinWeights = new SkinWeights(mesh);

// Paint weights with brush
const affected = skinWeights.paintWeights(
  new Vector3D(1, 2, 0), // brush center (shoulder area)
  0.5,                   // brush radius
  'left_shoulder',       // bone to paint for
  0.8,                   // paint strength
  'add'                  // paint mode
);

// Smooth weights around a vertex
skinWeights.smoothWeights(vertexId, 3, 0.5); // 3 iterations, 50% strength

// Manual weight assignment
skinWeights.setWeight(vertexId, 'spine_bone', 0.7);
skinWeights.setWeight(vertexId, 'left_shoulder', 0.3);
// Weights automatically normalized to sum to 1.0
```

## 🎮 Quick Demos

```bash
# Basic mesh operations (perfect for AI coders)
npm run easy-demo

# Complete bone system showcase
npm run bone-demo

# Professional animation system with keyframes
npm run animation-demo

# Original working demo
npm run demo
```

## 🎯 Perfect for AI Prompts

This library is designed to work beautifully with AI code generation:

```
"Create a medieval tower using cube().selectAllFaces().inset(0.3).extrude(3).bevel(0.1)"

"Make a character with createHumanoidSkeleton() then pose the left arm raised"

"Build a spaceship hull with sphere().selectFaces(0,2,4).inset(0.4).extrude(-0.2)"
```

## 📋 Copy-Paste Patterns

### Building Generator
```typescript
const building = cube(width)
  .selectAllFaces()
  .extrude(floorHeight)  // First floor
  .extrude(floorHeight)  // Second floor  
  .extrude(floorHeight)  // Third floor
  .inset(windowInset)    // Window frames
  .extrude(-windowDepth) // Recessed windows
  .bevel(edgeRadius);    // Professional finish
```

### Character Setup
```typescript
const character = createHumanoidSkeleton('Hero');
const mesh = cylinder(0.8, 4, 12).mesh;
const skinWeights = createAutoSkinning(mesh, character);

character.saveRestPose();
character.loadPose('action');
skinWeights.applySkeleton(character);
```

### Organic Shapes
```typescript
const organic = sphere(radius)
  .selectAllFaces()
  .subdivide(2)          // Add geometry for detail
  .bevel(0.1, 4);        // Smooth organic surface
```

## 📊 What Makes This Special

- ✅ **AI-Optimized**: Designed specifically for AI code generation
- ✅ **Professional Grade**: Used by studios for production work
- ✅ **Complete Pipeline**: From modeling to rigging to animation
- ✅ **Beginner Friendly**: Sensible defaults, helpful error messages
- ✅ **Expert Ready**: Full access to advanced features when needed
- ✅ **Battle Tested**: Handles edge cases and complex geometry
- ✅ **Performance First**: Optimized for real-time applications

## 🔧 Advanced Features

### Bone Constraints
```typescript
// Add rotation limits to a knee joint
knee.addConstraint({
  type: 'rotation',
  min: new Vector3D(-Math.PI/2, -0.1, -0.1), // Can't bend backward
  max: new Vector3D(0, 0.1, 0.1),             // Can bend forward
  influence: 1.0,
  enabled: true
});
```

### Bone Mirroring
```typescript
// Pose left arm, then mirror to right
leftArm.setRotation(new Vector3D(Math.PI/3, 0, Math.PI/6));
skeleton.mirrorBones('left_', 'right_', 'x'); // Mirror across X-axis
```

### Animation System
```typescript
// Create animation clip
const walkCycle: AnimationClip = {
  name: 'walk',
  duration: 2.0,
  frames: [
    { time: 0.0, transforms: /* pose 1 */ },
    { time: 1.0, transforms: /* pose 2 */ },
    { time: 2.0, transforms: /* pose 3 */ }
  ],
  loop: true,
  speed: 1.0
};

skeleton.addAnimation(walkCycle);
skeleton.playAnimation('walk');
skeleton.updateAnimation(deltaTime); // Call in your game loop
```

## 🎓 Learning Path

1. **Start with EasyAPI**: `cube().selectAllFaces().inset().extrude()`
2. **Learn the Big 4**: Create → Select → Inset → Extrude  
3. **Add Polish**: `.bevel()` makes everything look professional
4. **Explore Bones**: Try `createHumanoidSkeleton()` and basic poses
5. **Master Skinning**: Use `createAutoSkinning()` for mesh deformation
6. **Advanced Features**: Constraints, IK, weight painting

## 🌟 Community & Support

- 📖 **Full Documentation**: Comprehensive examples and API reference
- 🤖 **AI-Friendly**: Designed to work perfectly with AI assistants
- 🎯 **Copy-Paste Ready**: All examples work out of the box
- 💡 **Best Practices**: Industry-standard workflows built in

Ready to build amazing 3D applications? Start with `npm install 3d-mesh-lib` and let your creativity flow!
