/**
 * 🎬 Animator - Main animation playback system
 * 
 * Manages playback of multiple animation clips with blending,
 * looping, and synchronized timing.
 */

import { AnimationClip } from './AnimationClip';
import { AnimationTarget } from './AnimationTargets';

/**
 * 📊 Animation State - Current state of a playing animation
 */
export interface AnimationState {
  /** Animation clip being played */
  clip: AnimationClip;
  /** Current playback time */
  time: number;
  /** Whether animation is playing */
  playing: boolean;
  /** Playback speed multiplier */
  speed: number;
  /** Animation weight (for blending) */
  weight: number;
  /** Start time (for precise timing) */
  startTime: number;
  /** Whether animation has finished */
  finished: boolean;
}

/**
 * 🎬 Animator - Main animation playback system
 * 
 * Features:
 * - ✅ Multiple clip playback
 * - ✅ Animation blending
 * - ✅ Loop support
 * - ✅ Speed control
 * - ✅ Event callbacks
 * - ✅ Target management
 */
export class Animator {
  /** Currently active animations */
  private _activeAnimations: Map<string, AnimationState> = new Map();
  
  /** Available animation clips */
  private _clips: Map<string, AnimationClip> = new Map();
  
  /** Animation targets */
  private _targets: Set<AnimationTarget> = new Set();
  
  /** Whether animator is enabled */
  public enabled: boolean = true;
  
  /** Global time scale */
  public timeScale: number = 1.0;
  
  /** Event callbacks */
  public onAnimationStart?: (clipName: string) => void;
  public onAnimationEnd?: (clipName: string) => void;
  public onAnimationLoop?: (clipName: string) => void;
  
  /**
   * Add animation clip
   * 
   * @param clip - Animation clip to add
   * @returns this (for chaining)
   */
  addClip(clip: AnimationClip): Animator {
    this._clips.set(clip.name, clip);
    return this;
  }
  
  /**
   * Remove animation clip
   * 
   * @param name - Clip name to remove
   * @returns Whether clip was removed
   */
  removeClip(name: string): boolean {
    this.stop(name); // Stop if playing
    return this._clips.delete(name);
  }
  
  /**
   * Add animation target
   * 
   * @param target - Target to add
   * @returns this (for chaining)
   */
  addTarget(target: AnimationTarget): Animator {
    this._targets.add(target);
    return this;
  }
  
  /**
   * Remove animation target
   * 
   * @param target - Target to remove
   * @returns Whether target was removed
   */
  removeTarget(target: AnimationTarget): boolean {
    return this._targets.delete(target);
  }
  
  /**
   * Play animation clip
   * 
   * @param clipName - Name of clip to play
   * @param options - Playback options
   * @returns Whether clip was found and started
   */
  play(clipName: string, options: {
    speed?: number;
    weight?: number;
    startTime?: number;
    blend?: boolean;
  } = {}): boolean {
    const clip = this._clips.get(clipName);
    if (!clip) {
      console.warn(`Animation clip '${clipName}' not found`);
      return false;
    }
    
    // Stop existing if not blending
    if (!options.blend) {
      this.stop(clipName);
    }
    
    // Create animation state
    const state: AnimationState = {
      clip,
      time: options.startTime || 0,
      playing: true,
      speed: options.speed || clip.speed,
      weight: options.weight || clip.weight,
      startTime: Date.now() / 1000,
      finished: false
    };
    
    this._activeAnimations.set(clipName, state);
    
    // Notify targets
    for (const target of this._targets) {
      if (target.onAnimationStart) {
        target.onAnimationStart();
      }
    }
    
    // Fire callback
    if (this.onAnimationStart) {
      this.onAnimationStart(clipName);
    }
    
    return true;
  }
  
  /**
   * Stop animation clip
   * 
   * @param clipName - Name of clip to stop
   * @returns Whether clip was stopped
   */
  stop(clipName: string): boolean {
    const state = this._activeAnimations.get(clipName);
    if (!state) {
      return false;
    }
    
    this._activeAnimations.delete(clipName);
    
    // Notify targets
    for (const target of this._targets) {
      if (target.onAnimationEnd) {
        target.onAnimationEnd();
      }
    }
    
    // Fire callback
    if (this.onAnimationEnd) {
      this.onAnimationEnd(clipName);
    }
    
    return true;
  }
  
