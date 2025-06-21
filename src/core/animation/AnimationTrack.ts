/**
 * 📊 Animation Track - Animates a single property over time
 * 
 * Features:
 * - ✅ Keyframe-based animation
 * - ✅ Multiple interpolation types
 * - ✅ Easing functions
 * - ✅ Property path targeting
 * - ✅ Custom value types support
 */

import { Vector3D } from '../../utils/Vector3D';

/**
 * 🎯 Keyframe - Single animation keyframe with time and value
 */
export interface Keyframe<T = any> {
  /** Time in seconds */
  time: number;
  /** Value at this time */
  value: T;
  /** Optional easing function name */
  easing?: EasingFunction;
  /** Optional tangent handles for spline interpolation */
  inTangent?: T;
  outTangent?: T;
}

/**
 * 🎨 Easing Functions - Animation curves for smooth motion
 */
export type EasingFunction = 
  | 'linear'
  | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  | 'easeInBack' | 'easeOutBack' | 'easeInOutBack'
  | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce'
  | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic';

/**
 * 📊 Animation Track - Animates a single property over time
 */
export class AnimationTrack<T = any> {
  /** Property path to animate (e.g., 'position.x', 'material.color') */
  public propertyPath: string;
  
  /** Keyframes for this track */
  public keyframes: Keyframe<T>[] = [];
  
  /** Default easing function */
  public defaultEasing: EasingFunction = 'linear';
  
  /** Whether this track is enabled */
  public enabled: boolean = true;
  
  /** Track weight/influence (0-1) */
  public weight: number = 1.0;
  
  /**
   * Create animation track
   * 
   * @param propertyPath - Property to animate (e.g., 'rotation.y')
   * @param keyframes - Initial keyframes
   * @param easing - Default easing function
   */
  constructor(
    propertyPath: string,
    keyframes: Keyframe<T>[] = [],
    easing: EasingFunction = 'linear'
  ) {
    this.propertyPath = propertyPath;
    this.keyframes = [...keyframes];
    this.defaultEasing = easing;
    
    // Sort keyframes by time
    this.sortKeyframes();
  }
  
  /**
   * Add keyframe to track
   * 
   * @param keyframe - Keyframe to add
   * @returns this (for chaining)
   */
  addKeyframe(keyframe: Keyframe<T>): AnimationTrack<T> {
    this.keyframes.push(keyframe);
    this.sortKeyframes();
    return this;
  }
  
  /**
   * Add keyframe with time and value
   * 
   * @param time - Time in seconds
   * @param value - Value at this time
   * @param easing - Optional easing function
   * @returns this (for chaining)
   */
  addKey(time: number, value: T, easing?: EasingFunction): AnimationTrack<T> {
    return this.addKeyframe({ time, value, easing });
  }
  
