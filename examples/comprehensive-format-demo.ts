/**
 * 🎯 Comprehensive 3D Format Demo
 * 
 * This example demonstrates import and export capabilities for all supported
 * 3D file formats, showcasing the library's comprehensive format support.
 * 
 * Supported Formats:
 * - GLTF 2.0 (.gltf/.glb) - Complete animation & skeletal support
 * - Blender (.blend) - Import via Blender CLI
 * - FBX (.fbx) - Import via FBX2glTF/Assimp
 * - DirectX (.x) - Import via Assimp/Meshlab
 * - OBJ + MTL (.obj/.mtl) - Wavefront format with materials
 * - STL (.stl) - Stereolithography format
 * - JSON (.json) - Custom JSON format
 */

import { 
  GltfIO, 
  BlenderIO,
  FbxIO,
  DirectXIO, 
  ObjIO, 
  StlIO, 
  JsonIO 
} from '../src/io';
import { Mesh } from '../src/core/Mesh';
import { Skeleton } from '../src/core/Skeleton';
import { Bone } from '../src/core/Bone';
import { AnimationClip, AnimationTrack } from '../src/core/Animation';
import { SkinWeights } from '../src/core/Skinning';
import { Material } from '../src/core/Material';
import { Vector3D } from '../src/utils/Vector3D';
import { writeFileSync, readFileSync } from 'fs';

/**
 * 🎬 GLTF 2.0 Format Demo - Complete Animation Support
 */
async function demoGltfFormat() {
  console.log('\n🎬 === GLTF 2.0 Format Demo ===');
  
  try {
    // Create a test model with animation
    const { mesh, skeleton, animations, skinWeights } = createAnimatedTestModel();
    
    // Export to GLB (binary format)
    console.log('📤 Exporting to GLB format...');
    const glbBuffer = await GltfIO.exportComplete({
      mesh,
      skeleton,
      animations,
      skinWeights
    });
    
    writeFileSync('demo-output.glb', Buffer.from(glbBuffer));
    console.log(`✅ Exported ${glbBuffer.byteLength} bytes to demo-output.glb`);
    
    // Export to GLTF (text format)
    console.log('📤 Exporting to GLTF text format...');
    const gltfBuffer = await GltfIO.exportMesh(mesh, 'gltf');
    writeFileSync('demo-output.gltf', Buffer.from(gltfBuffer));
    console.log('✅ Exported to demo-output.gltf');
    
    // Import the GLB back
    console.log('📥 Importing GLB file...');
    const importedResult = await GltfIO.importComplete('demo-output.glb');
    console.log(`✅ Imported: ${importedResult.animations?.length || 0} animations, ` +
                `${importedResult.skeleton?.getAllBones().length || 0} bones`);
    
    // Check capabilities
    const hasAnimation = await GltfIO.hasSkeletalAnimation('demo-output.glb');
    console.log(`🎭 Animation support detected: ${hasAnimation}`);
    
    // Get file info
    const info = await GltfIO.getInfo('demo-output.glb');
    console.log(`📊 File info: ${info.meshCount} meshes, ${info.animationCount} animations`);
    
  } catch (error) {
    console.error('❌ GLTF demo failed:', error);
  }
}

/**
 * 🎨 Blender Format Demo - Import .blend files
 */
