import { Vector2D } from '@/utils/Vector2D';

export enum TextureWrapMode {
  ClampToEdge = 'ClampToEdge',
  Repeat = 'Repeat',
  MirroredRepeat = 'MirroredRepeat',
}

export enum TextureFilterMode {
  Nearest = 'Nearest', // No filtering, sharp pixels
  Linear = 'Linear',   // Bilinear filtering, smoother
  // Mipmap options can be added later if needed
  // NearestMipmapNearest = 'NearestMipmapNearest',
  // LinearMipmapNearest = 'LinearMipmapNearest',
  // NearestMipmapLinear = 'NearestMipmapLinear',
  // LinearMipmapLinear = 'LinearMipmapLinear',
}

export interface TextureOptions {
  name?: string;
  source?: string;
  offset?: Vector2D;
  scale?: Vector2D;
  rotation?: number; // In radians
  wrapS?: TextureWrapMode;
  wrapT?: TextureWrapMode;
  magFilter?: TextureFilterMode;
  minFilter?: TextureFilterMode;
  // imageData?: HTMLImageElement | ImageData; // For pre-loaded data
}

/**
 * Represents a texture that can be applied to a material.
 */
export class Texture {
  private static nextId = 0;
  public id: number;
  public name: string;
  public source: string; // URL or path to the image file

  // UV transformation properties
  public offset: Vector2D;
  public scale: Vector2D;
  public rotation: number; // In radians

  // Texture settings
  public wrapS: TextureWrapMode;
  public wrapT: TextureWrapMode;
  public magFilter: TextureFilterMode; // Magnification filter
  public minFilter: TextureFilterMode; // Minification filter

  // Placeholder for actual image data or GPU texture object
  public imageData: HTMLImageElement | null = null; // Or any other suitable type like ImageData, ImageBitmap
  public needsUpdate: boolean = false; // Flag to indicate if the texture data needs to be processed/uploaded

  /**
   * Creates a new Texture instance.
   * @param source - The source URL or path for the texture image.
   * @param options - Optional parameters to initialize the texture.
   */
  constructor(source: string, options: TextureOptions = {}) {
    this.id = Texture.nextId++;
    this.name = options.name ?? `Texture_${this.id}`;
    this.source = source || options.source || '';

    this.offset = options.offset?.clone() ?? new Vector2D(0, 0);
    this.scale = options.scale?.clone() ?? new Vector2D(1, 1);
    this.rotation = options.rotation ?? 0;

    this.wrapS = options.wrapS ?? TextureWrapMode.Repeat;
    this.wrapT = options.wrapT ?? TextureWrapMode.Repeat;
    this.magFilter = options.magFilter ?? TextureFilterMode.Linear;
    this.minFilter = options.minFilter ?? TextureFilterMode.Linear;

    // if (options.imageData) {
    //   this.imageData = options.imageData;
    // }

    if (!this.source /* && !this.imageData */) {
      console.warn(`Texture created (ID: ${this.id}, Name: "${this.name}") without a source or initial image data.`);
    }
  }

  // Placeholder for image loading logic
  async loadImage(source?: string): Promise<void> {
    const src = source || this.source;
    if (!src) {
      console.error('Texture.loadImage: No source provided.');
      return Promise.reject('No source');
    }
    this.source = src; // Update source if a new one is passed
    
    // Basic image loading for browser environment
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS if loading from different domains
      img.onload = () => {
        this.imageData = img;
        this.needsUpdate = true;
        console.log(`Texture loaded: ${this.source}`);
        resolve();
      };
      img.onerror = (err) => {
        console.error(`Failed to load texture: ${this.source}`, err);
        this.imageData = null; // Clear any previous data
        reject(err);
      };
      img.src = this.source;
    });
  }

  clone(): Texture {
    const newTex = new Texture(this.source, {
      name: this.name + '_copy',
      offset: this.offset.clone(),
      scale: this.scale.clone(),
      rotation: this.rotation,
      wrapS: this.wrapS,
      wrapT: this.wrapT,
      magFilter: this.magFilter,
      minFilter: this.minFilter,
    });
    // Note: imageData is not cloned directly here. 
    // The new texture would typically load its own image or share the reference based on design.
    // For simplicity, we'll assume it needs to load its own if source is present.
    // If imageData was some raw data buffer, a deep copy might be needed.
    if (this.imageData) {
        // If we want to share the loaded image data:
        // newTex.imageData = this.imageData; 
        // Or if we want it to reload (safer if original might change or be disposed):
        // newTex.loadImage().catch(e => console.warn("Failed to reload image for cloned texture", e));
    }
    return newTex;
  }

  static resetIdCounter(): void {
    Texture.nextId = 0;
  }

  dispose(): void {
    // Placeholder for any cleanup, e.g., releasing GPU resources if applicable
    this.imageData = null;
    console.log(`Texture disposed: ${this.name}`);
  }

  toString(): string {
    return `Texture(${this.id}, "${this.name}", Source: "${this.source}")`;
  }

  /**
   * Serializes the Texture instance to a JSON object.
   * @returns A JSON representation of the texture.
   */
  toJSON(): {
    id: number;
    name: string;
    source: string;
    offset: [number, number];
    scale: [number, number];
    rotation: number;
    wrapS: TextureWrapMode;
    wrapT: TextureWrapMode;
    magFilter: TextureFilterMode;
    minFilter: TextureFilterMode;
  } {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      offset: this.offset.toArray(),
      scale: this.scale.toArray(),
      rotation: this.rotation,
      wrapS: this.wrapS,
      wrapT: this.wrapT,
      magFilter: this.magFilter,
      minFilter: this.minFilter,
    };
  }

  /**
   * Creates a Texture instance from a JSON object.
   * @param json - The JSON object representing a texture.
   * @returns A new Texture instance.
   */
  static fromJSON(json: ReturnType<Texture['toJSON']>): Texture {
    const texture = new Texture(json.source, {
      name: json.name,
      offset: Vector2D.fromArray(json.offset),
      scale: Vector2D.fromArray(json.scale),
      rotation: json.rotation,
      wrapS: json.wrapS,
      wrapT: json.wrapT,
      magFilter: json.magFilter,
      minFilter: json.minFilter,
    });
    texture.id = json.id; // Override the auto-assigned ID

    // Ensure nextId is updated to avoid collisions
    if (json.id >= Texture.nextId) {
      Texture.nextId = json.id + 1;
    }
    return texture;
  }
}
