/**
 * 🔄 GLTF I/O - Main Export File
 * 
 * This file re-exports the modular GLTF functionality from the gltf/ subfolder.
 * The original large file has been split into smaller, manageable modules:
 * 
 * - gltf/types.ts - Type definitions
 * - gltf/basic.ts - Basic mesh import/export
 * - gltf/skeleton.ts - Skeletal data import/export
 * - gltf/animation.ts - Animation import/export
 * - gltf/index.ts - Main unified interface
 */

// Re-export everything from the modular structure
export * from './gltf/index';

// Re-export the main class as default for backward compatibility
export { default } from './gltf/index'; 