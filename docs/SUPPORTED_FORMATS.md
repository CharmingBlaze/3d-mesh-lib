# 🎯 Supported 3D File Formats

This document outlines all 3D file formats supported by the library, including their capabilities, limitations, and usage examples.

## 🏆 Format Overview

| Format | Import | Export | Animations | Skeleton | Materials | Textures | Limitations |
|--------|---------|---------|------------|----------|-----------|----------|-------------|
| **GLTF 2.0** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | None - Full featured |
| **FBX** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Requires FBX2glTF/Assimp |
| **DirectX .x** | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | Legacy format, requires Assimp |
| **Blender** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Requires Blender installed |
| **OBJ+MTL** | ✅ | ✅ | ❌ | ❌ | ✅ | ⚠️ | No animation/bones support |
| **STL** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Geometry only |
| **JSON** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | Custom format, mesh-focused |

**Legend:** ✅ Full Support | ⚠️ Partial Support | ❌ Not Supported

---

## 🎬 GLTF 2.0 Format (.gltf/.glb)

**Status:** ✅ **Recommended** - Full featured format with complete animation support

### Features
- ✅ **Complete Animation Support** - Keyframe animation, bone hierarchies, skinning
- ✅ **Skeletal Systems** - Full bone hierarchies with transforms and constraints
- ✅ **PBR Materials** - Physically Based Rendering with textures
- ✅ **Text & Binary** - Supports both .gltf (JSON) and .glb (binary) formats
- ✅ **Industry Standard** - Widely supported across 3D software and engines

### Usage

```typescript
import { GltfIO } from '@yourlib/io';

// Import complete model with animations
const result = await GltfIO.importComplete('model.glb');
console.log(`Imported: ${result.animations.length} animations`);

// Import just the mesh
const mesh = await GltfIO.importMesh('model.gltf');

// Export with animations
const glbBuffer = await GltfIO.exportComplete({
  mesh: myMesh,
  skeleton: mySkeleton,
  animations: myAnimations,
  skinWeights: mySkinWeights
});

// Export as text format (.gltf)
const gltfBuffer = await GltfIO.exportMesh(mesh, 'gltf');
```

### Format Detection
The library automatically detects whether the file is .gltf (text) or .glb (binary):
- **.gltf** files are JSON-based with external binary files
- **.glb** files are self-contained binary format

### Limitations
- None - This is the most complete format supported

---

## 🎨 Blender Format (.blend)

**Status:** ✅ **Import & Export** - Requires Blender installation

### Features
- ✅ **Complete Blender Support** - Import any .blend file and export to .blend
- ✅ **Animation Import/Export** - Supports Blender's animation system
- ✅ **Skeletal Data** - Armatures and bone hierarchies
- ✅ **Materials & Textures** - Full material support via GLTF pipeline
- ✅ **Transparent Conversion** - Automatically converts via GLTF internally
- ✅ **Two-way Support** - Both import and export capabilities

### Usage

```typescript
import { BlenderIO } from '@yourlib/io';

// === IMPORT ===
// Check if Blender is installed
const blenderInfo = await BlenderIO.detectBlender();
if (blenderInfo.found) {
  console.log(`Found Blender ${blenderInfo.version}`);
}

// Import complete Blender scene
const result = await BlenderIO.importComplete('scene.blend', {
  includeAnimations: true,
  includeSkeleton: true,
  exportOptions: {
    exportMaterials: true,
    exportTextures: true
  }
});

// Import just the mesh
const mesh = await BlenderIO.importMesh('model.blend');

// === EXPORT ===
// Export complete scene with animations
await BlenderIO.exportComplete({
  mesh: myMesh,
  skeleton: mySkeleton,
  animations: myAnimations,
  skinWeights: mySkinWeights
}, 'exported-scene.blend', {
  exportOptions: {
    exportMaterials: true,
    exportTextures: true
  }
});

// Export just a mesh
await BlenderIO.exportMesh(myMesh, 'exported-model.blend');

// Get information about blend file
const info = await BlenderIO.getBlendInfo('scene.blend');
console.log(`${info.meshCount} meshes, ${info.animationCount} animations`);
```

### Requirements
- **Blender 2.8+** must be installed and accessible via command line
- Blender executable must be in PATH or specified manually

### Export Process
1. **Internal Conversion**: Your mesh/animation data is first converted to GLTF format internally
2. **Blender Import**: The GLTF is imported into a new Blender scene via command line
3. **Blend Save**: The scene is saved as a .blend file with all data intact

