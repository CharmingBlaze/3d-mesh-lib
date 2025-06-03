/**
 * 🦴 Skeleton - Complete bone hierarchy management system
 * 
 * Manages collections of bones, hierarchies, poses, and skeletal animations.
 * The central hub for all skeletal operations in 3D character systems.
 * 
 * @example
 * ```typescript
 * // Create a humanoid skeleton
 * const skeleton = new Skeleton('Character');
 * 
 * // Add bone chains
 * const spine = createSpineChain(5);
 * const leftArm = createArmChain('left');
 * const rightArm = createArmChain('right');
 * 
 * skeleton.addBone(spine);
 * skeleton.addBone(leftArm);
 * skeleton.addBone(rightArm);
 * 
 * // Save rest pose
 * skeleton.saveRestPose();
 * ```
 */

import { Bone, BoneTransform, createSpineChain, createArmChain, createLegChain } from './Bone';
import { Vector3D } from '../utils/Vector3D';

/**
 * 🎭 Pose - Collection of bone transforms at a specific time
 */
export interface Pose {
  /** Pose name/identifier */
  name: string;
  /** Timestamp when pose was created */
  timestamp: number;
  /** Bone transforms by bone ID */
  transforms: Map<string, BoneTransform>;
  /** Optional pose description */
  description?: string;
}

/**
 * 📊 Skeleton Statistics - Information about the skeleton
 */
export interface SkeletonStats {
  /** Total number of bones */
  totalBones: number;
  /** Number of root bones (no parent) */
  rootBones: number;
  /** Maximum hierarchy depth */
  maxDepth: number;
  /** Number of saved poses */
  savedPoses: number;
  /** Whether skeleton has constraints */
  hasConstraints: boolean;
}

/**
 * 🦴 Skeleton - Complete bone hierarchy management
 * 
 * Features:
 * - ✅ Bone hierarchy management
 * - ✅ Pose saving/loading/blending
 * - ✅ Bone searching and traversal
 * - ✅ Constraint evaluation
 * - ✅ Rest pose and bind pose management
 * - ✅ Bone mirroring (left/right symmetry)
 * 
 * Note: For advanced animation (keyframes, easing, etc.), use the Animation system
 */
export class Skeleton {
  /** Skeleton name/identifier */
  public name: string;
  
  /** All bones in the skeleton by ID */
  private _bones: Map<string, Bone> = new Map();
  
  /** Root bones (bones with no parent) */
  private _rootBones: Bone[] = [];
  
  /** Saved poses */
  private _poses: Map<string, Pose> = new Map();
  
  /** Whether to auto-update matrices when bones change */
  public autoUpdate: boolean = true;
  
  /** Custom user data */
  public userData: Map<string, any> = new Map();
  
  /**
   * Create a new skeleton
   * 
   * @param name - Skeleton name/identifier
   * 
   * @example
   * ```typescript
   * const skeleton = new Skeleton('MainCharacter');
   * ```
   */
  constructor(name: string) {
    this.name = name;
  }
  
  // ===================================
  // 🦴 BONE MANAGEMENT
  // ===================================
  
  /**
   * Add a bone (and its hierarchy) to the skeleton
   * 
   * @param bone - Root bone to add
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * const spine = createSpineChain(5);
   * skeleton.addBone(spine);
   * ```
   */
  addBone(bone: Bone): Skeleton {
    // Add this bone and all its descendants
    const allBones = [bone, ...bone.getDescendants()];
    
    for (const b of allBones) {
      this._bones.set(b.id, b);
    }
    
    // Add to root bones if it has no parent
    if (!bone.parent) {
      this._rootBones.push(bone);
    }
    
    return this;
  }
  
  /**
   * Remove a bone (and its hierarchy) from the skeleton
   * 
   * @param bone - Bone to remove
   * @returns Whether bone was removed
   */
  removeBone(bone: Bone): boolean {
    // Remove from parent if it has one
    if (bone.parent) {
      bone.parent.removeChild(bone);
    } else {
      // Remove from root bones
      const index = this._rootBones.indexOf(bone);
      if (index !== -1) {
        this._rootBones.splice(index, 1);
      }
    }
    
    // Remove this bone and all descendants
    const allBones = [bone, ...bone.getDescendants()];
    
    for (const b of allBones) {
      this._bones.delete(b.id);
    }
    
    return true;
  }
  
