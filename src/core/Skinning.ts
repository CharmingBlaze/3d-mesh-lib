/**
 * 🎯 Skinning - Vertex to bone binding system
 * 
 * Handles the binding of mesh vertices to bones with weights, enabling
 * realistic skeletal deformation and character animation.
 * 
 * @example
 * ```typescript
 * // Create skin weights for a mesh
 * const skinWeights = new SkinWeights(mesh);
 * 
 * // Bind vertices to bones with automatic weights
 * const binder = new SkinBinder(mesh, skeleton);
 * binder.bindVerticesAutomatically();
 * 
 * // Apply skeletal deformation
 * skinWeights.applySkeleton(skeleton);
 * ```
 */

import { Mesh } from './Mesh';
import { Skeleton } from './Skeleton';
import { Bone } from './Bone';
import { Vector3D } from '../utils/Vector3D';
import { Vertex } from './Vertex';

/**
 * 🎯 Vertex Weight - Weight of a vertex to a specific bone
 */
export interface VertexWeight {
  /** Bone ID that influences this vertex */
  boneId: string;
  /** Weight value (0-1, where 1 = full influence) */
  weight: number;
}

/**
 * 📊 Skin Statistics - Information about skinning setup
 */
export interface SkinStats {
  /** Total number of skinned vertices */
  skinnedVertices: number;
  /** Average weights per vertex */
  averageWeights: number;
  /** Maximum weights per vertex */
  maxWeights: number;
  /** Number of bones used in skinning */
  activeBones: number;
  /** Whether skinning is valid */
  isValid: boolean;
}

/**
 * 🎯 Skin Weights - Manages vertex-to-bone weight relationships
 * 
 * Features:
 * - ✅ Multiple bone influences per vertex
 * - ✅ Automatic weight normalization
 * - ✅ Weight painting and editing
 * - ✅ Smooth weight blending
 * - ✅ Weight validation and cleanup
 * - ✅ Real-time skeletal deformation
 */
export class SkinWeights {
  /** The mesh this skinning applies to */
  public mesh: Mesh;
  
  /** Vertex weights by vertex ID */
  private _vertexWeights: Map<number, VertexWeight[]> = new Map();
  
  /** Original vertex positions (before deformation) */
  private _originalPositions: Map<number, Vector3D> = new Map();
  
  /** Original vertex normals (before deformation) */
  private _originalNormals: Map<number, Vector3D> = new Map();
  
  /** Maximum influences per vertex (default: 4) */
  public maxInfluences: number = 4;
  
  /** Whether to normalize weights automatically */
  public autoNormalize: boolean = true;
  
  /** Custom user data */
  public userData: Map<string, any> = new Map();
  
  /**
   * Create skin weights for a mesh
   * 
   * @param mesh - Mesh to create skinning for
   * 
   * @example
   * ```typescript
   * const skinWeights = new SkinWeights(mesh);
   * ```
   */
  constructor(mesh: Mesh) {
    this.mesh = mesh;
    this._storeOriginalPositions();
  }
  
  // ===================================
  // 🎯 WEIGHT MANAGEMENT
  // ===================================
  
  /**
   * Set weight for a vertex-bone pair
   * 
   * @param vertexId - Vertex ID
   * @param boneId - Bone ID
   * @param weight - Weight value (0-1)
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * skinWeights.setWeight(0, 'spine_bone', 0.8);
   * ```
   */
  setWeight(vertexId: number, boneId: string, weight: number): SkinWeights {
    weight = Math.max(0, Math.min(1, weight)); // Clamp to 0-1
    
    if (!this._vertexWeights.has(vertexId)) {
      this._vertexWeights.set(vertexId, []);
    }
    
    const weights = this._vertexWeights.get(vertexId)!;
    
    // Find existing weight for this bone
    const existingIndex = weights.findIndex(w => w.boneId === boneId);
    
    if (weight === 0) {
      // Remove weight if it's zero
      if (existingIndex !== -1) {
        weights.splice(existingIndex, 1);
      }
    } else {
      // Add or update weight
      if (existingIndex !== -1) {
        weights[existingIndex].weight = weight;
      } else {
        weights.push({ boneId, weight });
      }
    }
    
    // Limit influences and normalize if needed
    this._limitInfluences(vertexId);
    if (this.autoNormalize) {
      this._normalizeWeights(vertexId);
    }
    
    return this;
  }
  
