// 🎯 3D-Mesh-Lib - Complete 3D mesh editing library
// Your ultimate 3D mesh co-pilot for TypeScript/JavaScript!

// 🚀 Easy API - Perfect for AI and beginners
export * from './core/EasyAPI';

// 🔧 Core system exports
export * from './core';

// 🎲 Primitive shapes
export { PrimitiveFactory } from './primitives/PrimitiveFactory';

// 🔧 Utilities
export * from './utils';

// 🎯 File Format I/O - Complete format support
export * from './io';

// 🦴 Bone and Animation System
export {
  Bone, 
  BoneTransform,
  createSpineChain,
  createArmChain, 
  createLegChain
} from './core/Bone';

export {
  Skeleton,
  createHumanoidSkeleton,
  createQuadrupedSkeleton
} from './core/Skeleton';

export {
  SkinWeights,
  SkinBinder,
  createAutoSkinning
} from './core/Skinning';

export {
  AnimationClip,
  AnimationTrack,
  Animator,
  BoneAnimationTarget,
  createSpinAnimation,
  createPulseAnimation,
  createFadeAnimation,
  animateBone
} from './core/Animation';

// 🎯 Format-specific exports for direct access
export {
  GltfIO
} from './io/GltfIO';

export {
  BlenderIO
} from './io/BlenderIO';

export {
  FbxIO
} from './io/FbxIO';

export {
  DirectXIO
} from './io/DirectXIO';

export {
  ObjIO
} from './io/ObjIO';

export {
  StlIO
} from './io/StlIO';

export {
  JsonIO
} from './io/JsonIO';

// 🎯 Library information and quick start
export function libraryInfo(): string {
  const info = `🎯 3D-Mesh-Lib v1.2.0 Initialized
  
✨ Core Features:
  • 17+ mesh operations (extrude, inset, bevel, subdivide...)
  • Complete bone & skeletal animation system
  • 7 file format support (GLTF, Blender, FBX, DirectX, OBJ, STL, JSON)
  • AI-friendly fluent API for rapid prototyping

🎲 Quick Start:
  import { cube } from '3d-mesh-lib';
  const building = cube(3).selectAllFaces().inset(0.3).extrude(2);

📋 File Formats:
  • GLTF 2.0 (.gltf/.glb) - Complete animation support ⭐
  • Blender (.blend) - Direct import via Blender CLI
  • FBX (.fbx) - Import via FBX2glTF/Assimp
  • DirectX (.x) - Legacy format support
  • OBJ+MTL (.obj/.mtl) - Universal compatibility
  • STL (.stl) - 3D printing standard
  • JSON (.json) - Human-readable debugging

🦴 Animation System:
  • Skeletal hierarchies & bone chains
  • Automatic vertex skinning & weight painting
  • Keyframe animation with 16 easing functions
  • Pose management & blending

💡 Perfect for: Game development, 3D printing, CAD tools, procedural generation`;

  console.log(info);
  return info;
}

// 🎯 Quick format detection utility
export function detectFileFormat(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'gltf':
    case 'glb':
      return 'GLTF 2.0 - Complete animation support';
    case 'blend':
      return 'Blender - Requires Blender installation';
    case 'fbx':
      return 'FBX - Requires FBX2glTF or Assimp';
    case 'x':
      return 'DirectX - Requires Assimp or Meshlab';
    case 'obj':
      return 'OBJ+MTL - Universal compatibility';
    case 'stl':
      return 'STL - 3D printing standard';
    case 'json':
      return 'JSON - Human-readable format';
    default:
      return 'Unknown format - Check supported formats documentation';
  }
}

// TODO: Review and ensure all necessary commands and classes from ./core are exported via ./core/index.ts
// TODO: Create/verify index.ts files for ./utils, ./primitives, ./io for cleaner re-exports.

