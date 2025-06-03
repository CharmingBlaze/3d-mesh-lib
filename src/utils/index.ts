/**
 * 🔧 Utils - Comprehensive utility modules
 * 
 * All utility classes and functions for 3D mesh operations,
 * mathematical calculations, and helper functions.
 */

// 🔢 Math utilities (reorganized into math folder)
export * from './math';

// 🔧 Other utilities
export * from './Matrix4';
export * from './Vector2D';
export * from './MeshUtils';
export * from './CoordinateSystem';

// For backward compatibility - re-export Vector3D at top level
export { Vector3D } from './math/Vector3D';
