/**
 * 🗂️ GLTF Types - Interface definitions for GLTF format
 * 
 * Contains all TypeScript interfaces and types needed for GLTF import/export,
 * including core GLTF structures, animation data, and skinning information.
 */

// Define a type for the processed GLTF data for clarity
// This is based on loaders.gl's GLTFObject, but simplified for our needs.
export interface ProcessedGltf {
  json: GltfJson; // The raw GLTF JSON, potentially modified by postProcessGLTF
  buffers: { arrayBuffer: ArrayBuffer, byteOffset: number, byteLength: number }[];
  images?: (ImageBitmap | HTMLImageElement)[];
  // scenes, nodes, meshes, accessors, bufferViews, materials, textures etc. are in json property
  // postProcessGLTF might hoist some of these to the top level or enrich them.
}

// Basic type definitions for parts of the glTF JSON structure
export interface GltfJson {
  scenes?: GltfSceneJson[];
  nodes?: GltfNodeJson[];
  meshes?: GltfMeshJson[];
  materials?: GltfMaterialJson[];
  accessors?: GltfAccessorJson[];
  bufferViews?: GltfBufferViewJson[];
  buffers?: GltfBufferJson[];
  textures?: GltfTextureJson[];
  images?: GltfImageJson[];
  samplers?: GltfSamplerJson[];
  skins?: GltfSkinJson[];
  animations?: GltfAnimationJson[];
  asset?: {
    version: string;
    generator?: string;
    minVersion?: string;
    copyright?: string;
  };
  scene?: number; // Index of default scene
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  // Add other glTF top-level properties as needed
}

export interface GltfMaterialJson {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    metallicFactor?: number;
    roughnessFactor?: number;
    baseColorTexture?: { index: number; texCoord?: number };
    metallicRoughnessTexture?: { index: number; texCoord?: number };
  };
  emissiveFactor?: number[];
  emissiveTexture?: { index: number; texCoord?: number };
  normalTexture?: { index: number; texCoord?: number; scale?: number };
  occlusionTexture?: { index: number; texCoord?: number; strength?: number };
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff?: number;
  doubleSided?: boolean;
  extensions?: any;
  extras?: any;
}

export interface GltfPrimitiveJson {
  attributes: {
    POSITION: number;
    NORMAL?: number;
    TEXCOORD_0?: number;
    TEXCOORD_1?: number;
    TANGENT?: number;
    COLOR_0?: number;
    JOINTS_0?: number; // For skinning
    WEIGHTS_0?: number; // For skinning
    [key: string]: number | undefined; // Allow custom attributes
  };
  indices?: number;
  material?: number;
  mode?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // POINTS, LINES, LINE_LOOP, LINE_STRIP, TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN
  targets?: { [attribute: string]: number }[]; // For morph targets
  extensions?: any;
  extras?: any;
}

export interface GltfMeshJson {
  name?: string;
  primitives: GltfPrimitiveJson[];
  weights?: number[]; // For morph targets
  extensions?: any;
  extras?: any;
}

export interface GltfNodeJson {
  name?: string;
  mesh?: number; 
  camera?: number;
  skin?: number;
  children?: number[]; 
  matrix?: number[]; // 4x4 transformation matrix
  translation?: [number, number, number];
  rotation?: [number, number, number, number]; // Quaternion [x, y, z, w]
  scale?: [number, number, number];
  weights?: number[]; // For morph targets
  extensions?: any;
  extras?: any;
}

export interface GltfSceneJson {
  name?: string;
  nodes?: number[];
  extensions?: any;
  extras?: any;
}

export interface GltfBufferJson {
  uri?: string; // For external .bin files or data URIs
  byteLength: number;
  name?: string;
  _buffer?: ArrayBuffer; // For loaders.gl post-processing attaching buffer data
}

export interface GltfBufferViewJson {
  buffer: number; // Index of the buffer
  byteOffset?: number;
  byteLength: number;
  byteStride?: number; // For interleaved data
  target?: 34962 | 34963; // ARRAY_BUFFER | ELEMENT_ARRAY_BUFFER
  name?: string;
  extensions?: any;
  extras?: any;
}

