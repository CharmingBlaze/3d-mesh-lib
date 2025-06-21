/**
 * 🦴 Bone System Demo - Complete skeletal animation showcase
 * 
 * This demonstrates the full power of the bone system including:
 * - Bone creation and hierarchy
 * - Skeleton management
 * - Automatic skinning
 * - Pose saving/loading
 * - Weight painting
 * - Skeletal deformation
 */

import { 
  Bone,
  Skeleton, 
  createHumanoidSkeleton,
  createSpineChain,
  createArmChain,
  createLegChain,
  SkinWeights,
  SkinBinder,
  createAutoSkinning,
  cube,
  cylinder
} from '../src/index';
import { Vector3D } from '../src/utils/Vector3D';

console.log('🦴 3D-Mesh-Lib - Complete Bone System Demo\n');

// ===================================
// 🦴 1. BASIC BONE CREATION
// ===================================
console.log('🦴 1. Creating individual bones...\n');

// Create a simple bone
const rootBone = new Bone('root', new Vector3D(0, 0, 0), 1.5);
console.log(`Root bone: ${rootBone.info()}`);

// Create child bones
const spine1 = new Bone('spine_1', new Vector3D(0, 1.5, 0), 1.2);
const spine2 = new Bone('spine_2', new Vector3D(0, 1.2, 0), 1.0);
const head = new Bone('head', new Vector3D(0, 1.0, 0), 0.8);

// Build hierarchy
rootBone.addChild(spine1);
spine1.addChild(spine2);
spine2.addChild(head);

console.log(`Built spine chain: ${rootBone.getStats().totalBones} total bones`);
console.log(`Head position: ${head.getHeadPosition()}`);
console.log(`Head tail position: ${head.getTailPosition()}\n`);

// ===================================
// 🏗️ 2. BONE FACTORY METHODS
// ===================================
console.log('🏗️ 2. Using bone factory methods...\n');

// Create pre-built bone chains
const spineChain = createSpineChain(5, 1.2);
console.log(`Spine chain: ${spineChain.getStats().totalBones} bones, depth: ${spineChain.getStats().maxDepth}`);

const leftArm = createArmChain('left', 2.0, 1.5);
console.log(`Left arm: ${leftArm.getStats().totalBones} bones`);

const rightLeg = createLegChain('right', 2.5, 2.0);
console.log(`Right leg: ${rightLeg.getStats().totalBones} bones\n`);

// ===================================
// 🦴 3. COMPLETE SKELETON CREATION
// ===================================
console.log('🦴 3. Creating complete skeletons...\n');

// Create humanoid skeleton
const humanoid = createHumanoidSkeleton('MainCharacter');
console.log(`Humanoid skeleton: ${humanoid.info()}`);

// Find specific bones
const leftShoulder = humanoid.findBone('left_shoulder');
const rightHand = humanoid.findBone('right_hand');

if (leftShoulder) {
  console.log(`Found left shoulder: ${leftShoulder.info()}`);
}

if (rightHand) {
  console.log(`Found right hand: ${rightHand.info()}`);
}

// Find bone patterns
const leftBones = humanoid.findBones(/^left_/);
console.log(`Found ${leftBones.length} left-side bones`);

const spineBones = humanoid.findBones('spine');
console.log(`Found ${spineBones.length} spine bones\n`);

// ===================================
// 🎭 4. POSE MANAGEMENT
// ===================================
console.log('🎭 4. Pose management...\n');

// Save the current pose as rest pose
humanoid.saveRestPose();
console.log('✅ Saved rest pose');

// Modify some bones
const spine = humanoid.findBone('spine_2');
if (spine) {
  spine.setRotation(new Vector3D(0, 0, Math.PI / 6)); // 30-degree bend
  console.log(`Bent spine: ${spine.info()}`);
}

const leftUpperArm = humanoid.findBone('left_upper_arm');
if (leftUpperArm) {
  leftUpperArm.setRotation(new Vector3D(Math.PI / 4, 0, 0)); // Raise arm
  console.log(`Raised left arm: ${leftUpperArm.info()}`);
}