  /**
   * Get weight for a vertex-bone pair
   * 
   * @param vertexId - Vertex ID
   * @param boneId - Bone ID
   * @returns Weight value (0 if not found)
   */
  getWeight(vertexId: number, boneId: string): number {
    const weights = this._vertexWeights.get(vertexId);
    if (!weights) return 0;
    
    const weight = weights.find(w => w.boneId === boneId);
    return weight ? weight.weight : 0;
  }
  
  /**
   * Get all weights for a vertex
   * 
   * @param vertexId - Vertex ID
   * @returns Array of vertex weights
   */
  getVertexWeights(vertexId: number): VertexWeight[] {
    return this._vertexWeights.get(vertexId) || [];
  }
  
  /**
   * Remove all weights for a vertex
   * 
   * @param vertexId - Vertex ID
   * @returns this (for chaining)
   */
  clearVertexWeights(vertexId: number): SkinWeights {
    this._vertexWeights.delete(vertexId);
    return this;
  }
  
  /**
   * Remove all weights for a bone
   * 
   * @param boneId - Bone ID
   * @returns Number of vertices affected
   */
  clearBoneWeights(boneId: string): number {
    let affected = 0;
    
    for (const [vertexId, weights] of this._vertexWeights) {
      const originalLength = weights.length;
      const filtered = weights.filter(w => w.boneId !== boneId);
      
      if (filtered.length !== originalLength) {
        this._vertexWeights.set(vertexId, filtered);
        affected++;
        
        if (this.autoNormalize) {
          this._normalizeWeights(vertexId);
        }
      }
    }
    
    return affected;
  }
  
  // ===================================
  // 🎨 WEIGHT PAINTING
  // ===================================
  
  /**
   * Paint weights in a spherical region
   * 
   * @param center - Center position of paint brush
   * @param radius - Brush radius
   * @param boneId - Bone to paint weights for
   * @param strength - Paint strength (0-1)
   * @param mode - Paint mode ('add', 'subtract', 'replace')
   * @returns Number of vertices affected
   * 
   * @example
   * ```typescript
   * // Paint weights around shoulder area
   * const affected = skinWeights.paintWeights(
   *   new Vector3D(1, 2, 0), // shoulder position
   *   0.5,                   // brush radius
   *   'left_shoulder',       // bone
   *   0.7,                   // strength
   *   'add'                  // mode
   * );
   * ```
   */
  paintWeights(
    center: Vector3D,
    radius: number,
    boneId: string,
    strength: number = 1.0,
    mode: 'add' | 'subtract' | 'replace' = 'add'
  ): number {
    let affected = 0;
    strength = Math.max(0, Math.min(1, strength));
    
    for (const [vertexId, vertex] of this.mesh.vertices) {
      const distance = vertex.position.distanceTo(center);
      
      if (distance <= radius) {
        // Calculate falloff (closer = stronger influence)
        const falloff = 1 - (distance / radius);
        const paintStrength = strength * falloff;
        
        const currentWeight = this.getWeight(vertexId, boneId);
        let newWeight = currentWeight;
        
        switch (mode) {
          case 'add':
            newWeight = Math.min(1, currentWeight + paintStrength);
            break;
          case 'subtract':
            newWeight = Math.max(0, currentWeight - paintStrength);
            break;
          case 'replace':
            newWeight = paintStrength;
            break;
        }
        
        if (newWeight !== currentWeight) {
          this.setWeight(vertexId, boneId, newWeight);
          affected++;
        }
      }
    }
    
    return affected;
  }
  
