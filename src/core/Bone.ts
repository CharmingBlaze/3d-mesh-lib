/**
 * 🦴 Bone - Skeletal animation bone representation
 * 
 * Represents a single bone in a skeletal hierarchy with transform data,
 * parent-child relationships, and animation properties.
 */

import { Vector3D } from '../utils/Vector3D';

/**
 * Transform data for a bone (position, rotation, scale)
 */
export interface BoneTransform {
  position: Vector3D;
  rotation: Vector3D; // Euler angles in radians
  scale: Vector3D;
}

/**
 * User data storage for bones
 */
export class BoneUserData {
  private data = new Map<string, any>();

  set(key: string, value: any): void {
    this.data.set(key, value);
  }

  get(key: string): any {
    return this.data.get(key);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

/**
 * 🦴 Bone Class
 * 
 * Represents a single bone in a skeletal hierarchy with:
 * - Transform data (position, rotation, scale)
 * - Parent-child relationships
 * - Rest and bind poses for animation
 * - User data storage
 */
export class Bone {
  /** Unique identifier for this bone */
  id: string;
  
  /** Human-readable name for this bone */
  name: string;
  
  /** Current transform (position, rotation, scale) */
  transform: BoneTransform;
  
  /** Rest pose transform (default/bind pose) */
  restTransform: BoneTransform;
  
  /** Bind pose transform (for skinning calculations) */
  bindTransform: BoneTransform;
  
  /** Parent bone (null for root bones) */
  parent: Bone | null = null;
  
  /** Child bones */
  children: Bone[] = [];
  
  /** Additional user data */
  userData: BoneUserData = new BoneUserData();

  constructor(name: string, id?: string) {
    this.id = id || this.generateId();
    this.name = name;
    
    // Initialize all transforms to identity
    this.transform = this.createIdentityTransform();
    this.restTransform = this.createIdentityTransform();
    this.bindTransform = this.createIdentityTransform();
  }

  /**
   * Generate a unique ID for this bone
   */
  private generateId(): string {
    return 'bone_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Create an identity transform
   */
  private createIdentityTransform(): BoneTransform {
    return {
      position: new Vector3D(0, 0, 0),
      rotation: new Vector3D(0, 0, 0),
      scale: new Vector3D(1, 1, 1)
    };
  }

  /**
   * Add a child bone to this bone
   * @param child The child bone to add
   */
  addChild(child: Bone): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    
    child.parent = this;
    this.children.push(child);
  }

  /**
   * Remove a child bone from this bone
   * @param child The child bone to remove
   */
  removeChild(child: Bone): boolean {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      child.parent = null;
      this.children.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all descendant bones (children, grandchildren, etc.)
   * @returns Array of all descendant bones
   */
  getDescendants(): Bone[] {
    const descendants: Bone[] = [];
    
    function traverse(bone: Bone) {
      for (const child of bone.children) {
        descendants.push(child);
        traverse(child);
      }
    }
    
    traverse(this);
    return descendants;
  }

  /**
   * Get the depth of this bone in the hierarchy (0 for root)
   * @returns Depth level
   */
  getDepth(): number {
    let depth = 0;
    let current = this.parent;
    
    while (current) {
      depth++;
      current = current.parent;
    }
    
    return depth;
  }

  /**
   * Get the root bone of this hierarchy
   * @returns Root bone
   */
  getRoot(): Bone {
    let root: Bone = this;
    while (root.parent) {
      root = root.parent;
    }
    return root;
  }

  /**
   * Check if this bone is an ancestor of another bone
   * @param bone The bone to check
   * @returns True if this bone is an ancestor of the given bone
   */
  isAncestorOf(bone: Bone): boolean {
    let current = bone.parent;
    while (current) {
      if (current === this) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if this bone is a descendant of another bone
   * @param bone The bone to check
   * @returns True if this bone is a descendant of the given bone
   */
  isDescendantOf(bone: Bone): boolean {
    return bone.isAncestorOf(this);
  }

  /**
   * Copy transform from another bone
   * @param other The bone to copy from
   */
  copyTransformFrom(other: Bone): void {
    this.transform.position.copy(other.transform.position);
    this.transform.rotation.copy(other.transform.rotation);
    this.transform.scale.copy(other.transform.scale);
  }

  /**
   * Reset transform to rest pose
   */
  resetToRestPose(): void {
    this.transform.position.copy(this.restTransform.position);
    this.transform.rotation.copy(this.restTransform.rotation);
    this.transform.scale.copy(this.restTransform.scale);
  }

  /**
   * Set rest pose from current transform
   */
  setRestPoseFromCurrent(): void {
    this.restTransform.position.copy(this.transform.position);
    this.restTransform.rotation.copy(this.transform.rotation);
    this.restTransform.scale.copy(this.transform.scale);
  }

  /**
   * Get a summary of this bone for debugging
   * @returns String representation of the bone
   */
  toString(): string {
    return `Bone(${this.name}, id: ${this.id}, children: ${this.children.length})`;
  }

  /**
   * Create a clone of this bone (without parent/child relationships)
   * @returns Cloned bone
   */
  clone(): Bone {
    const cloned = new Bone(this.name, this.id + '_clone');
    
    cloned.transform.position.copy(this.transform.position);
    cloned.transform.rotation.copy(this.transform.rotation);
    cloned.transform.scale.copy(this.transform.scale);
    
    cloned.restTransform.position.copy(this.restTransform.position);
    cloned.restTransform.rotation.copy(this.restTransform.rotation);
    cloned.restTransform.scale.copy(this.restTransform.scale);
    
    cloned.bindTransform.position.copy(this.bindTransform.position);
    cloned.bindTransform.rotation.copy(this.bindTransform.rotation);
    cloned.bindTransform.scale.copy(this.bindTransform.scale);
    
    return cloned;
  }

  /**
   * Save current pose as rest pose
   */
  saveRestPose(): void {
    this.setRestPoseFromCurrent();
    // Also save for all children
    for (const child of this.children) {
      child.saveRestPose();
    }
  }

  /**
   * Restore to rest pose
   */
  restoreRestPose(): void {
    this.resetToRestPose();
    // Also restore all children
    for (const child of this.children) {
      child.restoreRestPose();
    }
  }

  /**
   * Apply constraints (placeholder for constraint system)
   */
  applyConstraints(): void {
    // TODO: Implement constraint system
    // For now, this is a placeholder
  }

  /**
   * Get statistics about this bone
   */
  getStats(): { depth: number; descendants: number; children: number } {
    return {
      depth: this.getDepth(),
      descendants: this.getDescendants().length,
      children: this.children.length
    };
  }

  /**
   * Mark as dirty (internal method for optimization)
   * @private
   */
  private _markDirty(): void {
    // TODO: Implement dirty marking system for optimization
  }

  /**
   * Get world matrix (placeholder for matrix calculations)
   */
  getWorldMatrix(): number[] {
    // TODO: Implement proper matrix calculation
    // For now, return identity matrix
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      this.transform.position.x, this.transform.position.y, this.transform.position.z, 1
    ];
  }

  /**
   * Get head position (start of bone)
   */
  getHeadPosition(): Vector3D {
    return this.transform.position.clone();
  }

  /**
   * Get tail position (end of bone, placeholder)
   */
  getTailPosition(): Vector3D {
    // For simplicity, assume bone extends 1 unit in Y direction
    return new Vector3D(
      this.transform.position.x,
      this.transform.position.y + 1,
      this.transform.position.z
    );
  }
}

/**
 * Create a spine chain with multiple vertebrae
 */
export function createSpineChain(segments: number, segmentLength: number): Bone {
  const root = new Bone('spine_root');
  let current = root;

  for (let i = 1; i < segments; i++) {
    const segment = new Bone(`spine_${i}`);
    segment.transform.position.set(0, segmentLength, 0);
    current.addChild(segment);
    current = segment;
  }

  return root;
}

/**
 * Create an arm chain (shoulder -> upper arm -> forearm -> hand)
 */
export function createArmChain(
  side: 'left' | 'right', 
  upperArmLength: number, 
  forearmLength: number
): Bone {
  const shoulder = new Bone(`${side}_shoulder`);
  const upperArm = new Bone(`${side}_upper_arm`);
  const forearm = new Bone(`${side}_forearm`);
  const hand = new Bone(`${side}_hand`);

  upperArm.transform.position.set(side === 'left' ? -1 : 1, 0, 0);
  forearm.transform.position.set(0, -upperArmLength, 0);
  hand.transform.position.set(0, -forearmLength, 0);

  shoulder.addChild(upperArm);
  upperArm.addChild(forearm);
  forearm.addChild(hand);

  return shoulder;
}

/**
 * Create a leg chain (hip -> thigh -> shin -> foot)
 */
export function createLegChain(
  side: 'left' | 'right',
  thighLength: number,
  shinLength: number
): Bone {
  const hip = new Bone(`${side}_hip`);
  const thigh = new Bone(`${side}_thigh`);
  const shin = new Bone(`${side}_shin`);
  const foot = new Bone(`${side}_foot`);

  thigh.transform.position.set(side === 'left' ? -0.5 : 0.5, 0, 0);
  shin.transform.position.set(0, -thighLength, 0);
  foot.transform.position.set(0, -shinLength, 0);

  hip.addChild(thigh);
  thigh.addChild(shin);
  shin.addChild(foot);

  return hip;
} 