// Save action pose
humanoid.savePose('action', 'Character in action pose');
console.log('✅ Saved action pose');

// Create T-pose
humanoid.restoreRestPose();
if (leftUpperArm) {
  leftUpperArm.setRotation(new Vector3D(0, 0, -Math.PI / 2)); // T-pose
}
const rightUpperArm = humanoid.findBone('right_upper_arm');
if (rightUpperArm) {
  rightUpperArm.setRotation(new Vector3D(0, 0, Math.PI / 2)); // T-pose
}

humanoid.savePose('t-pose', 'Standard T-pose for rigging');
console.log('✅ Saved T-pose');

// Test pose blending
console.log('\n🎭 Testing pose blending...');
humanoid.loadPose('rest');
console.log('Loaded rest pose');

humanoid.blendPoses('rest', 'action', 0.5);
console.log('Blended 50% between rest and action poses');

humanoid.blendPoses('rest', 't-pose', 0.7);
console.log('Blended 70% towards T-pose\n');

// ===================================
// 🎯 5. SKINNING SYSTEM
// ===================================
console.log('🎯 5. Skinning system demo...\n');

// Create a simple character mesh (cylinder)
const characterMesh = cylinder(0.8, 4, 12).mesh;
console.log(`Character mesh: ${characterMesh.vertices.size} vertices, ${characterMesh.faces.size} faces`);

// Create skin weights
const skinWeights = new SkinWeights(characterMesh);
console.log(`Created skin weights for mesh`);

// Create automatic skin binding
const skinBinder = new SkinBinder(characterMesh, humanoid);
const boundVertices = skinBinder.bindVerticesAutomatically(skinWeights);
console.log(`✅ Automatically bound ${boundVertices} vertices to skeleton`);

// Get skinning statistics
const skinStats = skinWeights.getStats();
console.log(`Skinning stats: ${skinWeights.info()}`);

// Test weight painting
console.log('\n🎨 Testing weight painting...');
const shoulderPos = new Vector3D(0, 2, 0);
const leftShoulderBone = humanoid.findBone('left_shoulder');

if (leftShoulderBone) {
  const painted = skinWeights.paintWeights(
    shoulderPos,        // brush center
    1.0,               // brush radius
    leftShoulderBone.id, // bone to paint for
    0.8,               // strength
    'add'              // mode
  );
  console.log(`🎨 Painted weights on ${painted} vertices for left shoulder`);
}

// ===================================
// 🔄 6. SKELETAL DEFORMATION
// ===================================
console.log('\n🔄 6. Skeletal deformation...\n');

// Load T-pose and apply to mesh
humanoid.loadPose('t-pose');
console.log('Loaded T-pose');

// Apply skeletal deformation
skinWeights.applySkeleton(humanoid);
console.log('✅ Applied T-pose deformation to mesh');

// Switch to action pose
humanoid.loadPose('action');
console.log('Loaded action pose');

skinWeights.applySkeleton(humanoid);
console.log('✅ Applied action pose deformation to mesh');

// ===================================
// 🔗 7. BONE CONSTRAINTS
// ===================================
console.log('\n🔗 7. Bone constraints...\n');

// Add rotation limits to knee
const leftKnee = humanoid.findBone('left_shin');
if (leftKnee) {
  leftKnee.addConstraint({
    type: 'rotation',
    min: new Vector3D(-Math.PI / 2, -0.1, -0.1), // Can't bend backward
    max: new Vector3D(0, 0.1, 0.1),               // Can bend forward
    influence: 1.0,
    enabled: true
  });
  console.log(`Added rotation constraint to left knee`);
  
  // Test the constraint
  leftKnee.setRotation(new Vector3D(Math.PI / 3, 0, 0)); // Try to bend backward
  leftKnee.applyConstraints();
  console.log(`After constraint: ${leftKnee.info()}`);
}