  /**
   * Get bone by ID
   * 
   * @param id - Bone ID
   * @returns Found bone or null
   */
  getBone(id: string): Bone | null {
    return this._bones.get(id) || null;
  }
  
  /**
   * Find bone by name
   * 
   * @param name - Bone name to search for
   * @returns Found bone or null
   */
  findBone(name: string): Bone | null {
    for (const bone of this._bones.values()) {
      if (bone.name === name) {
        return bone;
      }
    }
    return null;
  }
  
  /**
   * Get all bones in the skeleton
   * 
   * @returns Array of all bones
   */
  getAllBones(): Bone[] {
    return Array.from(this._bones.values());
  }
  
  /**
   * Get root bones (bones with no parent)
   * 
   * @returns Array of root bones
   */
  getRootBones(): Bone[] {
    return [...this._rootBones];
  }
  
  /**
   * Find bones matching a pattern
   * 
   * @param pattern - Regular expression or string pattern
   * @returns Array of matching bones
   * 
   * @example
   * ```typescript
   * // Find all left-side bones
   * const leftBones = skeleton.findBones(/^left_/);
   * 
   * // Find spine bones
   * const spineBones = skeleton.findBones('spine');
   * ```
   */
  findBones(pattern: RegExp | string): Bone[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    const matches: Bone[] = [];
    
    for (const bone of this._bones.values()) {
      if (regex.test(bone.name)) {
        matches.push(bone);
      }
    }
    
    return matches;
  }
  
  // ===================================
  // 🎭 POSE MANAGEMENT
  // ===================================
  
  /**
   * Save current bone positions as a pose
   * 
   * @param name - Pose name
   * @param description - Optional description
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * skeleton.savePose('T-Pose', 'Default character pose');
   * ```
   */
  savePose(name: string, description?: string): Skeleton {
    const transforms = new Map<string, BoneTransform>();
    
    for (const bone of this._bones.values()) {
      transforms.set(bone.id, {
        position: bone.transform.position.clone(),
        rotation: bone.transform.rotation.clone(),
        scale: bone.transform.scale.clone()
      });
    }
    
    const pose: Pose = {
      name,
      timestamp: Date.now(),
      transforms,
      description
    };
    
    this._poses.set(name, pose);
    return this;
  }
  
  /**
   * Load a saved pose
   * 
   * @param name - Pose name to load
   * @returns Whether pose was found and loaded
   * 
   * @example
   * ```typescript
   * skeleton.loadPose('T-Pose');
   * ```
   */
  loadPose(name: string): boolean {
    const pose = this._poses.get(name);
    if (!pose) return false;
    
    for (const [boneId, transform] of pose.transforms) {
      const bone = this._bones.get(boneId);
      if (bone) {
        bone.transform.position.copy(transform.position);
        bone.transform.rotation.copy(transform.rotation);
        bone.transform.scale.copy(transform.scale);
      }
    }
    
    this._markAllBonesDirty();
    return true;
  }
  