  /**
   * Remove keyframe at index
   * 
   * @param index - Keyframe index
   * @returns Whether keyframe was removed
   */
  removeKeyframe(index: number): boolean {
    if (index >= 0 && index < this.keyframes.length) {
      this.keyframes.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Get animated value at specific time
   * 
   * @param time - Time in seconds
   * @returns Interpolated value
   */
  evaluate(time: number): T {
    if (this.keyframes.length === 0) {
      return undefined as any;
    }
    
    if (this.keyframes.length === 1) {
      return this.keyframes[0].value;
    }
    
    // Find surrounding keyframes
    let prevFrame: Keyframe<T> | null = null;
    let nextFrame: Keyframe<T> | null = null;
    
    for (let i = 0; i < this.keyframes.length; i++) {
      const frame = this.keyframes[i];
      
      if (frame.time <= time) {
        prevFrame = frame;
      } else {
        nextFrame = frame;
        break;
      }
    }
    
    // Handle edge cases
    if (!prevFrame) {
      return this.keyframes[0].value;
    }
    
    if (!nextFrame) {
      return this.keyframes[this.keyframes.length - 1].value;
    }
    
    if (prevFrame === nextFrame) {
      return prevFrame.value;
    }
    
    // Calculate interpolation factor
    const duration = nextFrame.time - prevFrame.time;
    const elapsed = time - prevFrame.time;
    let factor = duration > 0 ? elapsed / duration : 0;
    
    // Apply easing
    const easing = nextFrame.easing || prevFrame.easing || this.defaultEasing;
    factor = this.applyEasing(factor, easing);
    
    // Interpolate value
    return this.interpolateValue(prevFrame.value, nextFrame.value, factor);
  }
  
  /**
   * Get track duration
   * 
   * @returns Duration in seconds
   */
  getDuration(): number {
    if (this.keyframes.length === 0) return 0;
    return this.keyframes[this.keyframes.length - 1].time;
  }
  
  /**
   * Sort keyframes by time
   */
  private sortKeyframes(): void {
    this.keyframes.sort((a, b) => a.time - b.time);
  }
  
  /**
   * Apply easing function to interpolation factor
   */
  private applyEasing(t: number, easing: EasingFunction): number {
    switch (easing) {
      case 'linear': return t;
      
      case 'easeIn': return t * t;
      case 'easeOut': return 1 - (1 - t) * (1 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      
      case 'easeInQuad': return t * t;
      case 'easeOutQuad': return 1 - (1 - t) * (1 - t);
      case 'easeInOutQuad': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      
      case 'easeInCubic': return t * t * t;
      case 'easeOutCubic': return 1 - Math.pow(1 - t, 3);
      case 'easeInOutCubic': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      
      case 'easeInQuart': return t * t * t * t;
      case 'easeOutQuart': return 1 - Math.pow(1 - t, 4);
      case 'easeInOutQuart': return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
      
      case 'easeInSine': return 1 - Math.cos(t * Math.PI / 2);
      case 'easeOutSine': return Math.sin(t * Math.PI / 2);
      case 'easeInOutSine': return -(Math.cos(Math.PI * t) - 1) / 2;
      
      case 'easeInBack': return 2.70158 * t * t * t - 1.70158 * t * t;
      case 'easeOutBack': return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
      case 'easeInOutBack': return t < 0.5 
        ? (Math.pow(2 * t, 2) * (3.5949095 * 2 * t - 2.5949095)) / 2
        : (Math.pow(2 * t - 2, 2) * (3.5949095 * (t * 2 - 2) + 2.5949095) + 2) / 2;
      
      case 'easeInBounce': return 1 - this.bounceOut(1 - t);
      case 'easeOutBounce': return this.bounceOut(t);
      case 'easeInOutBounce': return t < 0.5 
        ? (1 - this.bounceOut(1 - 2 * t)) / 2 
        : (1 + this.bounceOut(2 * t - 1)) / 2;
      
      case 'easeInElastic': return this.elasticIn(t);
      case 'easeOutElastic': return this.elasticOut(t);
      case 'easeInOutElastic': return this.elasticInOut(t);
      
      default: return t;
    }
  }
  
  private bounceOut(t: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }
  
  private elasticIn(t: number): number {
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  }
  
  private elasticOut(t: number): number {
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  }
  
  private elasticInOut(t: number): number {
    return t === 0 ? 0 : t === 1 ? 1 : t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2 + 1;
  }
  
  /**
   * Interpolate between two values
   */
  private interpolateValue(from: T, to: T, factor: number): T {
    // Handle different value types
    if (typeof from === 'number' && typeof to === 'number') {
      return (from + (to - from) * factor) as any;
    }
    
    // Vector3D interpolation
    if (from instanceof Vector3D && to instanceof Vector3D) {
      return new Vector3D(
        from.x + (to.x - from.x) * factor,
        from.y + (to.y - from.y) * factor,
        from.z + (to.z - from.z) * factor
      ) as any;
    }
    
    // Color interpolation (assuming [r,g,b] or [r,g,b,a] arrays)
    if (Array.isArray(from) && Array.isArray(to)) {
      const result = [];
      const length = Math.min(from.length, to.length);
      
      for (let i = 0; i < length; i++) {
        if (typeof from[i] === 'number' && typeof to[i] === 'number') {
          result[i] = from[i] + (to[i] - from[i]) * factor;
        } else {
          result[i] = factor < 0.5 ? from[i] : to[i];
        }
      }
      
      return result as any;
    }
    
    // Object interpolation (for complex properties)
    if (typeof from === 'object' && typeof to === 'object' && from !== null && to !== null) {
      const result: any = {};
      
      for (const key in from) {
        if (key in to) {
          result[key] = this.interpolateValue((from as any)[key], (to as any)[key], factor);
        } else {
          result[key] = (from as any)[key];
        }
      }
      
      return result;
    }
    
    // Default: step interpolation
    return factor < 0.5 ? from : to;
  }
} 