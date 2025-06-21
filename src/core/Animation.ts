/**
 * 🎬 Animation System - Professional keyframe animation for everything
 * 
 * This file maintains backward compatibility by re-exporting from the new
 * modular animation system. The implementation has been split into focused
 * modules for better maintainability.
 * 
 * @deprecated Use direct imports from './animation/' for better tree-shaking
 * @example
 * ```typescript
 * // Old way (still works)
 * import { AnimationClip, Animator } from './Animation';
 * 
 * // New way (recommended)
 * import { AnimationClip, Animator } from './animation';
 * ```
 */

// Re-export everything from the modular animation system
export * from './animation/index'; 