  /**
   * Blend between two poses
   * 
   * @param poseA - First pose name
   * @param poseB - Second pose name
   * @param factor - Blend factor (0 = pose A, 1 = pose B)
   * @returns Whether both poses were found and blended
   * 
   * @example
   * ```typescript
   * // 50% blend between rest and action pose
   * skeleton.blendPoses('rest', 'action', 0.5);
   * ```
   */
  blendPoses(poseA: string, poseB: string, factor: number): boolean {
    const pA = this._poses.get(poseA);
    const pB = this._poses.get(poseB);
    
    if (!pA || !pB) return false;
    
    factor = Math.max(0, Math.min(1, factor)); // Clamp to 0-1
    
    for (const bone of this._bones.values()) {
      const transformA = pA.transforms.get(bone.id);
      const transformB = pB.transforms.get(bone.id);
      
      if (transformA && transformB) {
        // Blend position
        bone.transform.position.x = transformA.position.x + (transformB.position.x - transformA.position.x) * factor;
        bone.transform.position.y = transformA.position.y + (transformB.position.y - transformA.position.y) * factor;
        bone.transform.position.z = transformA.position.z + (transformB.position.z - transformA.position.z) * factor;
        
        // Blend rotation
        bone.transform.rotation.x = transformA.rotation.x + (transformB.rotation.x - transformA.rotation.x) * factor;
        bone.transform.rotation.y = transformA.rotation.y + (transformB.rotation.y - transformA.rotation.y) * factor;
        bone.transform.rotation.z = transformA.rotation.z + (transformB.rotation.z - transformA.rotation.z) * factor;
        
        // Blend scale
        bone.transform.scale.x = transformA.scale.x + (transformB.scale.x - transformA.scale.x) * factor;
        bone.transform.scale.y = transformA.scale.y + (transformB.scale.y - transformA.scale.y) * factor;
        bone.transform.scale.z = transformA.scale.z + (transformB.scale.z - transformA.scale.z) * factor;
      }
    }
    
    this._markAllBonesDirty();
    return true;
  }
  
  /**
   * Save current pose as rest pose for all bones
   * 
   * @returns this (for chaining)
   */
  saveRestPose(): Skeleton {
    for (const bone of this._bones.values()) {
      bone.saveRestPose();
    }
    this.savePose('rest', 'Rest pose');
    return this;
  }
  
  /**
   * Restore all bones to rest pose
   * 
   * @returns this (for chaining)
   */
  restoreRestPose(): Skeleton {
    for (const bone of this._bones.values()) {
      bone.restoreRestPose();
    }
    return this;
  }
  
  // ===================================
  // 🔧 UTILITY METHODS
  // ===================================
  
  /**
   * Apply constraints to all bones
   * 
   * @returns this (for chaining)
   */
  applyConstraints(): Skeleton {
    for (const bone of this._bones.values()) {
      bone.applyConstraints();
    }
    return this;
  }
  
  /**
   * Mirror bone transforms from one side to another
   * 
   * @param fromPattern - Pattern to match source bones (e.g., 'left_')
   * @param toPattern - Pattern to match target bones (e.g., 'right_')
   * @param axis - Mirror axis ('x', 'y', or 'z')
   * @returns Number of bones mirrored
   * 
   * @example
   * ```typescript
   * // Mirror left arm to right arm
   * skeleton.mirrorBones('left_', 'right_', 'x');
   * ```
   */
  mirrorBones(fromPattern: string, toPattern: string, axis: 'x' | 'y' | 'z' = 'x'): number {
    const fromBones = this.findBones(fromPattern);
    let mirrored = 0;
    
    for (const fromBone of fromBones) {
      const toBoneName = fromBone.name.replace(fromPattern, toPattern);
      const toBone = this.findBone(toBoneName);
      
      if (toBone) {
        // Copy transform
        toBone.transform.position.copy(fromBone.transform.position);
        toBone.transform.rotation.copy(fromBone.transform.rotation);
        toBone.transform.scale.copy(fromBone.transform.scale);
        
        // Mirror along specified axis
        switch (axis) {
          case 'x':
            toBone.transform.position.x *= -1;
            toBone.transform.rotation.y *= -1;
            toBone.transform.rotation.z *= -1;
            break;
          case 'y':
            toBone.transform.position.y *= -1;
            toBone.transform.rotation.x *= -1;
            toBone.transform.rotation.z *= -1;
            break;
          case 'z':
            toBone.transform.position.z *= -1;
            toBone.transform.rotation.x *= -1;
            toBone.transform.rotation.y *= -1;
            break;
        }
        
        mirrored++;
      }
    }
    
    this._markAllBonesDirty();
    return mirrored;
  }
  
