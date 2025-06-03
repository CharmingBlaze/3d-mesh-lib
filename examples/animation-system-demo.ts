/**
 * 🎬 Animation System Demo - Professional keyframe animation showcase
 * 
 * This demonstrates the complete animation system including:
 * - Keyframe animation with multiple easing functions
 * - Bone animation with complex transformations
 * - Material property animation
 * - Animation blending and layering
 * - Pre-built animation clips
 * - Real-time animation playback
 */

import { 
  // Animation System
  Animator,
  AnimationClip,
  AnimationTrack,
  BoneAnimationTarget,
  MaterialAnimationTarget,
  createFadeAnimation,
  createSpinAnimation,
  createPulseAnimation,
  animateBone,
  animateMaterial,
  
  // Bone System
  Bone,
  createHumanoidSkeleton,
  createSpineChain,
  
  // Mesh and Materials
  cube,
  sphere,
  Material,
  
  // Utils
  Vector3D
} from '../src/index';

console.log('🎬 3D-Mesh-Lib - Complete Animation System Demo\n');

// ===================================
// 🎯 1. BASIC KEYFRAME ANIMATION
// ===================================
console.log('🎯 1. Basic keyframe animation...\n');

// Create a simple animation track
const positionTrack = new AnimationTrack<Vector3D>('transform.position');

// Add keyframes with different easing
positionTrack.addKey(0, new Vector3D(0, 0, 0), 'easeInOut');
positionTrack.addKey(1, new Vector3D(2, 0, 0), 'easeOutBounce');
positionTrack.addKey(2, new Vector3D(2, 2, 0), 'easeInElastic');
positionTrack.addKey(3, new Vector3D(0, 2, 0), 'easeOutBack');
positionTrack.addKey(4, new Vector3D(0, 0, 0), 'easeInOut');

console.log(`Created position track with ${positionTrack.keyframes.length} keyframes`);
console.log(`Track duration: ${positionTrack.getDuration()} seconds`);