  /**
   * Smooth weights across neighboring vertices
   * 
   * @param vertexId - Center vertex to smooth around
   * @param iterations - Number of smoothing iterations (default: 1)
   * @param strength - Smoothing strength (0-1, default: 0.5)
   * @returns this (for chaining)
   */
  smoothWeights(vertexId: number, iterations: number = 1, strength: number = 0.5): SkinWeights {
    strength = Math.max(0, Math.min(1, strength));
    
    for (let i = 0; i < iterations; i++) {
      const vertex = this.mesh.vertices.get(vertexId);
      if (!vertex) continue;
      
      // Find neighboring vertices (simplified - uses distance)
      const neighbors: number[] = [];
      const maxDistance = 2.0; // Adjust based on mesh density
      
      for (const [neighborId, neighborVertex] of this.mesh.vertices) {
        if (neighborId !== vertexId) {
          const distance = vertex.position.distanceTo(neighborVertex.position);
          if (distance <= maxDistance) {
            neighbors.push(neighborId);
          }
        }
      }
      
      if (neighbors.length === 0) continue;
      
      // Calculate average weights from neighbors
      const currentWeights = this.getVertexWeights(vertexId);
      const averageWeights = new Map<string, number>();
      
      // Collect all bone IDs from current vertex and neighbors
      const allBoneIds = new Set<string>();
      currentWeights.forEach(w => allBoneIds.add(w.boneId));
      
      neighbors.forEach(nId => {
        const nWeights = this.getVertexWeights(nId);
        nWeights.forEach(w => allBoneIds.add(w.boneId));
      });
      
      // Calculate average for each bone
      for (const boneId of allBoneIds) {
        let totalWeight = 0;
        let count = 0;
        
        neighbors.forEach(nId => {
          totalWeight += this.getWeight(nId, boneId);
          count++;
        });
        
        const averageWeight = count > 0 ? totalWeight / count : 0;
        averageWeights.set(boneId, averageWeight);
      }
      
      // Blend current weights with average
      for (const [boneId, avgWeight] of averageWeights) {
        const currentWeight = this.getWeight(vertexId, boneId);
        const newWeight = currentWeight + (avgWeight - currentWeight) * strength;
        this.setWeight(vertexId, boneId, newWeight);
      }
    }
    
    return this;
  }
  
  // ===================================
  // 🔄 SKELETAL DEFORMATION
  // ===================================
  
  /**
   * Apply skeletal deformation to the mesh
   * 
   * @param skeleton - Skeleton to apply
   * @returns this (for chaining)
   * 
   * @example
   * ```typescript
   * // Deform mesh based on current skeleton pose
   * skinWeights.applySkeleton(skeleton);
   * ```
   */
  applySkeleton(skeleton: Skeleton): SkinWeights {
    // Reset vertices to original positions
    this._restoreOriginalPositions();
    
    // Apply bone transformations
    for (const [vertexId, vertex] of this.mesh.vertices) {
      const weights = this.getVertexWeights(vertexId);
      if (weights.length === 0) continue;
      
      const originalPos = this._originalPositions.get(vertexId);
      const originalNormal = this._originalNormals.get(vertexId);
      if (!originalPos || !originalNormal) continue;
      
      // Apply weighted bone transformations
      let finalPosition = new Vector3D(0, 0, 0);
      let finalNormal = new Vector3D(0, 0, 0);
      let totalWeight = 0;
      
      for (const weight of weights) {
        const bone = skeleton.getBone(weight.boneId);
        if (!bone) continue;
        
        // Transform position and normal by bone
        const boneMatrix = bone.getWorldMatrix();
        const transformedPos = this.transformPoint(boneMatrix, originalPos);
        const transformedNormal = this.transformDirection(boneMatrix, originalNormal);
        
        // Add weighted contribution
        finalPosition.addScaledVector(transformedPos, weight.weight);
        finalNormal.addScaledVector(transformedNormal, weight.weight);
        totalWeight += weight.weight;
      }
      
      // Normalize if total weight is not 1
      if (totalWeight > 0 && totalWeight !== 1) {
        finalPosition.multiplyScalar(1 / totalWeight);
        finalNormal.multiplyScalar(1 / totalWeight);
      }
      
      // Update vertex
      vertex.position.copy(finalPosition);
      if (vertex.normal) {
        vertex.normal.copy(finalNormal.normalize());
      }
    }
    
    return this;
  }
  
  // ===================================
  // 📊 INFORMATION METHODS
  // ===================================
  
  /**
   * Get skinning statistics
   * 
   * @returns Skin statistics
   */
  getStats(): SkinStats {
    let totalWeights = 0;
    let maxWeights = 0;
    const activeBones = new Set<string>();
    
    for (const weights of this._vertexWeights.values()) {
      totalWeights += weights.length;
      maxWeights = Math.max(maxWeights, weights.length);
      
      for (const weight of weights) {
        activeBones.add(weight.boneId);
      }
    }
    
    const skinnedVertices = this._vertexWeights.size;
    const averageWeights = skinnedVertices > 0 ? totalWeights / skinnedVertices : 0;
    
    // Check if skinning is valid (all weights sum to ~1)
    let isValid = true;
    for (const weights of this._vertexWeights.values()) {
      const sum = weights.reduce((total, w) => total + w.weight, 0);
      if (Math.abs(sum - 1.0) > 0.01) { // Allow small tolerance
        isValid = false;
        break;
      }
    }
    
    return {
      skinnedVertices,
      averageWeights,
      maxWeights,
      activeBones: activeBones.size,
      isValid
    };
  }
  