  /**
   * Stop all animations
   * 
   * @returns Number of animations stopped
   */
  stopAll(): number {
    const count = this._activeAnimations.size;
    
    for (const clipName of this._activeAnimations.keys()) {
      this.stop(clipName);
    }
    
    return count;
  }
  
  /**
   * Check if animation is playing
   * 
   * @param clipName - Clip name to check
   * @returns Whether clip is playing
   */
  isPlaying(clipName: string): boolean {
    const state = this._activeAnimations.get(clipName);
    return state ? state.playing : false;
  }
  
  /**
   * Get current animation time
   * 
   * @param clipName - Clip name
   * @returns Current time or -1 if not playing
   */
  getTime(clipName: string): number {
    const state = this._activeAnimations.get(clipName);
    return state ? state.time : -1;
  }
  
  /**
   * Set animation time
   * 
   * @param clipName - Clip name
   * @param time - Time to set
   * @returns Whether time was set
   */
  setTime(clipName: string, time: number): boolean {
    const state = this._activeAnimations.get(clipName);
    if (state) {
      state.time = Math.max(0, time);
      return true;
    }
    return false;
  }
  
  /**
   * Update animation system (call in your game loop)
   * 
   * @param deltaTime - Time since last update (seconds)
   * @returns this (for chaining)
   */
  update(deltaTime: number): Animator {
    if (!this.enabled) {
      return this;
    }
    
    const scaledDeltaTime = deltaTime * this.timeScale;
    const finishedAnimations: string[] = [];
    
    // Update all active animations
    for (const [clipName, state] of this._activeAnimations) {
      if (!state.playing) continue;
      
      // Update time
      state.time += scaledDeltaTime * state.speed;
      const duration = state.clip.getDuration();
      
      // Handle looping
      if (state.time >= duration) {
        if (state.clip.loop) {
          state.time = state.time % duration;
          
          // Fire loop callback
          if (this.onAnimationLoop) {
            this.onAnimationLoop(clipName);
          }
        } else {
          state.time = duration;
          state.finished = true;
          finishedAnimations.push(clipName);
        }
      }
      
      // Apply animation
      this._applyAnimationState(state);
    }
    
    // Clean up finished animations
    for (const clipName of finishedAnimations) {
      this.stop(clipName);
    }
    
    return this;
  }
  
  /**
   * Apply animation state to targets
   */
  private _applyAnimationState(state: AnimationState): void {
    const values = state.clip.evaluate(state.time);
    
    for (const target of this._targets) {
      for (const [propertyPath, value] of values) {
        // Apply with weight blending if needed
        if (state.weight < 1.0) {
          const currentValue = target.getProperty(propertyPath);
          const blendedValue = this._blendValues(currentValue, value, state.weight);
          target.setProperty(propertyPath, blendedValue);
        } else {
          target.setProperty(propertyPath, value);
        }
      }
    }
  }
  
  /**
   * Blend two values based on weight
   */
  private _blendValues(currentValue: any, targetValue: any, weight: number): any {
    if (typeof currentValue === 'number' && typeof targetValue === 'number') {
      return currentValue + (targetValue - currentValue) * weight;
    }
    
    // For complex types, return target value if weight > 0.5, otherwise current
    return weight > 0.5 ? targetValue : currentValue;
  }
  
  /**
   * Get active animation names
   * 
   * @returns Array of active animation names
   */
  getActiveAnimations(): string[] {
    return Array.from(this._activeAnimations.keys());
  }
  
  /**
   * Get animator statistics
   * 
   * @returns Animator stats
   */
  getStats(): {
    activeAnimations: number;
    totalClips: number;
    targets: number;
    enabled: boolean;
  } {
    return {
      activeAnimations: this._activeAnimations.size,
      totalClips: this._clips.size,
      targets: this._targets.size,
      enabled: this.enabled
    };
  }
} 