export interface GltfAccessorJson {
  bufferView?: number; // Index of the bufferView
  byteOffset?: number;
  componentType: 5120 | 5121 | 5122 | 5123 | 5125 | 5126; // BYTE, UNSIGNED_BYTE, SHORT, UNSIGNED_SHORT, UNSIGNED_INT, FLOAT
  normalized?: boolean;
  count: number; // Number of elements (e.g., number of vertices)
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';
  min?: number[]; // Minimum component values
  max?: number[]; // Maximum component values
  name?: string;
  sparse?: {
    count: number;
    indices: { bufferView: number; byteOffset?: number; componentType: number };
    values: { bufferView: number; byteOffset?: number };
  };
  extensions?: any;
  extras?: any;
}

export interface GltfTextureJson {
  sampler?: number;
  source?: number; // Index of image
  name?: string;
  extensions?: any;
  extras?: any;
}

export interface GltfImageJson {
  uri?: string;
  mimeType?: string;
  bufferView?: number;
  name?: string;
  extensions?: any;
  extras?: any;
}

export interface GltfSamplerJson {
  magFilter?: 9728 | 9729; // NEAREST | LINEAR
  minFilter?: 9728 | 9729 | 9984 | 9985 | 9986 | 9987; // NEAREST | LINEAR | NEAREST_MIPMAP_NEAREST | LINEAR_MIPMAP_NEAREST | NEAREST_MIPMAP_LINEAR | LINEAR_MIPMAP_LINEAR
  wrapS?: 33071 | 33648 | 10497; // CLAMP_TO_EDGE | MIRRORED_REPEAT | REPEAT
  wrapT?: 33071 | 33648 | 10497; // CLAMP_TO_EDGE | MIRRORED_REPEAT | REPEAT
  name?: string;
  extensions?: any;
  extras?: any;
}

// Animation and skinning interfaces
export interface GltfSkinJson {
  name?: string;
  inverseBindMatrices?: number; // accessor index for inverse bind matrices
  skeleton?: number; // node index of skeleton root
  joints: number[]; // array of node indices for bones
  extensions?: any;
  extras?: any;
}

export interface GltfAnimationJson {
  name?: string;
  channels: GltfAnimationChannelJson[];
  samplers: GltfAnimationSamplerJson[];
  extensions?: any;
  extras?: any;
}

export interface GltfAnimationChannelJson {
  sampler: number; // index into samplers array
  target: {
    node?: number; // target node index
    path: 'translation' | 'rotation' | 'scale' | 'weights';
    extensions?: any;
    extras?: any;
  };
  extensions?: any;
  extras?: any;
}

export interface GltfAnimationSamplerJson {
  input: number; // accessor index for keyframe times
  output: number; // accessor index for keyframe values
  interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
  extensions?: any;
  extras?: any;
}

// Utility type for GLTF component types
export const GLTF_COMPONENT_TYPES = {
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_INT: 5125,
  FLOAT: 5126
} as const;

// Utility type for GLTF targets
export const GLTF_TARGETS = {
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963
} as const;

// Utility type for GLTF primitive modes
export const GLTF_PRIMITIVE_MODES = {
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6
} as const;

// Utility type for texture filters
export const GLTF_TEXTURE_FILTERS = {
  NEAREST: 9728,
  LINEAR: 9729,
  NEAREST_MIPMAP_NEAREST: 9984,
  LINEAR_MIPMAP_NEAREST: 9985,
  NEAREST_MIPMAP_LINEAR: 9986,
  LINEAR_MIPMAP_LINEAR: 9987
} as const;

// Utility type for texture wrap modes
export const GLTF_TEXTURE_WRAPS = {
  CLAMP_TO_EDGE: 33071,
  MIRRORED_REPEAT: 33648,
  REPEAT: 10497
} as const; 