// ===================================
// 🪞 8. BONE MIRRORING
// ===================================
console.log('\n🪞 8. Bone mirroring...\n');

// Pose the left arm
if (leftUpperArm) {
  leftUpperArm.setRotation(new Vector3D(Math.PI / 3, 0, Math.PI / 6));
  console.log(`Posed left arm: ${leftUpperArm.info()}`);
}

const leftForearm = humanoid.findBone('left_forearm');
if (leftForearm) {
  leftForearm.setRotation(new Vector3D(-Math.PI / 4, 0, 0));
  console.log(`Posed left forearm: ${leftForearm.info()}`);
}

// Mirror to right side
const mirrored = humanoid.mirrorBones('left_', 'right_', 'x');
console.log(`✅ Mirrored ${mirrored} bones from left to right side`);

const rightForearm = humanoid.findBone('right_forearm');
if (rightForearm) {
  console.log(`Mirrored right forearm: ${rightForearm.info()}`);
}

// ===================================
// 🔍 9. BONE SEARCHING AND TRAVERSAL
// ===================================
console.log('\n🔍 9. Advanced bone operations...\n');

// Get all bones and traverse hierarchy
const allBones = humanoid.getAllBones();
console.log(`Total bones in skeleton: ${allBones.length}`);

const rootBones = humanoid.getRootBones();
console.log(`Root bones: ${rootBones.length}`);

// Find bone hierarchy paths
if (rightHand) {
  const pathToHand = rightHand.getPathFromRoot();
  console.log(`Path to right hand: ${pathToHand.map(b => b.name).join(' -> ')}`);
  
  const handDescendants = rightHand.getDescendants();
  console.log(`Right hand descendants: ${handDescendants.length}`);
}

// ===================================
// 📊 10. FINAL STATISTICS
// ===================================
console.log('\n📊 Final statistics...\n');

const finalStats = humanoid.getStats();
console.log(`Final skeleton stats:`);
console.log(`  • Total bones: ${finalStats.totalBones}`);
console.log(`  • Root bones: ${finalStats.rootBones}`);
console.log(`  • Max depth: ${finalStats.maxDepth}`);
console.log(`  • Saved poses: ${finalStats.savedPoses}`);
console.log(`  • Has constraints: ${finalStats.hasConstraints}`);

const finalSkinStats = skinWeights.getStats();
console.log(`\nFinal skinning stats:`);
console.log(`  • Skinned vertices: ${finalSkinStats.skinnedVertices}`);
console.log(`  • Average weights per vertex: ${finalSkinStats.averageWeights.toFixed(1)}`);
console.log(`  • Max weights per vertex: ${finalSkinStats.maxWeights}`);
console.log(`  • Active bones: ${finalSkinStats.activeBones}`);
console.log(`  • Weights valid: ${finalSkinStats.isValid}`);

// ===================================
// 🎉 DEMO COMPLETE
// ===================================
console.log('\n🎉 Bone System Demo Complete!\n');

console.log('🦴 What you learned:');
console.log('  ✅ Individual bone creation and hierarchy');
console.log('  ✅ Bone factory methods (spine, arm, leg chains)');
console.log('  ✅ Complete skeleton management');
console.log('  ✅ Pose saving, loading, and blending');
console.log('  ✅ Automatic skinning and weight generation');
console.log('  ✅ Weight painting and editing');
console.log('  ✅ Real-time skeletal deformation');
console.log('  ✅ Bone constraints and limits');
console.log('  ✅ Bone mirroring (left/right symmetry)');
console.log('  ✅ Advanced bone searching and traversal');
console.log('');

console.log('🎯 The Bone System Philosophy:');
console.log('  • Complete character rigging solution');
console.log('  • Professional skeletal animation tools');
console.log('  • Easy automatic skinning');
console.log('  • Flexible pose and animation system');
console.log('  • Industry-standard workflow support');
console.log('');

console.log('🚀 Your 3D mesh library now supports full character animation!');
console.log('💡 Perfect for games, character modeling, and animation pipelines!'); 