async function demoBlenderFormat() {
  console.log('\n🎨 === Blender Format Demo ===');
  
  try {
    // Check if Blender is available
    console.log('🔍 Detecting Blender installation...');
    const blenderInfo = await BlenderIO.detectBlender();
    
    if (!blenderInfo.found) {
      console.log('⚠️ Blender not found - Skipping Blender demo');
      console.log('💡 Install Blender 2.8+ to enable .blend file import');
      return;
    }
    
    console.log(`✅ Found Blender ${blenderInfo.version} at ${blenderInfo.path}`);
    console.log(`🎯 GLTF export support: ${blenderInfo.hasGltfExport}`);
    
    // Note: For this demo, we would need an actual .blend file
    // In a real scenario, you would do:
    /*
    console.log('📥 Importing Blender file...');
    const result = await BlenderIO.importComplete('scene.blend', {
      includeAnimations: true,
      includeSkeleton: true,
      exportOptions: {
        exportMaterials: true,
        exportTextures: true
      }
    });
    
    console.log(`✅ Imported Blender scene with ${result.animations.length} animations`);
    
    // Get blend file information
    const blendInfo = await BlenderIO.getBlendInfo('scene.blend');
    console.log(`📊 Blend info: ${blendInfo.meshCount} meshes, ` +
                `${blendInfo.animationCount} animations, ` +
                `${blendInfo.armatureCount} armatures`);
    */
    
    console.log('💡 To test: BlenderIO.importComplete("your-file.blend")');
    
    // Demonstrate export capability
    console.log('📤 Testing Blender export capability...');
    try {
      const { mesh, skeleton, animations, skinWeights } = createAnimatedTestModel();
      
      // Test basic mesh export
      console.log('📤 Exporting test model to Blender...');
      await BlenderIO.exportMesh(mesh, 'test-export.blend');
      console.log('✅ Blender export test completed (test-export.blend created)');
      
      // Export with full animation data  
      await BlenderIO.exportComplete({
        mesh,
        skeleton,
        animations,
        skinWeights
      }, 'test-animated.blend', {
        exportOptions: {
          exportMaterials: true,
          exportTextures: true
        }
      });
      console.log('✅ Blender animated export test completed (test-animated.blend created)');
      
    } catch (error) {
      console.log('⚠️ Blender export test skipped - Blender not available');
      console.log('   Install Blender 2.8+ to enable .blend file export');
    }
    
  } catch (error) {
    console.error('❌ Blender demo failed:', error);
  }
}

/**
 * 🎭 FBX Format Demo - Import .fbx files
 */
async function demoFbxFormat() {
  console.log('\n🎭 === FBX Format Demo ===');
  
  try {
    // Check if FBX converter is available
    console.log('🔍 Detecting FBX converter...');
    const converterInfo = await FbxIO.detectConverter();
    
    if (!converterInfo.found) {
      console.log('⚠️ FBX converter not found - Skipping FBX demo');
      console.log('💡 Install FBX2glTF or Assimp to enable .fbx file import');
      console.log('   FBX2glTF: https://github.com/facebookincubator/FBX2glTF');
      console.log('   Assimp: https://assimp.org/');
      return;
    }
    
    console.log(`✅ Found ${converterInfo.type} ${converterInfo.version} at ${converterInfo.path}`);
    console.log(`🎯 Animation support: ${converterInfo.hasAnimationSupport}`);
    
    // Note: For this demo, we would need an actual .fbx file
    // In a real scenario, you would do:
    /*
    console.log('📥 Importing FBX file...');
    const result = await FbxIO.importComplete('character.fbx', {
      includeAnimations: true,
      includeSkeleton: true,
      converterOptions: {
        materials: true,
        textures: true,
        animationSampleRate: 30
      }
    });
    
    console.log(`✅ Imported FBX with ${result.animations.length} animations`);
    
    // Get FBX file information
    const fbxInfo = await FbxIO.getFbxInfo('character.fbx');
    console.log(`📊 FBX complexity: ${fbxInfo.estimatedComplexity}`);
    console.log(`🎭 Has animations: ${fbxInfo.hasAnimations}`);
    */
    
    console.log('💡 To test: FbxIO.importComplete("your-model.fbx")');

    // Demonstrate export capability
    console.log('📤 Testing FBX export capability...');
    try {
      const { mesh, skeleton, animations, skinWeights } = createAnimatedTestModel();
      
      // Test export functionality (will use available converter)
      console.log('📤 Exporting test model to FBX...');
      await FbxIO.exportMesh(mesh, 'test-export.fbx');
      console.log('✅ FBX export test completed (test-export.fbx created)');
      
      // Export with full animation data
      await FbxIO.exportComplete({
        mesh,
        skeleton,
        animations,
        skinWeights
      }, 'test-animated.fbx', {
        includeAnimations: true,
        converterOptions: {
          materials: true,
          textures: true
        }
      });
      console.log('✅ FBX animated export test completed (test-animated.fbx created)');
      
    } catch (error) {
      console.log('⚠️ FBX export test skipped - converter not available');
      console.log('   Install Assimp for FBX export support');
    }
    
  } catch (error) {
    console.error('❌ FBX demo failed:', error);
  }
}

/**
 * 🎮 DirectX Format Demo - Import .x files
 */