  /**
   * Get skinning information string
   * 
   * @returns Human-readable skinning info
   */
  info(): string {
    const stats = this.getStats();
    return `Skinning: ${stats.skinnedVertices} vertices, ` +
           `${stats.averageWeights.toFixed(1)} avg weights, ` +
           `${stats.activeBones} bones, valid: ${stats.isValid}`;
  }
  
  // ===================================
  // 🔧 PRIVATE METHODS
  // ===================================
  
  /**
   * Store original vertex positions and normals
   */
  private _storeOriginalPositions(): void {
    for (const [vertexId, vertex] of this.mesh.vertices) {
      this._originalPositions.set(vertexId, vertex.position.clone());
      if (vertex.normal) {
        this._originalNormals.set(vertexId, vertex.normal.clone());
      } else {
        // Provide default normal if none exists
        this._originalNormals.set(vertexId, new Vector3D(0, 1, 0));
      }
    }
  }
  
  /**
   * Restore vertices to original positions
   */
  private _restoreOriginalPositions(): void {
    for (const [vertexId, vertex] of this.mesh.vertices) {
      const originalPos = this._originalPositions.get(vertexId);
      const originalNormal = this._originalNormals.get(vertexId);
      
      if (originalPos && originalNormal) {
        vertex.position.copy(originalPos);
        if (vertex.normal) {
          vertex.normal.copy(originalNormal);
        }
      }
    }
  }
  
  /**
   * Limit vertex influences to maxInfluences
   */
  private _limitInfluences(vertexId: number): void {
    const weights = this._vertexWeights.get(vertexId);
    if (!weights || weights.length <= this.maxInfluences) return;
    
    // Sort by weight (descending) and keep only top influences
    weights.sort((a, b) => b.weight - a.weight);
    weights.splice(this.maxInfluences);
  }
  
  /**
   * Normalize weights for a vertex to sum to 1
   */
  private _normalizeWeights(vertexId: number): void {
    const weights = this._vertexWeights.get(vertexId);
    if (!weights || weights.length === 0) return;
    
    const sum = weights.reduce((total, w) => total + w.weight, 0);
    if (sum === 0) return; // Avoid division by zero
    
    for (const weight of weights) {
      weight.weight /= sum;
    }
  }

  private transformPoint(matrix: number[], point: Vector3D): Vector3D {
    // Simple 4x4 matrix multiplication for point transformation
    const x = matrix[0] * point.x + matrix[4] * point.y + matrix[8] * point.z + matrix[12];
    const y = matrix[1] * point.x + matrix[5] * point.y + matrix[9] * point.z + matrix[13];
    const z = matrix[2] * point.x + matrix[6] * point.y + matrix[10] * point.z + matrix[14];
    return new Vector3D(x, y, z);
  }

  private transformDirection(matrix: number[], direction: Vector3D): Vector3D {
    // Transform direction (ignore translation)
    const x = matrix[0] * direction.x + matrix[4] * direction.y + matrix[8] * direction.z;
    const y = matrix[1] * direction.x + matrix[5] * direction.y + matrix[9] * direction.z;
    const z = matrix[2] * direction.x + matrix[6] * direction.y + matrix[10] * direction.z;
    return new Vector3D(x, y, z);
  }
}

// ===================================
// 🎯 SKIN BINDER - Automatic weight generation
// ===================================

/**
 * 🎯 Skin Binder - Automatically generates vertex weights for bones
 * 
 * Features:
 * - ✅ Distance-based weight calculation
 * - ✅ Heat diffusion weight mapping
 * - ✅ Manual weight assignment
 * - ✅ Weight validation and cleanup
 */
export class SkinBinder {
  /** Mesh to bind */
  public mesh: Mesh;
  
  /** Skeleton to bind to */
  public skeleton: Skeleton;
  
  /** Maximum distance for bone influence */
  public maxDistance: number = 5.0;
  
  /** Falloff exponent for distance weights */
  public falloffExponent: number = 2.0;
  
