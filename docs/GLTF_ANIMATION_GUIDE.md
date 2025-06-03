# 🎬 GLTF Animation & Skeletal Features Guide

This guide covers the comprehensive GLTF animation and skeletal features added to the 3D mesh library, including import/export of bones, animations, and skinning data.

## 🎯 Overview

The GLTF I/O module now supports:

- ✅ **Complete Model Import/Export** - Mesh + Skeleton + Animations in one operation
- ✅ **Selective Import** - Import only specific components (mesh, skeleton, or animations)
- ✅ **Skeletal Animation** - Full bone hierarchy and keyframe animation support
- ✅ **Skinning Data** - Vertex weights and bone influences
- ✅ **Animation Playback** - Real-time animation with interpolation and easing
- ✅ **Format Detection** - Automatic detection of animation capabilities
- ✅ **Modular Architecture** - Clean separation of concerns for easy maintenance

## 🏗️ Architecture

The GLTF functionality is split into focused modules:

```
src/io/gltf/
├── types.ts      # Type definitions and interfaces
├── basic.ts      # Basic mesh import/export
├── skeleton.ts   # Skeletal data and skinning
├── animation.ts  # Animation tracks and keyframes
└── index.ts      # Main unified interface
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { GltfIO } from '../src/io/GltfIO';

// Import complete model with animations
const result = await GltfIO.importComplete('character.glb');
console.log(`Imported: ${result.mesh.vertices.size} vertices, ${result.animations?.length || 0} animations`);

// Export complete model
const glbBuffer = await GltfIO.exportComplete(result);
```

### Check File Capabilities

```typescript
// Check if file has skeletal animations
const hasAnimations = await GltfIO.hasSkeletalAnimation('model.glb');

// Get detailed file information
const info = await GltfIO.getInfo('model.glb');
console.log(`Meshes: ${info.meshCount}, Animations: ${info.animationCount}`);
```

## 📥 Importing Models

### Complete Import

Import everything (mesh, skeleton, animations, skin weights) in one operation:

```typescript
import { GltfIO, GltfImportResult } from '../src/io/GltfIO';

const result: GltfImportResult = await GltfIO.importComplete('animated-character.glb');

// Access imported data
const mesh = result.mesh;                    // Mesh geometry
const skeleton = result.skeleton;            // Bone hierarchy
const animations = result.animations;        // Animation clips
const skinWeights = result.skinWeights;      // Vertex-bone bindings
```

### Selective Import

Import only specific components:

```typescript
// Import only the mesh
const mesh = await GltfIO.importMesh('model.glb');

// Import only the skeleton
const skeleton = await GltfIO.importSkeleton('model.glb');

// Import only animations (optionally with skeleton for bone mapping)
const animations = await GltfIO.importAnimations('model.glb', skeleton);
```

## 📤 Exporting Models

### Complete Export

Export everything in one GLB file:

```typescript
// Assuming you have a complete model
const result: GltfImportResult = {
  mesh: myMesh,
  skeleton: mySkeleton,
  animations: myAnimations,
  skinWeights: mySkinWeights
};

const glbBuffer = await GltfIO.exportComplete(result);
// Save glbBuffer to file
```

### Selective Export

Export only specific components:

```typescript
// Export only mesh
const meshBuffer = await GltfIO.exportMesh(mesh);

// Export only animations
const animBuffer = await GltfIO.exportAnimations(animations, skeleton);
```

## 🦴 Working with Skeletons

### Accessing Bone Hierarchy

```typescript
const skeleton = result.skeleton;
if (skeleton) {
  console.log(`Skeleton: ${skeleton.name}`);
  
  // Get all bones
  const allBones = skeleton.getAllBones();
  console.log(`Total bones: ${allBones.length}`);
  
  // Find root bones (no parent)
  const rootBones = allBones.filter(bone => !bone.parent);
  
  // Traverse hierarchy
  function printBoneHierarchy(bone, depth = 0) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}- ${bone.name}`);
    bone.children.forEach(child => printBoneHierarchy(child, depth + 1));
  }
  
  rootBones.forEach(bone => printBoneHierarchy(bone));
}
```

### Bone Transforms

```typescript
const bone = skeleton.getAllBones()[0];

// Access bone transforms
console.log('Position:', bone.transform.position);
console.log('Rotation:', bone.transform.rotation);
console.log('Scale:', bone.transform.scale);

// Access rest pose
console.log('Rest position:', bone.restTransform.position);

// Access bind pose (for skinning)
console.log('Bind position:', bone.bindTransform.position);
```

## 🎭 Working with Animations

### Animation Clips

```typescript
const animations = result.animations;
if (animations && animations.length > 0) {
  const clip = animations[0];
  
  console.log(`Animation: ${clip.name}`);
  console.log(`Duration: ${clip.duration}s`);
  console.log(`Loop: ${clip.loop}`);
  
  // Get all tracks
  const tracks = clip.getAllTracks();
  tracks.forEach(track => {
    console.log(`Track: ${track.propertyPath} (${track.keyframes.length} keyframes)`);
  });
}
```

### Animation Playback

```typescript
import { Animator, BoneAnimationTarget } from '../src/core/Animation';

// Create animator
const animator = new Animator();

// Add animation clips
animations.forEach(clip => {
  animator.addClip(clip);
});

// Add bones as animation targets
if (skeleton) {
  skeleton.getAllBones().forEach(bone => {
    const target = new BoneAnimationTarget(bone);
    animator.addTarget(target);
  });
}

// Play animation
const success = animator.play('WalkCycle', {
  speed: 1.0,
  weight: 1.0,
  startTime: 0
});