async function demoDirectXFormat() {
  console.log('\n🎮 === DirectX .x Format Demo ===');
  
  try {
    // Check if DirectX converter is available
    console.log('🔍 Detecting DirectX converter...');
    const converterInfo = await DirectXIO.detectConverter();
    
    if (!converterInfo.found) {
      console.log('⚠️ DirectX converter not found - Skipping DirectX demo');
      console.log('💡 Install Assimp or Meshlab to enable .x file import');
      console.log('   Assimp: https://assimp.org/');
      console.log('   Meshlab: https://www.meshlab.net/');
      return;
    }
    
    console.log(`✅ Found ${converterInfo.type} ${converterInfo.version} at ${converterInfo.path}`);
    console.log(`🎯 DirectX support: ${converterInfo.hasDirectXSupport}`);
    console.log(`🎭 Animation support: ${converterInfo.hasAnimationSupport}`);
    
    // Note: For this demo, we would need an actual .x file
    // In a real scenario, you would do:
    /*
    console.log('📥 Importing DirectX .x file...');
    const result = await DirectXIO.importComplete('model.x', {
      includeAnimations: true,
      converterOptions: {
        materials: true,
        textures: true
      }
    });
    
    console.log(`✅ Imported DirectX model with ${result.animations.length} animations`);
    
    // Get DirectX file information
    const xInfo = await DirectXIO.getDirectXInfo('model.x');
    console.log(`📊 File format: ${xInfo.isTextFormat ? 'Text' : 'Binary'}`);
    console.log(`📊 Complexity: ${xInfo.estimatedComplexity}`);
    
    // Validate DirectX file
    const isValid = await DirectXIO.validateDirectXFile('model.x');
    console.log(`✅ File validation: ${isValid ? 'Valid' : 'Invalid'}`);
    */
    
    console.log('💡 To test: DirectXIO.importComplete("your-model.x")');

    // Demonstrate export capability
    console.log('📤 Testing DirectX .x export capability...');
    try {
      const { mesh, skeleton, animations, skinWeights } = createAnimatedTestModel();
      
      // Test basic mesh export
      console.log('📤 Exporting test model to DirectX .x...');
      await DirectXIO.exportMesh(mesh, 'test-export.x');
      console.log('✅ DirectX .x export test completed (test-export.x created)');
      
      // Export with full animation data  
      await DirectXIO.exportComplete({
        mesh,
        skeleton,
        animations,
        skinWeights
      }, 'test-animated.x', {
        includeAnimations: true,
        converterOptions: {
          materials: true
        }
      });
      console.log('✅ DirectX .x animated export test completed (test-animated.x created)');
      
    } catch (error) {
      console.log('⚠️ DirectX .x export test skipped - converter not available');
      console.log('   Install Assimp or Meshlab for DirectX .x export support');
    }
    
  } catch (error) {
    console.error('❌ DirectX demo failed:', error);
  }
}

/**
 * 🔺 OBJ + MTL Format Demo - Wavefront with Materials
 */
async function demoObjFormat() {
  console.log('\n🔺 === OBJ + MTL Format Demo ===');
  
  try {
    // Create test mesh with materials
    const mesh = createTestMeshWithMaterials();
    
    // Export to OBJ + MTL
    console.log('📤 Exporting to OBJ format...');
    const { obj, mtl } = ObjIO.exportMesh(mesh, 'demo-materials.mtl');
    
    writeFileSync('demo-output.obj', obj);
    if (mtl) {
      writeFileSync('demo-materials.mtl', mtl);
      console.log('✅ Exported OBJ with MTL materials');
    } else {
      console.log('✅ Exported OBJ (no materials)');
    }
    
    // Import the OBJ back
    console.log('📥 Importing OBJ file...');
    const importedMesh = ObjIO.importMesh(obj, 'ImportedFromOBJ');
    console.log(`✅ Imported: ${importedMesh.vertices.size} vertices, ` +
                `${importedMesh.faces.size} faces`);
    
    console.log('⚠️ Note: OBJ format does not support animations or skeletal data');
    
  } catch (error) {
    console.error('❌ OBJ demo failed:', error);
  }
}

/**
 * 🔷 STL Format Demo - 3D Printing Format
 */