// Test evaluation at different times
console.log('Position interpolation:');
for (let t = 0; t <= 4; t += 0.5) {
  const pos = positionTrack.evaluate(t);
  console.log(`  t=${t}s: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
}

// ===================================
// 🎬 2. ANIMATION CLIPS
// ===================================
console.log('\n🎬 2. Animation clips...\n');

// Create a complex animation clip
const complexClip = new AnimationClip('complex_movement', 3.0);
complexClip.loop = true;

// Add multiple tracks
complexClip.addTrack('transform.position', [
  { time: 0, value: new Vector3D(0, 0, 0) },
  { time: 1.5, value: new Vector3D(3, 1, 0) },
  { time: 3, value: new Vector3D(0, 0, 0) }
], 'easeInOutCubic');

complexClip.addTrack('transform.rotation', [
  { time: 0, value: new Vector3D(0, 0, 0) },
  { time: 1, value: new Vector3D(0, Math.PI, 0) },
  { time: 2, value: new Vector3D(0, Math.PI * 2, 0) },
  { time: 3, value: new Vector3D(0, Math.PI * 3, 0) }
], 'linear');

complexClip.addTrack('transform.scale', [
  { time: 0, value: new Vector3D(1, 1, 1) },
  { time: 1.5, value: new Vector3D(1.5, 0.5, 1.5) },
  { time: 3, value: new Vector3D(1, 1, 1) }
], 'easeInOutBack');

console.log(`Complex clip: ${complexClip.name}, duration: ${complexClip.getDuration()}s`);
console.log(`Tracks: ${complexClip.getAllTracks().length}`);

// Test clip evaluation
const clipValues = complexClip.evaluate(1.5);
console.log('Clip values at t=1.5s:');
for (const [path, value] of clipValues) {
  if (value instanceof Vector3D) {
    console.log(`  ${path}: (${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`);
  } else {
    console.log(`  ${path}: ${value}`);
  }
}

// ===================================
// 🦴 3. BONE ANIMATION
// ===================================
console.log('\n🦴 3. Bone animation...\n');

// Create a test bone
const testBone = new Bone('test_bone', new Vector3D(0, 0, 0), 2.0);
console.log(`Created bone: ${testBone.info()}`);

// Create bone animation target
const boneTarget = new BoneAnimationTarget(testBone);

// Test property access
console.log(`Bone position: ${testBone.transform.position}`);
console.log(`Via target: ${JSON.stringify(boneTarget.getProperty('transform.position'))}`);

// Create bone-specific animations
const boneRotationClip = AnimationClip.rotation(
  new Vector3D(0, 0, 0),           // From
  new Vector3D(0, Math.PI * 2, 0), // To (full Y rotation)
  2.0,                             // Duration
  'easeInOutQuad'                  // Easing
);

const boneWiggleClip = new AnimationClip('bone_wiggle', 1.0);
boneWiggleClip.loop = true;
boneWiggleClip.addTrack('transform.rotation.z', [
  { time: 0, value: -Math.PI / 6 },
  { time: 0.5, value: Math.PI / 6 },
  { time: 1, value: -Math.PI / 6 }
], 'easeInOutSine');

console.log(`Created bone rotation clip: ${boneRotationClip.getDuration()}s`);
console.log(`Created bone wiggle clip: ${boneWiggleClip.getDuration()}s, loop: ${boneWiggleClip.loop}`);

// ===================================
// 🎨 4. MATERIAL ANIMATION
// ===================================
console.log('\n🎨 4. Material animation...\n');

// Create test material
const testMaterial = new Material('animated_material');
testMaterial.color = [1.0, 0.0, 0.0, 1.0]; // Red
testMaterial.roughness = 0.5;
testMaterial.metallic = 0.0;

console.log(`Created material: ${testMaterial.name}`);
console.log(`Initial color: [${testMaterial.color.join(', ')}]`);

// Create material animation target
const materialTarget = new MaterialAnimationTarget(testMaterial);

// Create color animation
const colorFadeClip = new AnimationClip('color_fade', 2.0);
colorFadeClip.loop = true;

colorFadeClip.addTrack('color', [
  { time: 0, value: [1.0, 0.0, 0.0, 1.0] },    // Red
  { time: 0.5, value: [0.0, 1.0, 0.0, 1.0] },  // Green
  { time: 1.0, value: [0.0, 0.0, 1.0, 1.0] },  // Blue
  { time: 1.5, value: [1.0, 1.0, 0.0, 1.0] },  // Yellow
  { time: 2.0, value: [1.0, 0.0, 0.0, 1.0] }   // Back to red
], 'easeInOut');

// Metallic animation
colorFadeClip.addTrack('metallic', [
  { time: 0, value: 0.0 },
  { time: 1, value: 1.0 },
  { time: 2, value: 0.0 }
], 'easeInOutCubic');

console.log('Created color fade animation with metallic changes');

// ===================================
// 🎮 5. ANIMATOR SYSTEM
// ===================================
console.log('\n🎮 5. Animator system...\n');

// Create main animator
const animator = new Animator();

// Add targets
animator.addTarget(boneTarget);
animator.addTarget(materialTarget);

// Add clips
animator.addClip(complexClip);
animator.addClip(boneRotationClip);
animator.addClip(boneWiggleClip);
animator.addClip(colorFadeClip);

console.log(`Animator stats: ${JSON.stringify(animator.getStats())}`);

// Set up callbacks
animator.onAnimationStart = (clipName) => {
  console.log(`🎬 Animation started: ${clipName}`);
};

animator.onAnimationEnd = (clipName) => {
  console.log(`🏁 Animation ended: ${clipName}`);
};

animator.onAnimationLoop = (clipName) => {
  console.log(`🔄 Animation looped: ${clipName}`);
};

// Play multiple animations
console.log('\nStarting animations...');
animator.play('complex_movement', { speed: 1.0, weight: 1.0 });
animator.play('bone_wiggle', { speed: 2.0, weight: 0.5 }); // Faster, lower weight
animator.play('color_fade', { speed: 0.8 }); // Slower

console.log(`Active animations: ${animator.getActiveAnimations().join(', ')}`);

// ===================================
// 🏗️ 6. SKELETON ANIMATION
// ===================================
console.log('\n🏗️ 6. Skeleton animation...\n');

// Create humanoid skeleton
const character = createHumanoidSkeleton('AnimatedCharacter');
console.log(`Character skeleton: ${character.info()}`);

// Find bones to animate
const spine = character.findBone('spine_2');
const leftArm = character.findBone('left_upper_arm');
const rightArm = character.findBone('right_upper_arm');
const head = character.findBone('head');

if (spine && leftArm && rightArm && head) {
  console.log('Found key bones for animation');
  
  // Create wave animation for spine
  const spineWaveClip = new AnimationClip('spine_wave', 3.0);
  spineWaveClip.loop = true;
  
  spineWaveClip.addTrack('transform.rotation.z', [
    { time: 0, value: 0 },
    { time: 0.75, value: Math.PI / 8 },
    { time: 1.5, value: 0 },
    { time: 2.25, value: -Math.PI / 8 },
    { time: 3, value: 0 }
  ], 'easeInOutSine');
  
  // Create arm wave animations
  const leftArmWaveClip = new AnimationClip('left_arm_wave', 2.0);
  leftArmWaveClip.loop = true;
  
  leftArmWaveClip.addTrack('transform.rotation.z', [
    { time: 0, value: -Math.PI / 2 },     // T-pose
    { time: 0.5, value: -Math.PI / 4 },   // Wave up
    { time: 1, value: -Math.PI / 2 },     // Back to T-pose
    { time: 1.5, value: -3 * Math.PI / 4 }, // Wave down
    { time: 2, value: -Math.PI / 2 }      // Back to T-pose
  ], 'easeInOutBack');
  
  const rightArmWaveClip = new AnimationClip('right_arm_wave', 2.5);
  rightArmWaveClip.loop = true;
  
  rightArmWaveClip.addTrack('transform.rotation.z', [
    { time: 0, value: Math.PI / 2 },
    { time: 0.625, value: Math.PI / 4 },
    { time: 1.25, value: Math.PI / 2 },
    { time: 1.875, value: 3 * Math.PI / 4 },
    { time: 2.5, value: Math.PI / 2 }
  ], 'easeInOutElastic');
  
  // Head nod animation
  const headNodClip = new AnimationClip('head_nod', 1.5);
  headNodClip.loop = true;
  
  headNodClip.addTrack('transform.rotation.x', [
    { time: 0, value: 0 },
    { time: 0.375, value: Math.PI / 12 },  // Nod down
    { time: 0.75, value: 0 },              // Back to center
    { time: 1.125, value: -Math.PI / 24 }, // Slight up
    { time: 1.5, value: 0 }                // Back to center
  ], 'easeInOutQuad');
  
  // Create animators for each bone
  const spineAnimator = animateBone(spine, spineWaveClip, 1.0);
  const leftArmAnimator = animateBone(leftArm, leftArmWaveClip, 1.2);
  const rightArmAnimator = animateBone(rightArm, rightArmWaveClip, 0.8);
  const headAnimator = animateBone(head, headNodClip, 1.5);
  
  console.log('✅ Created skeleton animations');
  console.log(`  • Spine wave: ${spineWaveClip.getDuration()}s`);
  console.log(`  • Left arm wave: ${leftArmWaveClip.getDuration()}s`);
  console.log(`  • Right arm wave: ${rightArmWaveClip.getDuration()}s`);
  console.log(`  • Head nod: ${headNodClip.getDuration()}s`);
}

// ===================================
// 🏭 7. PRE-BUILT ANIMATIONS
// ===================================
console.log('\n🏭 7. Pre-built animation utilities...\n');

// Test utility animations
const fadeIn = createFadeAnimation(0, 1, 1.5);
const spinY = createSpinAnimation('y', 3.0, 2); // 2 revolutions
const pulse = createPulseAnimation(0.8, 1.4, 2.0);

console.log(`Fade in: ${fadeIn.getDuration()}s`);
console.log(`Spin Y: ${spinY.getDuration()}s, revolutions: 2, loop: ${spinY.loop}`);
console.log(`Pulse: ${pulse.getDuration()}s, loop: ${pulse.loop}`);

// Test AnimationClip static methods
const moveClip = AnimationClip.position(
  new Vector3D(-2, 0, 0),
  new Vector3D(2, 0, 0),
  2.0,
  'easeInOutBounce'
);

const rotateClip = AnimationClip.rotation(
  new Vector3D(0, 0, 0),
  new Vector3D(Math.PI, 0, Math.PI),
  1.5,
  'easeOutElastic'
);

const scaleClip = AnimationClip.scale(0.5, 2.0, 1.0, 'easeInOutBack');

console.log(`Move clip: ${moveClip.getDuration()}s`);
console.log(`Rotate clip: ${rotateClip.getDuration()}s`);
console.log(`Scale clip: ${scaleClip.getDuration()}s`);

// ===================================
// 🔄 8. ANIMATION UPDATE SIMULATION
// ===================================
console.log('\n🔄 8. Animation update simulation...\n');

console.log('Simulating 5 seconds of animation updates...');

// Simulate animation updates
const deltaTime = 1 / 60; // 60 FPS
let totalTime = 0;
const maxTime = 5.0;

let frameCount = 0;
while (totalTime < maxTime) {
  animator.update(deltaTime);
  totalTime += deltaTime;
  frameCount++;
  
  // Log every 60 frames (1 second)
  if (frameCount % 60 === 0) {
    const second = Math.floor(totalTime);
    const activeAnims = animator.getActiveAnimations();
    console.log(`  Frame ${frameCount} (${second}s): ${activeAnims.length} active animations`);
    
    // Show bone position
    if (testBone) {
      const pos = testBone.transform.position;
      console.log(`    Bone position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    }
    
    // Show material color
    if (testMaterial) {
      const color = testMaterial.color;
      console.log(`    Material color: [${color.map(c => c.toFixed(2)).join(', ')}]`);
    }
  }
}

console.log(`Simulation complete: ${frameCount} frames, ${totalTime.toFixed(2)}s total time`);

// ===================================
// 🎯 9. EASING FUNCTION SHOWCASE
// ===================================
console.log('\n🎯 9. Easing function showcase...\n');

// Test all easing functions
const easingFunctions = [
  'linear', 'easeIn', 'easeOut', 'easeInOut',
  'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
  'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
  'easeInBack', 'easeOutBack', 'easeInOutBack',
  'easeInBounce', 'easeOutBounce', 'easeInOutBounce',
  'easeInElastic', 'easeOutElastic', 'easeInOutElastic'
];

console.log('Testing easing functions (0.0 -> 1.0 over 1 second):');

for (const easing of easingFunctions) {
  const testTrack = new AnimationTrack('test', [
    { time: 0, value: 0 },
    { time: 1, value: 1 }
  ], easing as any);
  
  const midValue = testTrack.evaluate(0.5);
  console.log(`  ${easing.padEnd(16)}: t=0.5 → ${midValue.toFixed(3)}`);
}

// ===================================
// 📊 10. FINAL STATISTICS
// ===================================
console.log('\n📊 Final statistics...\n');

const finalStats = animator.getStats();
console.log(`Final animator stats:`);
console.log(`  • Active animations: ${finalStats.activeAnimations}`);
console.log(`  • Total clips: ${finalStats.totalClips}`);
console.log(`  • Targets: ${finalStats.targets}`);
console.log(`  • Enabled: ${finalStats.enabled}`);

console.log(`\nAnimation system features demonstrated:`);
console.log(`  ✅ Keyframe-based animation with 16 easing functions`);
console.log(`  ✅ Multi-track animation clips with looping`);
console.log(`  ✅ Bone animation with transform properties`);
console.log(`  ✅ Material property animation (color, metallic, etc.)`);
console.log(`  ✅ Professional animator with blending and events`);
console.log(`  ✅ Pre-built animation utilities and clips`);
console.log(`  ✅ Real-time playback with precise timing`);
console.log(`  ✅ Property path targeting for any object`);

// ===================================
// 🎉 DEMO COMPLETE
// ===================================
console.log('\n🎉 Animation System Demo Complete!\n');

console.log('🎬 What you learned:');
console.log('  ✅ Professional keyframe animation system');
console.log('  ✅ 16 built-in easing functions from linear to elastic');
console.log('  ✅ Multi-property animation clips with looping');
console.log('  ✅ Bone and material animation targets');
console.log('  ✅ Animation blending and real-time playback');
console.log('  ✅ Event callbacks and precise timing control');
console.log('  ✅ Pre-built animations and utility functions');
console.log('  ✅ Property path system for flexible targeting');
console.log('');

console.log('🎯 The Animation System Philosophy:');
console.log('  • Professional-grade keyframe animation');
console.log('  • Animate ANY property on ANY object');
console.log('  • Smooth interpolation with advanced easing');
console.log('  • Industry-standard workflow and timing');
console.log('  • Performance-optimized for real-time use');
console.log('');

console.log('🚀 Your 3D library now has Hollywood-level animation!');
console.log('💡 Perfect for games, interactive apps, and motion graphics!'); 