### Automatic Detection
The library automatically detects Blender in common installation locations:
- **Windows:** `C:\\Program Files\\Blender Foundation\\Blender\\`
- **macOS:** `/Applications/Blender.app/`
- **Linux:** `/usr/bin/blender`, `/usr/local/bin/blender`

### Limitations
- **Requires Blender** - External dependency on Blender installation
- **Performance** - Slower than direct format loading due to conversion
- **Conversion Overhead** - Export requires GLTF intermediate format

## 🎮 FBX Format (.fbx)

**Status:** ✅ **Import & Export** - Requires FBX2glTF or Assimp

### Features
- ✅ **Professional Animation Support** - Advanced keyframe animation with curves
- ✅ **Complete Skeletal Systems** - Full bone hierarchies, constraints, and IK
- ✅ **Advanced Materials** - PBR and traditional materials with complex node trees
- ✅ **Industry Standard** - Widely used in game development, VFX, and animation
- ✅ **Autodesk Integration** - Native format for Maya, 3ds Max, and other Autodesk tools
- ✅ **Two-way Support** - Both import and export capabilities

### Usage

```typescript
import { FbxIO } from '@yourlib/io';

// === IMPORT ===
// Check if FBX converter is available
const converterInfo = await FbxIO.detectConverter();
if (converterInfo.found) {
  console.log(`Found ${converterInfo.type} ${converterInfo.version}`);
}

// Import complete FBX scene
const result = await FbxIO.importComplete('character.fbx', {
  includeAnimations: true,
  includeSkeleton: true,
  converterOptions: {
    materials: true,
    textures: true,
    animationSampleRate: 30
  }
});

// Import just the mesh
const mesh = await FbxIO.importMesh('model.fbx');

// === EXPORT ===
// Export complete scene with animations
await FbxIO.exportComplete({
  mesh: myMesh,
  skeleton: mySkeleton,
  animations: myAnimations,
  skinWeights: mySkinWeights
}, 'exported-character.fbx', {
  includeAnimations: true,
  converterOptions: {
    materials: true,
    textures: true
  }
});

// Export just a mesh
await FbxIO.exportMesh(myMesh, 'exported-model.fbx');

// Get FBX file information
const info = await FbxIO.getFbxInfo('scene.fbx');
console.log(`Complexity: ${info.estimatedComplexity}`);
```

### Requirements
- **FBX2glTF (Recommended for Import)** - Facebook's high-quality FBX to GLTF converter
  - Download: https://github.com/facebookincubator/FBX2glTF
  - Note: May not support GLTF→FBX export
- **Assimp (Recommended for Export)** - Cross-platform asset importer with export support
  - Download: https://assimp.org/
  - Supports both FBX→GLTF and GLTF→FBX conversion

### Export Process
1. **Internal Conversion**: Your mesh/animation data is first converted to GLTF format internally
2. **External Conversion**: The GLTF is then converted to FBX using external tools
3. **Quality**: Export quality depends on the external converter's capabilities

### Automatic Detection
The library automatically detects converters in common locations:
- **Windows:** `fbx2gltf.exe`, `FBX2glTF.exe`, `assimp.exe`
- **macOS/Linux:** `/usr/local/bin/fbx2gltf`, `/usr/bin/assimp`

### Limitations
- **External Dependency** - Requires FBX2glTF or Assimp installation
- **Conversion Overhead** - Slower than direct GLTF due to conversion pipeline
- **Converter-Dependent** - Export quality depends on external tool capabilities
- **FBX2glTF Limitation** - May not support reverse conversion (GLTF→FBX)

---

## 🎮 DirectX .x Format (.x)

**Status:** ✅ **Import & Export** - Legacy format with Assimp support

### Features
- ✅ **Basic Animation Support** - Legacy keyframe animation
- ✅ **Mesh Geometry** - Vertices, faces, normals, and UV coordinates
- ✅ **Material Support** - Basic material definitions
- ⚠️ **Limited Modern Features** - Legacy format with constraints
- 🎮 **Game Development** - Common in older DirectX applications and tutorials
- ✅ **Two-way Support** - Both import and export capabilities

### Usage