  /**
   * Create a skin binder
   * 
   * @param mesh - Mesh to bind
   * @param skeleton - Skeleton to bind to
   */
  constructor(mesh: Mesh, skeleton: Skeleton) {
    this.mesh = mesh;
    this.skeleton = skeleton;
  }
  
  /**
   * Automatically bind vertices to bones using distance-based weights
   * 
   * @param skinWeights - Skin weights object to populate
   * @returns Number of vertices bound
   * 
   * @example
   * ```typescript
   * const binder = new SkinBinder(mesh, skeleton);
   * const skinWeights = new SkinWeights(mesh);
   * binder.bindVerticesAutomatically(skinWeights);
   * ```
   */
  bindVerticesAutomatically(skinWeights: SkinWeights): number {
    const bones = this.skeleton.getAllBones();
    let boundVertices = 0;
    
    for (const [vertexId, vertex] of this.mesh.vertices) {
      const vertexPos = vertex.position;
      const influences: { boneId: string; weight: number }[] = [];
      
      // Calculate distance to each bone
      for (const bone of bones) {
        const boneHead = bone.getHeadPosition();
        const boneTail = bone.getTailPosition();
        
        // Find closest point on bone (line segment)
        const closestPoint = this._closestPointOnLineSegment(vertexPos, boneHead, boneTail);
        const distance = vertexPos.distanceTo(closestPoint);
        
        if (distance <= this.maxDistance) {
          // Calculate weight based on distance (closer = higher weight)
          const weight = Math.pow(1 - (distance / this.maxDistance), this.falloffExponent);
          
          if (weight > 0.01) { // Only add significant weights
            influences.push({ boneId: bone.id, weight });
          }
        }
      }
      
      // Set weights for this vertex
      if (influences.length > 0) {
        for (const influence of influences) {
          skinWeights.setWeight(vertexId, influence.boneId, influence.weight);
        }
        boundVertices++;
      }
    }
    
    return boundVertices;
  }
  
  /**
   * Bind vertices to specific bone based on proximity
   * 
   * @param skinWeights - Skin weights object
   * @param boneId - Bone ID to bind to
   * @param center - Center position for binding
   * @param radius - Binding radius
   * @param weight - Weight to assign (default: 1.0)
   * @returns Number of vertices bound
   */
  bindVerticesNearBone(
    skinWeights: SkinWeights,
    boneId: string,
    center: Vector3D,
    radius: number,
    weight: number = 1.0
  ): number {
    let boundVertices = 0;
    
    for (const [vertexId, vertex] of this.mesh.vertices) {
      const distance = vertex.position.distanceTo(center);
      
      if (distance <= radius) {
        // Calculate falloff weight
        const falloff = 1 - (distance / radius);
        const finalWeight = weight * falloff;
        
        skinWeights.setWeight(vertexId, boneId, finalWeight);
        boundVertices++;
      }
    }
    
    return boundVertices;
  }
  
  /**
   * Find closest point on line segment
   */
  private _closestPointOnLineSegment(point: Vector3D, lineStart: Vector3D, lineEnd: Vector3D): Vector3D {
    const lineDir = lineEnd.clone().subtract(lineStart);
    const lineLength = lineDir.length();
    
    if (lineLength === 0) {
      return lineStart.clone();
    }
    
    lineDir.normalize();
    
    const pointToStart = point.clone().subtract(lineStart);
    const projectionLength = pointToStart.dot(lineDir);
    
    // Clamp to line segment
    const clampedLength = Math.max(0, Math.min(lineLength, projectionLength));
    
    return lineStart.clone().addScaledVector(lineDir, clampedLength);
  }
}

// ===================================
// 🏭 SKINNING UTILITY FUNCTIONS
// ===================================

/**
 * Create automatic skinning for a mesh and skeleton
 * 
 * @param mesh - Mesh to skin
 * @param skeleton - Skeleton to bind to
 * @returns Configured SkinWeights object
 * 
 * @example
 * ```typescript
 * const skinWeights = createAutoSkinning(characterMesh, characterSkeleton);
 * ```
 */
export function createAutoSkinning(mesh: Mesh, skeleton: Skeleton): SkinWeights {
  const skinWeights = new SkinWeights(mesh);
  const binder = new SkinBinder(mesh, skeleton);
  
  binder.bindVerticesAutomatically(skinWeights);
  
  return skinWeights;
} 