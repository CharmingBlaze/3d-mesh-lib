/**
 * 🔄 I/O Module - Comprehensive 3D Format Support
 * 
 * Supports import/export for multiple 3D file formats:
 * 
 * ✅ **GLTF 2.0** - Complete animation & skeletal support (.gltf/.glb)
 * ✅ **Blender** - Import via Blender CLI (.blend) 
 * ✅ **FBX** - Import via FBX2glTF/Assimp (.fbx)
 * ✅ **DirectX** - Import via Assimp/Meshlab (.x)
 * ✅ **OBJ** - Wavefront format with MTL materials (.obj/.mtl)
 * ✅ **STL** - Stereolithography format (.stl)
 * ✅ **JSON** - Custom JSON format (.json)
 */

export { GltfIO } from './GltfIO';
export { BlenderIO } from './BlenderIO';
export { FbxIO } from './FbxIO';
export { DirectXIO } from './DirectXIO';
export { ObjIO } from './ObjIO';
export { StlIO } from './StlIO';
export { JsonIO } from './JsonIO';

// Re-export types for convenience
export type { GltfImportResult } from './GltfIO';
export type { BlenderInstallation, BlenderImportOptions } from './BlenderIO';
export type { FbxConverterInfo, FbxImportOptions } from './FbxIO';
export type { DirectXConverterInfo, DirectXImportOptions } from './DirectXIO';