// Update animation (in your render loop)
function animate(deltaTime) {
  animator.update(deltaTime);
}
```

### Creating Custom Animations

```typescript
import { AnimationClip } from '../src/core/Animation';
import { Vector3D } from '../src/utils/Vector3D';

// Create new animation clip
const customAnimation = new AnimationClip('CustomSpin', 2.0);

// Add rotation track
customAnimation.addTrack('RootBone.rotation', [
  { time: 0, value: new Vector3D(0, 0, 0), easing: 'easeInOut' },
  { time: 1, value: new Vector3D(0, Math.PI, 0), easing: 'easeInOut' },
  { time: 2, value: new Vector3D(0, Math.PI * 2, 0), easing: 'easeInOut' }
]);

// Add position track
customAnimation.addTrack('RootBone.position', [
  { time: 0, value: new Vector3D(0, 0, 0), easing: 'linear' },
  { time: 1, value: new Vector3D(0, 2, 0), easing: 'linear' },
  { time: 2, value: new Vector3D(0, 0, 0), easing: 'linear' }
]);

console.log(`Created animation: ${customAnimation.name} (${customAnimation.duration}s)`);
```

## 🎯 Working with Skin Weights

### Accessing Vertex Weights

```typescript
const skinWeights = result.skinWeights;
if (skinWeights && skeleton) {
  // Get weights for a specific vertex
  const vertexId = Array.from(mesh.vertices.keys())[0];
  const weights = skinWeights.getVertexWeights(vertexId);
  
  console.log(`Vertex ${vertexId} influences:`);
  weights.forEach(weight => {
    console.log(`  Bone ${weight.boneId}: ${(weight.weight * 100).toFixed(1)}%`);
  });
}
```

### Modifying Skin Weights

```typescript
// Set weight for vertex-bone pair
skinWeights.setWeight(vertexId, boneId, 0.75);

// Get normalized weights (sum = 1.0)
const normalizedWeights = skinWeights.getNormalizedWeights(vertexId);
```

## 🛠️ Advanced Features

### Animation Blending

```typescript
// Play multiple animations with blending
animator.play('Walk', { weight: 0.7 });
animator.play('Run', { weight: 0.3, blend: true });

// The animations will be blended based on their weights
```

### Animation Events

```typescript
// Set up animation event callbacks
animator.onAnimationStart = (clipName) => {
  console.log(`Animation started: ${clipName}`);
};

animator.onAnimationEnd = (clipName) => {
  console.log(`Animation finished: ${clipName}`);
};

animator.onAnimationLoop = (clipName) => {
  console.log(`Animation looped: ${clipName}`);
};
```

### Performance Optimization

```typescript
// Enable/disable specific tracks
track.enabled = false;

// Adjust track weight
track.weight = 0.5;

// Set animation time scale
animator.timeScale = 0.5; // Half speed
```

## 🔧 Configuration Options

### Import Options

```typescript
const options = {
  gltf: {
    postProcess: true,    // Enable post-processing
    loadImages: true,     // Load texture images
    loadBuffers: true,    // Load binary buffers
  }
};

const result = await GltfIO.importComplete('model.glb', options);
```

### Export Options

```typescript
const exportOptions = {
  // Custom export settings can be added here
};

const buffer = await GltfIO.exportComplete(result, exportOptions);
```

## 🎯 Best Practices

### 1. Check Capabilities First

```typescript
// Always check if the file has the features you need
const info = await GltfIO.getInfo('model.glb');
if (info.hasAnimations) {
  // Import with animations
  const result = await GltfIO.importComplete('model.glb');
} else {
  // Import basic mesh only
  const mesh = await GltfIO.importMesh('model.glb');
}
```

### 2. Use Selective Import for Performance

```typescript
// If you only need the skeleton for retargeting
const skeleton = await GltfIO.importSkeleton('character.glb');

// If you only need animations for a different character
const animations = await GltfIO.importAnimations('animations.glb', existingSkeleton);
```

### 3. Handle Errors Gracefully

```typescript
try {
  const result = await GltfIO.importComplete('model.glb');
  // Process result
} catch (error) {
  console.error('Failed to import animated model:', error);
  
  // Fallback to basic import
  try {
    const mesh = await GltfIO.importMesh('model.glb');
    console.log('Imported basic mesh successfully');
  } catch (fallbackError) {
    console.error('Complete import failure:', fallbackError);
  }
}
```

### 4. Optimize Animation Updates

```typescript
// Only update animations when necessary
let lastTime = 0;
function render(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  
  if (deltaTime > 0 && deltaTime < 0.1) { // Reasonable delta time
    animator.update(deltaTime);
  }
  
  requestAnimationFrame(render);
}
```

## 📝 Examples

See `examples/gltf-animation-example.ts` for a comprehensive demonstration of all features.

## 🐛 Troubleshooting

### Common Issues

1. **"No animations found"** - Check if the GLTF file actually contains animation data
2. **"Skeleton mismatch"** - Ensure the skeleton and animations are from compatible files
3. **"Memory issues"** - Use selective import for large files with many animations
4. **"Bone hierarchy errors"** - Verify the GLTF file has proper joint relationships

### Debug Information

Enable verbose logging to see detailed import/export information:

```typescript
// The library logs important information to console
// Look for messages starting with "glTF" or "GLTF"
```

## 🔮 Future Enhancements

- Morph target animations
- Advanced skinning techniques (dual quaternion)
- Animation compression
- Real-time retargeting
- Physics-based animations

---

For more information, see the source code in `src/io/gltf/` and the example in `examples/gltf-animation-example.ts`. 