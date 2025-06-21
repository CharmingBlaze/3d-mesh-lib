/**
 * 🎬 Animation Clip - Collection of animation tracks
 * 
 * Manages multiple animation tracks that play together to create
 * complex animations with multiple properties.
 */

import { Vector3D } from '../../utils/Vector3D';
import { AnimationTrack, Keyframe, EasingFunction } from './AnimationTrack';

/**
 * 🎬 Animation Clip - Collection of animation tracks
 * 
 * Features:
 * - ✅ Multiple property tracks
 * - ✅ Synchronized playback
 * - ✅ Loop support
 * - ✅ Speed control
 * - ✅ Weight/blending support
 */
export class AnimationClip {
  /** Animation name */
  public name: string;
  
  /** Animation tracks by property path */
  public tracks: Map<string, AnimationTrack> = new Map();
  
  /** Whether animation should loop */
  public loop: boolean = false;
  
  /** Playback speed multiplier */
  public speed: number = 1.0;
  
  /** Animation weight (for blending) */
  public weight: number = 1.0;
  
  /** Custom user data */
  public userData: Map<string, any> = new Map();
  
  /**
   * Create animation clip
   * 
   * @param name - Animation name
   * @param duration - Optional fixed duration (calculated from tracks if not provided)
   */
  constructor(name: string, public duration?: number) {
    this.name = name;
  }
  
  /**
   * Add animation track
   * 
   * @param trackOrPath - Track instance or property path
   * @param keyframes - Keyframes (if path provided)
   * @param easing - Default easing (if path provided)
   * @returns this (for chaining)
   */
  addTrack(
    trackOrPath: AnimationTrack | string,
    keyframes?: Keyframe[],
    easing?: EasingFunction
  ): AnimationClip {
    let track: AnimationTrack;
    
    if (typeof trackOrPath === 'string') {
      // Create track from path
      track = new AnimationTrack(trackOrPath, keyframes, easing);
    } else {
      // Use provided track
      track = trackOrPath;
    }
    
    this.tracks.set(track.propertyPath, track);
    return this;
  }
  
  /**
   * Remove animation track
   * 
   * @param propertyPath - Property path of track to remove
   * @returns Whether track was removed
   */
  removeTrack(propertyPath: string): boolean {
    return this.tracks.delete(propertyPath);
  }
  
  /**
   * Get animation track
   * 
   * @param propertyPath - Property path
   * @returns Track or null if not found
   */
  getTrack(propertyPath: string): AnimationTrack | null {
    return this.tracks.get(propertyPath) || null;
  }
  
  /**
   * Get all tracks
   * 
   * @returns Array of all tracks
   */
  getAllTracks(): AnimationTrack[] {
    return Array.from(this.tracks.values());
  }
  
  /**
   * Evaluate all tracks at specific time
   * 
   * @param time - Time in seconds
   * @returns Map of property paths to values
   */
  evaluate(time: number): Map<string, any> {
    const values = new Map<string, any>();
    
    for (const [path, track] of this.tracks) {
      if (track.enabled) {
        const value = track.evaluate(time);
        if (value !== undefined) {
          values.set(path, value);
        }
      }
    }
    
    return values;
  }
  
  /**
   * Get clip duration
   * 
   * @returns Duration in seconds
   */
  getDuration(): number {
    if (this.duration !== undefined) {
      return this.duration;
    }
    
    // Calculate from tracks
    let maxDuration = 0;
    for (const track of this.tracks.values()) {
      maxDuration = Math.max(maxDuration, track.getDuration());
    }
    
    return maxDuration;
  }
  
  // ===================================
  // 🏭 STATIC FACTORY METHODS
  // ===================================
  
  /**
   * Create position animation clip
   */
  static position(from: Vector3D, to: Vector3D, duration: number, easing: EasingFunction = 'easeInOut'): AnimationClip {
    const clip = new AnimationClip('position', duration);
    
    clip.addTrack('transform.position', [
      { time: 0, value: from.clone(), easing },
      { time: duration, value: to.clone(), easing }
    ]);
    
    return clip;
  }
  
  /**
   * Create rotation animation clip
   */
  static rotation(from: Vector3D, to: Vector3D, duration: number, easing: EasingFunction = 'easeInOut'): AnimationClip {
    const clip = new AnimationClip('rotation', duration);
    
    clip.addTrack('transform.rotation', [
      { time: 0, value: from.clone(), easing },
      { time: duration, value: to.clone(), easing }
    ]);
    
    return clip;
  }
  
  /**
   * Create scale animation clip
   */
  static scale(from: Vector3D | number, to: Vector3D | number, duration: number, easing: EasingFunction = 'easeInOut'): AnimationClip {
    const clip = new AnimationClip('scale', duration);
    
    // Convert numbers to Vector3D
    const fromVec = typeof from === 'number' ? new Vector3D(from, from, from) : from;
    const toVec = typeof to === 'number' ? new Vector3D(to, to, to) : to;
    
    clip.addTrack('transform.scale', [
      { time: 0, value: fromVec.clone(), easing },
      { time: duration, value: toVec.clone(), easing }
    ]);
    
    return clip;
  }
} 