```typescript
import { DirectXIO } from '@yourlib/io';

// === IMPORT ===
// Check if DirectX converter is available
const converterInfo = await DirectXIO.detectConverter();
if (converterInfo.found && converterInfo.hasDirectXSupport) {
  console.log(`Found ${converterInfo.type} with DirectX support`);
}

// Import DirectX .x file
const result = await DirectXIO.importComplete('model.x', {
  includeAnimations: true,
  converterOptions: {
    materials: true,
    textures: true
  }
});

// Import just the mesh
const mesh = await DirectXIO.importMesh('geometry.x');

// === EXPORT ===
// Export complete model with animations
await DirectXIO.exportComplete({
  mesh: myMesh,
  skeleton: mySkeleton,
  animations: myAnimations,
  skinWeights: mySkinWeights
}, 'exported-model.x', {
  includeAnimations: true,
  converterOptions: {
    materials: true
  }
});

// Export just a mesh
await DirectXIO.exportMesh(myMesh, 'exported-geometry.x');

// Get DirectX file information
const info = await DirectXIO.getDirectXInfo('scene.x');
console.log(`Text format: ${info.isTextFormat}`);

// Validate DirectX file
const isValid = await DirectXIO.validateDirectXFile('model.x');
```

### Format Support
- **Text Format** - Human-readable `.x` files starting with `xof `
- **Binary Format** - Compact binary `.x` files
- **Animation Data** - Basic keyframe animation support
- **Material Data** - Legacy material definitions

### Requirements
- **Assimp (Recommended)** - Cross-platform asset importer with DirectX support
  - Download: https://assimp.org/
  - Most reliable DirectX .x import/export support
- **Meshlab (Alternative)** - 3D mesh processing tool
  - Download: https://www.meshlab.net/
  - Limited to geometry only

### Export Process
1. **Internal Conversion**: Your mesh/animation data is converted to GLTF format internally
2. **External Conversion**: The GLTF is then converted to DirectX .x using Assimp or Meshlab
3. **Format Selection**: Typically exports as text format (.x) for compatibility

### Limitations
- **Legacy Format** - Limited modern 3D features compared to GLTF
- **Basic Animation** - Simple keyframe animation only, no advanced rigging
- **External Dependency** - Requires Assimp or Meshlab for both import and export
- **Limited PBR** - No advanced material features, basic materials only
- **Conversion Overhead** - Slower than direct GLTF due to conversion pipeline

## 🔺 OBJ + MTL Format (.obj/.mtl)

**Status:** ✅ **Basic Support** - Limited but widely compatible

### Features
- ✅ **Mesh Geometry** - Vertices, faces, normals, UV coordinates
- ✅ **Material Support** - Basic materials via .mtl files
- ✅ **Wide Compatibility** - Supported by virtually all 3D software
- ✅ **Human Readable** - Text-based format

### Usage

```typescript
import { ObjIO } from '@yourlib/io';

// Import OBJ file
const mesh = ObjIO.importMesh(objString, 'MyMesh');

// Export mesh with materials
const { obj, mtl } = ObjIO.exportMesh(mesh, 'materials.mtl');

// Save both files
await fs.writeFile('model.obj', obj);
if (mtl) {
  await fs.writeFile('materials.mtl', mtl);
}
```

### Material Mapping
OBJ materials are mapped from our PBR system:
- **Diffuse (Kd)** ← `material.color`
- **Specular (Ks)** ← Derived from metallic/roughness
- **Emissive (Ke)** ← `material.emissiveColor`
- **Opacity (d)** ← `material.opacity`

### Limitations
- ❌ **No Animations** - Static geometry only
- ❌ **No Skeleton** - No bone or armature support
- ❌ **No Pivots** - Limited transform data
- ❌ **Basic Materials** - No PBR textures or advanced shading
- ❌ **No UV2** - Single UV channel only

---

## 🔷 STL Format (.stl)

**Status:** ✅ **Geometry Only** - 3D printing focused

### Features
- ✅ **Triangle Meshes** - Pure geometric data
- ✅ **3D Printing** - Industry standard for additive manufacturing
- ✅ **Binary & ASCII** - Supports both formats
- ✅ **Lightweight** - Minimal file size

### Usage

```typescript
import { StlIO } from '@yourlib/io';

// Import STL file
const mesh = StlIO.importMesh(stlData);

// Export mesh to STL
const stlBuffer = await StlIO.exportMesh(mesh, 'binary'); // or 'ascii'
```

### Limitations
- ❌ **Geometry Only** - No materials, textures, or colors
- ❌ **No Animations** - Static meshes only
- ❌ **No Hierarchy** - Single mesh per file
- ❌ **Triangles Only** - No quads or n-gons

---

## 📄 JSON Format (.json)

**Status:** ✅ **Enhanced Mesh Support** - Custom format optimized for debugging

