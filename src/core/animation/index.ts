/**
 * 🎬 Animation System - Complete modular animation system
 * 
 * Professional keyframe animation for bones, materials, and any properties.
 * Organized into focused modules for better maintainability.
 * 
 * @example
 * ```typescript
 * import { AnimationClip, Animator, BoneAnimationTarget, createSpinAnimation } from './animation';
 * 
 * // Create and play a spin animation
 * const spinClip = createSpinAnimation('y', 2.0, 3);
 * const animator = new Animator();
 * const target = new BoneAnimationTarget(bone);
 * 
 * animator.addTarget(target);
 * animator.addClip(spinClip);
 * animator.play('spin');
 * ```
 */

// Core animation classes
export * from './AnimationTrack';
export * from './AnimationClip';
export * from './Animator';
export * from './AnimationTargets';

// Utility functions and pre-built animations
export * from './AnimationUtils';

// Type definitions for external use
export type { AnimationState } from './Animator';

// Re-export common types for convenience
export type {
  Keyframe,
  EasingFunction
} from './AnimationTrack';

export type {
  AnimationTarget
} from './AnimationTargets'; 