  /**
   * Get skeleton statistics
   * 
   * @returns Skeleton statistics
   */
  getStats(): SkeletonStats {
    let maxDepth = 0;
    let hasConstraints = false;
    
    for (const root of this._rootBones) {
      const stats = root.getStats();
      maxDepth = Math.max(maxDepth, stats.depth);
      // For now, assume no constraints since we don't have a constraint system yet
    }
    
    return {
      totalBones: this._bones.size,
      rootBones: this._rootBones.length,
      maxDepth,
      savedPoses: this._poses.size,
      hasConstraints
    };
  }
  
  /**
   * Get skeleton information string
   * 
   * @returns Human-readable skeleton info
   */
  info(): string {
    const stats = this.getStats();
    return `Skeleton "${this.name}": ${stats.totalBones} bones, ${stats.rootBones} roots, ` +
           `depth: ${stats.maxDepth}, poses: ${stats.savedPoses}`;
  }
  
  // ===================================
  // 🔧 PRIVATE METHODS
  // ===================================
  
  /**
   * Mark all bones as needing matrix updates
   */
  private _markAllBonesDirty(): void {
    for (const bone of this._bones.values()) {
      bone['_markDirty']();
    }
  }
}

// ===================================
// 🏭 SKELETON FACTORY METHODS
// ===================================

/**
 * Create a basic humanoid skeleton
 * 
 * @param name - Skeleton name (default: 'Humanoid')
 * @returns Complete humanoid skeleton
 * 
 * @example
 * ```typescript
 * const character = createHumanoidSkeleton('MainCharacter');
 * character.saveRestPose();
 * ```
 */
export function createHumanoidSkeleton(name: string = 'Humanoid'): Skeleton {
  const skeleton = new Skeleton(name);
  
  // Create main bone chains
  const spine = createSpineChain(5, 1);
  const leftArm = createArmChain('left', 2, 1.5);
  const rightArm = createArmChain('right', 2, 1.5);
  const leftLeg = createLegChain('left', 2.5, 2);
  const rightLeg = createLegChain('right', 2.5, 2);
  
  // Connect arms to spine
  const shoulderHeight = spine.children[2]; // spine_3
  if (shoulderHeight) {
    shoulderHeight.addChild(leftArm);
    shoulderHeight.addChild(rightArm);
  }
  
  // Connect legs to spine root
  spine.addChild(leftLeg);
  spine.addChild(rightLeg);
  
  // Add head
  const neck = new Bone('neck');
  neck.transform.position.set(0, 1, 0);
  const head = new Bone('head');
  head.transform.position.set(0, 0.5, 0);
  neck.addChild(head);
  
  const topSpine = spine.children[3]; // spine_4
  if (topSpine) {
    topSpine.addChild(neck);
  }
  
  // Add the main spine to skeleton
  skeleton.addBone(spine);
  
  return skeleton;
}

/**
 * Create a simple quadruped skeleton
 * 
 * @param name - Skeleton name (default: 'Quadruped')
 * @returns Quadruped skeleton (for animals)
 */
export function createQuadrupedSkeleton(name: string = 'Quadruped'): Skeleton {
  const skeleton = new Skeleton(name);
  
  // Create spine (longer for quadrupeds)
  const spine = createSpineChain(8, 1);
  
  // Create four legs
  const frontLeft = createLegChain('left', 1.5, 1.2);
  const frontRight = createLegChain('right', 1.5, 1.2);
  const backLeft = createLegChain('left', 1.8, 1.5);
  const backRight = createLegChain('right', 1.8, 1.5);
  
  // Position legs along spine
  const frontAttach = spine.children[1]; // spine_2
  const backAttach = spine.children[5]; // spine_6
  
  if (frontAttach) {
    frontAttach.addChild(frontLeft);
    frontAttach.addChild(frontRight);
  }
  
  if (backAttach) {
    backAttach.addChild(backLeft);
    backAttach.addChild(backRight);
  }
  
  // Add head and neck
  const neck = createSpineChain(3, 0.6);
  const head = new Bone('head');
  head.transform.position.set(0, 1.8, 0);
  neck.addChild(head);
  
  const neckAttach = spine.children[0]; // spine_1
  if (neckAttach) {
    neckAttach.addChild(neck);
  }
  
  skeleton.addBone(spine);
  
  return skeleton;
} 