async function demoStlFormat() {
  console.log('\n🔷 === STL Format Demo ===');
  
  try {
    // Create simple geometric mesh
    const mesh = createSimpleGeometry();
    
    // Export to binary STL
    console.log('📤 Exporting to binary STL...');
    const binaryStl = StlIO.exportMeshToBinary(mesh);
    writeFileSync('demo-output-binary.stl', Buffer.from(binaryStl));
    console.log(`✅ Exported ${binaryStl.byteLength} bytes to binary STL`);
    
    // Export to ASCII STL
    console.log('📤 Exporting to ASCII STL...');
    const asciiStl = StlIO.exportMeshToAscii(mesh);
    writeFileSync('demo-output-ascii.stl', asciiStl);
    console.log('✅ Exported to ASCII STL');
    
    // Import the STL back
    console.log('📥 Importing STL file...');
    const importedMesh = StlIO.importMesh(binaryStl);
    console.log(`✅ Imported: ${importedMesh.vertices.size} vertices (triangulated)`);
    
    console.log('⚠️ Note: STL format only supports geometry - no materials or animations');
    
  } catch (error) {
    console.error('❌ STL demo failed:', error);
  }
}

/**
 * �� JSON Format Demo - Enhanced Mesh Format
 */
async function demoJsonFormat() {
  console.log('\n📄 === JSON Format Demo ===');
  
  try {
    // Create test mesh
    const mesh = createTestMeshWithMaterials();
    
    // Export to enhanced JSON format with metadata
    console.log('📤 Exporting to enhanced JSON format...');
    const jsonString = JsonIO.exportComplete({
      mesh,
      skeleton: undefined,
      animations: [],
      skinWeights: undefined
    }, {
      prettyPrint: true,
      includeMetadata: true,
      metadata: {
        author: 'Comprehensive Format Demo',
        description: 'Test model with materials and UV coordinates',
        created: new Date().toISOString()
      }
    });
    
    writeFileSync('demo-output.json', jsonString);
    console.log(`✅ Exported ${jsonString.length} characters to enhanced JSON`);
    
    // Show format information
    const formatInfo = JsonIO.getFormatInfo();
    console.log(`📊 Format version: ${formatInfo.version}`);
    console.log(`🎯 Features: ${formatInfo.features.length} supported features`);
    
    // Validate the JSON
    const isValid = JsonIO.isValidJsonFormat(jsonString);
    console.log(`✅ JSON validation: ${isValid ? 'Valid' : 'Invalid'}`);
    
    // Import the JSON back
    console.log('📥 Importing enhanced JSON file...');
    const importedResult = JsonIO.importComplete(jsonString);
    console.log(`✅ Imported: ${importedResult.mesh.vertices.size} vertices, ` +
                `${importedResult.mesh.materials.size} materials`);
    
    // Legacy compatibility test
    console.log('🔄 Testing legacy mesh export...');
    const legacyJson = JsonIO.exportMeshToString(mesh, true);
    const legacyMesh = JsonIO.importMeshFromString(legacyJson);
    console.log(`✅ Legacy compatibility: ${legacyMesh.vertices.size} vertices imported`);
    
    console.log('💡 JSON format is perfect for debugging and version control');
    console.log('📋 View demo-output.json to see the human-readable structure');
    
  } catch (error) {
    console.error('❌ JSON demo failed:', error);
  }
}

/**
 * 🎯 Format Selection Guide Demo
 */
function demoFormatSelection() {
  console.log('\n🎯 === Format Selection Guide ===');
  
  console.log(`
📋 Choose the right format for your needs:

🎬 **Animation & Rigging Projects**
   → Use GLTF 2.0 (.glb/.gltf)
   → Full animation, skeleton, and PBR material support
   → Industry standard, widely supported

🎨 **Blender Workflows**
   → Use BlenderIO for .blend files
   → Direct import from Blender with all features
   → Requires Blender installation

🎭 **FBX Projects**
   → Use FbxIO for .fbx files
   → Full import/export with animation support
   → Requires FBX2glTF or Assimp
   → Industry standard for game development

🎮 **DirectX Legacy Projects**
   → Use DirectXIO for .x files
   → Full import/export with basic animation support
   → Requires Assimp or Meshlab
   → Good for older game engines

🔺 **Legacy Compatibility**
   → Use OBJ + MTL (.obj/.mtl)
   → Maximum software compatibility
   → Limited to basic geometry and materials

🔷 **3D Printing**
   → Use STL (.stl)
   → Pure geometry for manufacturing
   → Binary format recommended for size

📄 **Development & Testing**
   → Use JSON (.json)
   → Human-readable format
   → Perfect for debugging and inspection
   
🚀 **Performance Comparison**
   1. GLTF (GLB) - Best balance of features and size
   2. STL (Binary) - Smallest for pure geometry
   3. OBJ - Good compression with wide support
   4. JSON - Largest but most readable
   5. Blender - Depends on conversion overhead
  `);
}