### Features
- ✅ **Complete Mesh Data** - All vertex, face, and material information
- ✅ **Enhanced Material Support** - Full PBR material data with colors and properties
- ✅ **Human Readable** - JSON format for debugging and inspection
- ✅ **Extensible Format** - Easy to modify and extend with metadata
- ✅ **Version Control Friendly** - Text-based format works well with Git
- ⚠️ **Mesh-Focused** - Optimized for mesh data, limited animation support

### Usage

```typescript
import { JsonIO } from '@yourlib/io';

// === EXPORT ===
// Export complete model data (mesh-focused)
const jsonString = JsonIO.exportComplete({
  mesh: myMesh,
  skeleton: undefined, // Not yet supported
  animations: [],     // Not yet supported
  skinWeights: undefined
}, {
  prettyPrint: true,
  includeMetadata: true,
  metadata: {
    author: 'Your Name',
    description: 'My 3D Model'
  }
});

// Export just a mesh (legacy method)
const meshJson = JsonIO.exportMeshToString(mesh, true);

// === IMPORT ===
// Import complete model
const result = JsonIO.importComplete(jsonString);
console.log(`Imported mesh with ${result.mesh.vertices.size} vertices`);

// Import just a mesh (legacy method)
const importedMesh = JsonIO.importMeshFromString(meshJson);

// === VALIDATION ===
// Check if JSON is valid format
const isValid = JsonIO.isValidJsonFormat(jsonString);

// Get format information
const formatInfo = JsonIO.getFormatInfo();
console.log(`JSON format version: ${formatInfo.version}`);
```

### Format Structure
The JSON format includes:
- **Version field** for compatibility tracking
- **Metadata** for author, creation date, and descriptions
- **Complete mesh geometry** with vertices, faces, and materials
- **Material properties** including PBR data (metallic, roughness, emissive)
- **Extensible structure** for future enhancements

### Example JSON Output
```json
{
  "version": "1.0.0",
  "metadata": {
    "generator": "3d-mesh-lib JSON exporter",
    "created": "2024-01-01T12:00:00.000Z",
    "author": "Developer"
  },
  "mesh": {
    "name": "MyModel",
    "vertices": [
      {
        "id": 1,
        "position": { "x": 0, "y": 0, "z": 0 },
        "normal": { "x": 0, "y": 1, "z": 0 },
        "uv": { "u": 0, "v": 0 }
      }
    ],
    "faces": [
      {
        "id": 1,
        "vertexIds": [1, 2, 3],
        "materialId": 1
      }
    ],
    "materials": [
      {
        "id": 1,
        "name": "Material",
        "color": { "x": 1, "y": 0, "z": 0 },
        "opacity": 1.0,
        "metallic": 0.1,
        "roughness": 0.5,
        "emissiveColor": { "x": 0, "y": 0, "z": 0 }
      }
    ]
  }
}
```

### Limitations
- ❌ **No Animation Data** - Animation support not yet implemented
- ❌ **No Skeletal Data** - Bone and skeleton support not yet implemented
- ❌ **Large Files** - JSON is verbose compared to binary formats
- ❌ **No Texture Embedding** - External texture references only
- ❌ **Limited Precision** - JSON number precision limitations

---

## 🎯 Format Selection Guide

### For Animation & Rigging
**Use GLTF 2.0** - Complete animation pipeline support
```typescript
const result = await GltfIO.importComplete('animated-model.glb');
```

### For Blender Assets
**Use BlenderIO** - Direct .blend import with full feature support
```typescript
const result = await BlenderIO.importComplete('scene.blend');
```

### For Simple Models
**Use OBJ+MTL** - Wide compatibility, basic material support
```typescript
const { obj, mtl } = ObjIO.exportMesh(mesh);
```

### For 3D Printing
**Use STL** - Industry standard for manufacturing
```typescript
const stlData = await StlIO.exportMesh(mesh, 'binary');
```

### For Development/Testing
**Use JSON** - Human-readable, easy debugging
```typescript
const jsonData = JsonIO.exportMesh(mesh);
```

---

## 🚀 Best Practices

1. **Use GLTF 2.0** for any project requiring animations or advanced materials
2. **Test Blender integration** early in your pipeline if using .blend files
3. **Keep OBJ as fallback** for maximum compatibility with legacy software
4. **Use binary formats** (.glb, binary STL) for production to reduce file sizes
5. **Validate imports** with proper error handling for all formats

## 📚 Additional Resources

- [GLTF Animation Guide](./GLTF_ANIMATION_GUIDE.md)
- [API Examples](../examples/)
- [Format Comparison Tests](../tests/)

---

*This library provides comprehensive 3D format support for modern web applications and 3D workflows.* 