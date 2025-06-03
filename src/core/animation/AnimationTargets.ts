/**
 * 🎯 Animation Targets - Objects that can be animated
 * 
 * Provides interfaces and implementations for different types of objects
 * that can be animated with the animation system.
 */

import { Bone } from '../Bone';
import { Material } from '../Material';

/**
 * 🎯 Animation Target - Interface for objects that can be animated
 */
export interface AnimationTarget {
  /** Get property value by path (e.g., 'position.x', 'material.color.r') */
  getProperty(path: string): any;
  /** Set property value by path */
  setProperty(path: string, value: any): void;
  /** Optional callback when animation starts */
  onAnimationStart?(): void;
  /** Optional callback when animation ends */
  onAnimationEnd?(): void;
}

/**
 * 🦴 Bone Animation Target - Animates bone properties
 * 
 * Supports animating:
 * - transform.position.x/y/z
 * - transform.rotation.x/y/z  
 * - transform.scale.x/y/z
 * - Full transform objects
 */
export class BoneAnimationTarget implements AnimationTarget {
  constructor(public bone: Bone) {}

  getProperty(path: string): any {
    const parts = path.split('.');
    let current: any = this.bone;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  setProperty(path: string, value: any): void {
    const parts = path.split('.');
    let current: any = this.bone;
    
    // Navigate to parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        console.warn(`Cannot find property path: ${path}`);
        return;
      }
    }
    
    // Set final property
    const finalProp = parts[parts.length - 1];
    if (current && typeof current === 'object') {
      current[finalProp] = value;
    }
  }
}

/**
 * 🎨 Material Animation Target - Animates material properties
 * 
 * Supports animating:
 * - color.r/g/b/a
 * - opacity
 * - emissive.r/g/b
 * - roughness
 * - metalness
 * - normalScale
 */
export class MaterialAnimationTarget implements AnimationTarget {
  constructor(public material: Material) {}

  getProperty(path: string): any {
    const parts = path.split('.');
    let current: any = this.material;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  setProperty(path: string, value: any): void {
    const parts = path.split('.');
    let current: any = this.material;
    
    // Navigate to parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        console.warn(`Cannot find material property path: ${path}`);
        return;
      }
    }
    
    // Set final property
    const finalProp = parts[parts.length - 1];
    if (current && typeof current === 'object') {
      current[finalProp] = value;
    }
  }
}

/**
 * 🔧 Generic Animation Target - Animates any object properties
 * 
 * Can animate any object with get/set property access.
 * Useful for custom objects or mesh properties.
 */
export class GenericAnimationTarget implements AnimationTarget {
  constructor(public target: any, public name: string = 'Generic') {}

  getProperty(path: string): any {
    const parts = path.split('.');
    let current: any = this.target;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  setProperty(path: string, value: any): void {
    const parts = path.split('.');
    let current: any = this.target;
    
    // Navigate to parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        console.warn(`Cannot find property path: ${path} on ${this.name}`);
        return;
      }
    }
    
    // Set final property
    const finalProp = parts[parts.length - 1];
    if (current && typeof current === 'object') {
      current[finalProp] = value;
    }
  }
} 