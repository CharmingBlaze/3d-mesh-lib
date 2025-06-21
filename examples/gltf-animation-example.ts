/**
 * 🎬 GLTF Animation & Skeletal Example
 * 
 * This example demonstrates the new comprehensive GLTF import/export functionality
 * including skeletal animation, bone hierarchies, and skinning data.
 * 
 * Features demonstrated:
 * - ✅ Complete model import (mesh + skeleton + animations)
 * - ✅ Selective import (skeleton only, animations only)
 * - ✅ Animation playback and manipulation
 * - ✅ Skeletal data export
 * - ✅ File format detection and validation
 */

import { GltfIO, GltfImportResult } from '../src/io/GltfIO';
import { Mesh } from '../src/core/Mesh';
import { Skeleton } from '../src/core/Skeleton';
import { AnimationClip, Animator } from '../src/core/Animation';
import { SkinWeights } from '../src/core/Skinning';

async function demonstrateGltfAnimationFeatures() {
  console.log('🎬 GLTF Animation & Skeletal Features Demo\n');

  try {
    // Example GLTF file path (replace with your actual file)
    const gltfFilePath = './assets/animated-character.glb';

    // ===== 1. Check file capabilities before import =====
    console.log('📋 1. Checking file capabilities...');
    
    const hasAnimation = await GltfIO.hasSkeletalAnimation(gltfFilePath);
    console.log(`   Skeletal animation support: ${hasAnimation ? '✅' : '❌'}`);
    
    const fileInfo = await GltfIO.getInfo(gltfFilePath);
    console.log(`   File info:`, {
      meshes: fileInfo.meshCount,
      animations: fileInfo.animationCount,
      bones: fileInfo.hasSkins ? '✅' : '❌',
      materials: fileInfo.materialCount
    });

    // ===== 2. Complete import (everything at once) =====
    console.log('\n🔄 2. Importing complete model...');
    
    const importResult: GltfImportResult = await GltfIO.importComplete(gltfFilePath);
    
    console.log(`   Imported mesh: ${importResult.mesh.vertices.size} vertices, ${importResult.mesh.faces.size} faces`);
    console.log(`   Skeleton: ${importResult.skeleton ? `${importResult.skeleton.getAllBones().length} bones` : 'None'}`);
    console.log(`   Animations: ${importResult.animations?.length || 0} clips`);
    console.log(`   Skin weights: ${importResult.skinWeights ? '✅' : '❌'}`);

    // ===== 3. Working with animations =====
    if (importResult.animations && importResult.animations.length > 0) {
      console.log('\n🎭 3. Working with animations...');
      
      const firstAnimation = importResult.animations[0];
      console.log(`   Animation: "${firstAnimation.name}"`);
      console.log(`   Duration: ${firstAnimation.duration}s`);
      console.log(`   Tracks: ${firstAnimation.getAllTracks().length}`);
      
      // List all animation tracks
      firstAnimation.getAllTracks().forEach((track, index) => {
        console.log(`     Track ${index}: ${track.propertyPath} (${track.keyframes.length} keyframes)`);
      });

      // Create animator and play animation
      if (importResult.skeleton) {
        console.log('\n   🎮 Setting up animation playback...');
        const animator = new Animator();
        
        // Add animation clips
        importResult.animations.forEach(clip => {
          animator.addClip(clip);
        });
        
        // Add skeleton as animation target
        importResult.skeleton.getAllBones().forEach(bone => {
          animator.addTarget(bone as any); // Assuming bone implements AnimationTarget
        });
        
        // Play first animation
        const success = animator.play(firstAnimation.name, {
          speed: 1.0,
          weight: 1.0
        });
        
        console.log(`   Animation playback started: ${success ? '✅' : '❌'}`);
        
        // Simulate animation update
        for (let i = 0; i < 5; i++) {
          animator.update(0.1); // Update with 100ms delta time
          console.log(`     Frame ${i + 1}: time = ${animator.getTime(firstAnimation.name)?.toFixed(2)}s`);
        }
      }
    }

    // ===== 4. Working with skeleton =====
    if (importResult.skeleton) {
      console.log('\n🦴 4. Working with skeleton...');
      
      const skeleton = importResult.skeleton;
      console.log(`   Skeleton: "${skeleton.name}"`);
      
      // List bone hierarchy
      const rootBones = skeleton.getAllBones().filter(bone => !bone.parent);
      console.log('   Bone hierarchy:');
      
      function printBoneHierarchy(bone: any, depth = 0) {
        const indent = '     ' + '  '.repeat(depth);
        console.log(`${indent}├─ ${bone.name} (ID: ${bone.id})`);
        bone.children.forEach((child: any) => printBoneHierarchy(child, depth + 1));
      }
      
      rootBones.forEach(bone => printBoneHierarchy(bone));
    }

    // ===== 5. Working with skin weights =====
    if (importResult.skinWeights) {
      console.log('\n🎯 5. Working with skin weights...');
      
      const skinWeights = importResult.skinWeights;
      console.log(`   Skin weights for mesh: ${importResult.mesh.name || 'Unnamed'}`);
      
      // Sample a few vertices to show weight distribution
      let vertexCount = 0;
      for (const vertex of importResult.mesh.vertices.values()) {
        if (vertexCount >= 3) break; // Just show first 3 vertices
        
        const weights = skinWeights.getVertexWeights(vertex.id);
        console.log(`     Vertex ${vertexCount}: ${weights.length} bone influences`);
        
        weights.slice(0, 2).forEach(weight => {
          console.log(`       └─ Bone ${weight.boneId}: ${(weight.weight * 100).toFixed(1)}%`);
        });
        
        vertexCount++;
      }
    }

    // ===== 6. Selective imports =====
    console.log('\n🎯 6. Selective imports...');
    
    // Import only skeleton
    const skeletonOnly = await GltfIO.importSkeleton(gltfFilePath);
    console.log(`   Skeleton-only import: ${skeletonOnly ? `${skeletonOnly.getAllBones().length} bones` : 'None'}`);
    
    // Import only animations
    const animationsOnly = await GltfIO.importAnimations(gltfFilePath, skeletonOnly);
    console.log(`   Animation-only import: ${animationsOnly.length} clips`);

    // ===== 7. Export complete model =====
    console.log('\n💾 7. Exporting complete model...');
    
    const exportedBuffer = await GltfIO.exportComplete(importResult);
    console.log(`   Exported GLB size: ${(exportedBuffer.byteLength / 1024).toFixed(1)} KB`);
    
    // ===== 8. Export animations only =====
    if (importResult.animations && importResult.skeleton) {
      console.log('\n🎬 8. Exporting animations only...');
      
      const animationBuffer = await GltfIO.exportAnimations(
        importResult.animations, 
        importResult.skeleton
      );
      console.log(`   Animation-only GLB size: ${(animationBuffer.byteLength / 1024).toFixed(1)} KB`);
    }

    // ===== 9. Create custom animation =====
    console.log('\n🎨 9. Creating custom animation...');
    
    if (importResult.skeleton) {
      const customClip = new AnimationClip('CustomRotation', 2.0);
      
      // Add rotation animation to first bone
      const firstBone = importResult.skeleton.getAllBones()[0];
      if (firstBone) {
        customClip.addTrack(`${firstBone.name}.rotation`, [
          { time: 0, value: { x: 0, y: 0, z: 0 }, easing: 'easeInOut' },
          { time: 1, value: { x: 0, y: Math.PI, z: 0 }, easing: 'easeInOut' },
          { time: 2, value: { x: 0, y: Math.PI * 2, z: 0 }, easing: 'easeInOut' }
        ] as any);
        
        console.log(`   Created custom animation: "${customClip.name}" (${customClip.duration}s)`);
        console.log(`   Tracks: ${customClip.getAllTracks().length}`);
        
        // Export custom animation
        const customAnimBuffer = await GltfIO.exportAnimations([customClip], importResult.skeleton);
        console.log(`   Custom animation GLB size: ${(customAnimBuffer.byteLength / 1024).toFixed(1)} KB`);
      }
    }

    console.log('\n✅ GLTF Animation demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during GLTF animation demo:', error);
    
    // Fallback: demonstrate with basic mesh
    console.log('\n🔄 Falling back to basic mesh import...');
    try {
      const basicMesh = await GltfIO.importMesh('./assets/simple-model.glb');
      console.log(`   Basic import successful: ${basicMesh.vertices.size} vertices`);
    } catch (fallbackError) {
      console.error('❌ Even basic import failed:', fallbackError);
    }
  }
}

