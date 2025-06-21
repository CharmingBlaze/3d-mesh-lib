/**
 * 🛠️ Animation Utils - Pre-built animations and utility functions
 * 
 * Common animation patterns and helper functions to quickly create
 * professional animations without manual keyframe setup.
 */

import { Vector3D } from '../../utils/Vector3D';
import { Bone } from '../Bone';
import { Material } from '../Material';
import { AnimationClip } from './AnimationClip';
import { Animator } from './Animator';
import { BoneAnimationTarget, MaterialAnimationTarget } from './AnimationTargets';

/**
 * 🌅 Create fade animation (opacity/alpha)
 * 
 * @param from - Starting opacity (0-1)
 * @param to - Ending opacity (0-1)
 * @param duration - Animation duration in seconds
 * @returns Fade animation clip
 */
export function createFadeAnimation(from: number = 0, to: number = 1, duration: number = 1): AnimationClip {
  const clip = new AnimationClip('fade', duration);
  
  clip.addTrack('opacity', [
    { time: 0, value: from, easing: 'easeInOut' },
    { time: duration, value: to, easing: 'easeInOut' }
  ]);
  
  return clip;
}

/**
 * 🌀 Create spin animation around an axis
 * 
 * @param axis - Rotation axis ('x', 'y', or 'z')
 * @param duration - Animation duration in seconds
 * @param revolutions - Number of full rotations
 * @returns Spin animation clip
 */
export function createSpinAnimation(axis: 'x' | 'y' | 'z' = 'y', duration: number = 2, revolutions: number = 1): AnimationClip {
  const clip = new AnimationClip('spin', duration);
  clip.loop = true; // Spin animations usually loop
  
  const totalRotation = Math.PI * 2 * revolutions;
  const propertyPath = `transform.rotation.${axis}`;
  
  clip.addTrack(propertyPath, [
    { time: 0, value: 0, easing: 'linear' },
    { time: duration, value: totalRotation, easing: 'linear' }
  ]);
  
  return clip;
}

/**
 * 💓 Create pulse animation (scale up and down)
 * 
 * @param baseScale - Base scale value
 * @param maxScale - Maximum scale value
 * @param duration - Animation duration in seconds
 * @returns Pulse animation clip
 */
export function createPulseAnimation(baseScale: number = 1, maxScale: number = 1.2, duration: number = 1): AnimationClip {
  const clip = new AnimationClip('pulse', duration);
  clip.loop = true; // Pulse animations usually loop
  
  const baseVec = new Vector3D(baseScale, baseScale, baseScale);
  const maxVec = new Vector3D(maxScale, maxScale, maxScale);
  
  clip.addTrack('transform.scale', [
    { time: 0, value: baseVec.clone(), easing: 'easeInOut' },
    { time: duration / 2, value: maxVec.clone(), easing: 'easeInOut' },
    { time: duration, value: baseVec.clone(), easing: 'easeInOut' }
  ]);
  
  return clip;
}

/**
 * 🌊 Create bounce animation
 * 
 * @param height - Bounce height
 * @param duration - Animation duration in seconds
 * @returns Bounce animation clip
 */
export function createBounceAnimation(height: number = 1, duration: number = 1): AnimationClip {
  const clip = new AnimationClip('bounce', duration);
  
  clip.addTrack('transform.position.y', [
    { time: 0, value: 0, easing: 'easeOutBounce' },
    { time: duration / 2, value: height, easing: 'easeInQuad' },
    { time: duration, value: 0, easing: 'easeOutBounce' }
  ]);
  
  return clip;
}

/**
 * 🌈 Create color transition animation
 * 
 * @param fromColor - Starting color [r, g, b] (0-1)
 * @param toColor - Ending color [r, g, b] (0-1)
 * @param duration - Animation duration in seconds
 * @returns Color animation clip
 */
export function createColorAnimation(
  fromColor: [number, number, number], 
  toColor: [number, number, number], 
  duration: number = 1
): AnimationClip {
  const clip = new AnimationClip('color', duration);
  
  clip.addTrack('color', [
    { time: 0, value: [...fromColor], easing: 'easeInOut' },
    { time: duration, value: [...toColor], easing: 'easeInOut' }
  ]);
  
  return clip;
}

/**
 * 📏 Create scale animation
 * 
 * @param fromScale - Starting scale (number or Vector3D)
 * @param toScale - Ending scale (number or Vector3D)
 * @param duration - Animation duration in seconds
 * @returns Scale animation clip
 */