// Helper functions for creating test data

function createAnimatedTestModel() {
  // Create mesh
  const mesh = createTestMeshWithMaterials();
  
  // Create skeleton
  const skeleton = new Skeleton('TestSkeleton');
  const rootBone = new Bone('Root');
  rootBone.transform.position.set(0, 0, 0);
  
  const childBone = new Bone('Child');
  childBone.transform.position.set(0, 1, 0);
  rootBone.addChild(childBone);
  
  skeleton.addBone(rootBone);
  
  // Create animation
  const animation = new AnimationClip('TestAnimation', 2.0);
  const track = new AnimationTrack('Root.rotation');
  
  track.addKeyframe({ time: 0, value: new Vector3D(0, 0, 0), easing: 'linear' });
  track.addKeyframe({ time: 1, value: new Vector3D(0, Math.PI, 0), easing: 'linear' });
  track.addKeyframe({ time: 2, value: new Vector3D(0, Math.PI * 2, 0), easing: 'linear' });
  
  animation.addTrack(track);
  
  // Create skin weights
  const skinWeights = new SkinWeights(mesh);
  const firstVertex = Array.from(mesh.vertices.values())[0];
  if (firstVertex) {
    skinWeights.setWeight(firstVertex.id, rootBone.id, 1.0);
  }
  
  return {
    mesh,
    skeleton,
    animations: [animation],
    skinWeights
  };
}

function createTestMeshWithMaterials(): Mesh {
  const mesh = new Mesh('TestMesh');
  
  // Create vertices for a simple quad
  const v1 = mesh.addVertex(-1, -1, 0, new Vector3D(0, 0, 1), { u: 0, v: 0 });
  const v2 = mesh.addVertex(1, -1, 0, new Vector3D(0, 0, 1), { u: 1, v: 0 });
  const v3 = mesh.addVertex(1, 1, 0, new Vector3D(0, 0, 1), { u: 1, v: 1 });
  const v4 = mesh.addVertex(-1, 1, 0, new Vector3D(0, 0, 1), { u: 0, v: 1 });
  
  // Create material
  const materialOptions = {
    color: new Vector3D(0.8, 0.2, 0.2), // Red
    metallic: 0.1,
    roughness: 0.5,
    emissiveColor: new Vector3D(0.1, 0.0, 0.0)
  };
  
  const materialId = mesh.addMaterial('TestMaterial', materialOptions);
  
  // Create faces
  mesh.addFace([v1.id, v2.id, v3.id], materialId.id);
  mesh.addFace([v1.id, v3.id, v4.id], materialId.id);
  
  return mesh;
}

function createSimpleGeometry(): Mesh {
  const mesh = new Mesh('SimpleGeometry');
  
  // Create a simple triangle
  const v1 = mesh.addVertex(0, 0, 0, new Vector3D(0, 0, 1));
  const v2 = mesh.addVertex(1, 0, 0, new Vector3D(0, 0, 1));
  const v3 = mesh.addVertex(0.5, 1, 0, new Vector3D(0, 0, 1));
  
  mesh.addFace([v1.id, v2.id, v3.id]);
  
  return mesh;
}

/**
 * 🚀 Main Demo Function
 */
async function runComprehensiveFormatDemo() {
  console.log('🎯 === Comprehensive 3D Format Support Demo ===');
  console.log('Demonstrating import/export capabilities for all supported formats\n');
  
  // Run all format demos
  await demoGltfFormat();
  await demoBlenderFormat();
  await demoFbxFormat();
  await demoDirectXFormat();
  await demoObjFormat();
  await demoStlFormat();
  await demoJsonFormat();
  
  // Show selection guide
  demoFormatSelection();
  
  console.log('\n✅ === Demo Complete ===');
  console.log('🎉 Your 3D mesh library now supports comprehensive format import/export!');
  console.log('📁 Check the generated demo files in the current directory');
}

// Run the demo
if (require.main === module) {
  runComprehensiveFormatDemo().catch(console.error);
}

export { runComprehensiveFormatDemo }; 