// Helper function to create a sample animated mesh for testing
export async function createSampleAnimatedMesh(): Promise<GltfImportResult> {
  console.log('🎯 Creating sample animated mesh for testing...');
  
  const mesh = new Mesh('TestMesh');
  
  // Create a simple cube
  const vertices = [
    // Front face
    mesh.addVertex(-1, -1, 1),
    mesh.addVertex(1, -1, 1),
    mesh.addVertex(1, 1, 1),
    mesh.addVertex(-1, 1, 1),
    // Back face  
    mesh.addVertex(-1, -1, -1),
    mesh.addVertex(-1, 1, -1),
    mesh.addVertex(1, 1, -1),
    mesh.addVertex(1, -1, -1)
  ];
  
  // Add faces
  const indices = [
    0, 1, 2, 0, 2, 3, // Front
    4, 5, 6, 4, 6, 7, // Back
    0, 4, 7, 0, 7, 1, // Bottom
    2, 6, 5, 2, 5, 3, // Top
    0, 3, 5, 0, 5, 4, // Left
    1, 7, 6, 1, 6, 2  // Right
  ];
  
  for (let i = 0; i < indices.length; i += 3) {
    mesh.addFace([
      vertices[indices[i]].id,
      vertices[indices[i + 1]].id,
      vertices[indices[i + 2]].id
    ]);
  }
  
  // Create simple skeleton
  const skeleton = new Skeleton('TestSkeleton');
  // ... (skeleton creation would go here)
  
  // Create simple animation
  const animation = new AnimationClip('TestSpin', 2.0);
  // ... (animation creation would go here)
  
  return {
    mesh,
    skeleton,
    animations: [animation],
    // skinWeights would be undefined for this simple test
  };
}

// Export the main demo function
export { demonstrateGltfAnimationFeatures };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateGltfAnimationFeatures().catch(console.error);
} 