export function createScaleAnimation(
  fromScale: number | Vector3D, 
  toScale: number | Vector3D, 
  duration: number = 1
): AnimationClip {
  const clip = new AnimationClip('scale', duration);
  
  const fromVec = typeof fromScale === 'number' ? new Vector3D(fromScale, fromScale, fromScale) : fromScale;
  const toVec = typeof toScale === 'number' ? new Vector3D(toScale, toScale, toScale) : toScale;
  
  clip.addTrack('transform.scale', [
    { time: 0, value: fromVec.clone(), easing: 'easeInOut' },
    { time: duration, value: toVec.clone(), easing: 'easeInOut' }
  ]);
  
  return clip;
}

/**
 * 🎯 Create slide animation (position change)
 * 
 * @param fromPosition - Starting position
 * @param toPosition - Ending position
 * @param duration - Animation duration in seconds
 * @param easing - Easing function to use
 * @returns Slide animation clip
 */
export function createSlideAnimation(
  fromPosition: Vector3D, 
  toPosition: Vector3D, 
  duration: number = 1,
  easing: string = 'easeInOut'
): AnimationClip {
  const clip = new AnimationClip('slide', duration);
  
  clip.addTrack('transform.position', [
    { time: 0, value: fromPosition.clone(), easing: easing as any },
    { time: duration, value: toPosition.clone(), easing: easing as any }
  ]);
  
  return clip;
}

// ===================================
// 🎭 ADVANCED FACTORY FUNCTIONS
// ===================================

/**
 * 🦴 Animate bone with clip
 * 
 * @param bone - Bone to animate
 * @param clip - Animation clip
 * @param speed - Playback speed multiplier
 * @returns Configured animator
 */
export function animateBone(bone: Bone, clip: AnimationClip, speed: number = 1): Animator {
  const animator = new Animator();
  const target = new BoneAnimationTarget(bone);
  
  animator.addTarget(target);
  animator.addClip(clip);
  animator.play(clip.name, { speed });
  
  return animator;
}

/**
 * 🎨 Animate material with clip
 * 
 * @param material - Material to animate
 * @param clip - Animation clip
 * @param speed - Playback speed multiplier
 * @returns Configured animator
 */
export function animateMaterial(material: Material, clip: AnimationClip, speed: number = 1): Animator {
  const animator = new Animator();
  const target = new MaterialAnimationTarget(material);
  
  animator.addTarget(target);
  animator.addClip(clip);
  animator.play(clip.name, { speed });
  
  return animator;
}

/**
 * 🌟 Create complex multi-property animation
 * 
 * @param properties - Object defining property animations
 * @param duration - Total animation duration
 * @param name - Animation name
 * @returns Complex animation clip
 */
export function createComplexAnimation(
  properties: Record<string, {
    from: any;
    to: any;
    easing?: string;
    delay?: number;
  }>,
  duration: number,
  name: string = 'complex'
): AnimationClip {
  const clip = new AnimationClip(name, duration);
  
  for (const [propertyPath, config] of Object.entries(properties)) {
    const startTime = config.delay || 0;
    const endTime = duration;
    
    clip.addTrack(propertyPath, [
      { time: startTime, value: config.from, easing: config.easing as any || 'easeInOut' },
      { time: endTime, value: config.to, easing: config.easing as any || 'easeInOut' }
    ]);
  }
  
  return clip;
}

/**
 * 🔗 Create animation sequence (multiple clips in order)
 * 
 * @param clips - Array of clips to play in sequence
 * @param name - Sequence name
 * @returns Single clip containing the sequence
 */
export function createAnimationSequence(clips: AnimationClip[], name: string = 'sequence'): AnimationClip {
  const sequence = new AnimationClip(name);
  let currentTime = 0;
  
  for (const clip of clips) {
    const clipDuration = clip.getDuration();
    
    // Copy all tracks from this clip, offset by current time
    for (const track of clip.getAllTracks()) {
      const sequenceTrack = sequence.getTrack(track.propertyPath) || sequence.addTrack(track.propertyPath, []).getTrack(track.propertyPath)!;
      
      // Add keyframes with time offset
      for (const keyframe of track.keyframes) {
        sequenceTrack.addKeyframe({
          ...keyframe,
          time: keyframe.time + currentTime
        });
      }
    }
    
    currentTime += clipDuration;
  }
  
  return sequence;
} 