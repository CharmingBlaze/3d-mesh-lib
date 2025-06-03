import { Vector3D } from '@/utils/Vector3D';
import { Texture, TextureOptions as CoreTextureOptions } from './Texture'; // Renamed to avoid conflict

// Helper type for MaterialOptions to accept Texture, string (source), or TextureOptions
export type TextureInput = string | Texture | CoreTextureOptions;

/**
 * Represents a material applied to a 3D model's surfaces.
 */
export class Material {
  private static nextId = 0;
  public id: number;
  public name: string;

  /**
   * Gets the next available ID for a new material.
   * @returns The next material ID.
   */
  public static getNextId(): number {
    return Material.nextId;
  }

  // Basic properties
  public color: Vector3D;
  public emissiveColor: Vector3D;
  public opacity: number;
  public transparent: boolean;

  // PBR Metal-Roughness workflow properties
  public metallic: number;
  public roughness: number;
  public albedoTexture: Texture | null = null;
  public metallicRoughnessTexture: Texture | null = null;
  public normalTexture: Texture | null = null;
  public occlusionTexture: Texture | null = null;
  public emissiveTexture: Texture | null = null;
  public metadata: Record<string, any> = {};

  constructor(name: string, options: Partial<MaterialOptions> = {}) {
    this.id = Material.nextId++;
    this.name = name;

    this.color = options.color?.clone() ?? new Vector3D(0.8, 0.8, 0.8);
    this.emissiveColor = options.emissiveColor?.clone() ?? new Vector3D(0, 0, 0);
    this.opacity = options.opacity ?? 1.0;
    this.transparent = options.transparent ?? this.opacity < 1.0;

    this.metallic = options.metallic ?? 0.0;
    this.roughness = options.roughness ?? 0.5;

    this.albedoTexture = this._createTextureFromInput(options.albedoTexture);
    this.metallicRoughnessTexture = this._createTextureFromInput(options.metallicRoughnessTexture);
    this.normalTexture = this._createTextureFromInput(options.normalTexture);
    this.occlusionTexture = this._createTextureFromInput(options.occlusionTexture);
    this.emissiveTexture = this._createTextureFromInput(options.emissiveTexture);

    this.metadata = options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : {};
  }

  private _createTextureFromInput(input?: TextureInput | null): Texture | null {
    if (!input) return null;
    if (input instanceof Texture) {
      return input; // Or input.clone() if ownership dictates new instance
    }
    if (typeof input === 'string') {
      return new Texture(input);
    }
    // Assuming it's CoreTextureOptions
    const source = input.source || ''; // Texture constructor needs a source
    return new Texture(source, input as CoreTextureOptions);
  }

  clone(): Material {
    const newMatOptions: MaterialOptions = {
      color: this.color.clone(),
      emissiveColor: this.emissiveColor.clone(),
      opacity: this.opacity,
      transparent: this.transparent,
      metallic: this.metallic,
      roughness: this.roughness,
      albedoTexture: this.albedoTexture?.clone() ?? null,
      metallicRoughnessTexture: this.metallicRoughnessTexture?.clone() ?? null,
      normalTexture: this.normalTexture?.clone() ?? null,
      occlusionTexture: this.occlusionTexture?.clone() ?? null,
      emissiveTexture: this.emissiveTexture?.clone() ?? null,
      metadata: JSON.parse(JSON.stringify(this.metadata)),
    };
    // Create new material with cloned textures/properties
    // The name is slightly modified to indicate it's a copy.
    const newMat = new Material(this.name + '_copy', newMatOptions);
    // The ID is handled by the Material constructor's static nextId.
    return newMat;
  }

  static resetIdCounter(): void {
    Material.nextId = 0;
  }

  toString(): string {
    return `Material(${this.id}, "${this.name}", Color: ${this.color.toString()})`;
  }
  
  // Helper to convert Texture to its options for JSON serialization
  private _textureToJSON(texture: Texture | null): CoreTextureOptions | null {
    if (!texture) return null;
    return {
        name: texture.name,
        source: texture.source,
        offset: texture.offset.clone(), // Assuming Vector2D has clone
        scale: texture.scale.clone(),   // Assuming Vector2D has clone
        rotation: texture.rotation,
        wrapS: texture.wrapS,
        wrapT: texture.wrapT,
        magFilter: texture.magFilter,
        minFilter: texture.minFilter,
    };
  }

  toJSON(): {
    id: number;
    name: string;
    color: [number, number, number];
    emissiveColor: [number, number, number];
    opacity: number;
    transparent: boolean;
    metallic: number;
    roughness: number;
    albedoTexture: CoreTextureOptions | null;
    metallicRoughnessTexture: CoreTextureOptions | null;
    normalTexture: CoreTextureOptions | null;
    occlusionTexture: CoreTextureOptions | null;
    emissiveTexture: CoreTextureOptions | null;
    metadata: Record<string, any>;
  } {
    return {
      id: this.id,
      name: this.name,
      color: this.color.toArray(),
      emissiveColor: this.emissiveColor.toArray(),
      opacity: this.opacity,
      transparent: this.transparent,
      metallic: this.metallic,
      roughness: this.roughness,
      albedoTexture: this._textureToJSON(this.albedoTexture),
      metallicRoughnessTexture: this._textureToJSON(this.metallicRoughnessTexture),
      normalTexture: this._textureToJSON(this.normalTexture),
      occlusionTexture: this._textureToJSON(this.occlusionTexture),
      emissiveTexture: this._textureToJSON(this.emissiveTexture),
      metadata: this.metadata,
    };
  }

  static fromJSON(json: ReturnType<Material['toJSON']>): Material {
    const material = new Material(json.name, {
      color: Vector3D.fromArray(json.color),
      emissiveColor: Vector3D.fromArray(json.emissiveColor),
      opacity: json.opacity,
      transparent: json.transparent,
      metallic: json.metallic,
      roughness: json.roughness,
      albedoTexture: json.albedoTexture ? new Texture(json.albedoTexture.source || '', json.albedoTexture) : null,
      metallicRoughnessTexture: json.metallicRoughnessTexture ? new Texture(json.metallicRoughnessTexture.source || '', json.metallicRoughnessTexture) : null,
      normalTexture: json.normalTexture ? new Texture(json.normalTexture.source || '', json.normalTexture) : null,
      occlusionTexture: json.occlusionTexture ? new Texture(json.occlusionTexture.source || '', json.occlusionTexture) : null,
      emissiveTexture: json.emissiveTexture ? new Texture(json.emissiveTexture.source || '', json.emissiveTexture) : null,
      metadata: json.metadata,
    });
    material.id = json.id;

    if (json.id >= Material.nextId) {
      Material.nextId = json.id + 1;
    }
    return material;
  }

  equals(other: Material): boolean {
    if (!other) return false;

    const compareTextures = (tex1: Texture | null, tex2: Texture | null): boolean => {
      if (tex1 === null && tex2 === null) return true;
      if (tex1 === null || tex2 === null) return false;
      // Add more comprehensive Texture.equals method later if needed
      return tex1.source === tex2.source &&
             tex1.offset.equals(tex2.offset) &&
             tex1.scale.equals(tex2.scale) &&
             tex1.rotation === tex2.rotation &&
             tex1.wrapS === tex2.wrapS &&
             tex1.wrapT === tex2.wrapT &&
             tex1.magFilter === tex2.magFilter &&
             tex1.minFilter === tex2.minFilter;
    };

    return (
      this.name === other.name &&
      this.color.equals(other.color) &&
      this.emissiveColor.equals(other.emissiveColor) &&
      this.opacity === other.opacity &&
      this.transparent === other.transparent &&
      this.metallic === other.metallic &&
      this.roughness === other.roughness &&
      compareTextures(this.albedoTexture, other.albedoTexture) &&
      compareTextures(this.metallicRoughnessTexture, other.metallicRoughnessTexture) &&
      compareTextures(this.normalTexture, other.normalTexture) &&
      compareTextures(this.occlusionTexture, other.occlusionTexture) &&
      compareTextures(this.emissiveTexture, other.emissiveTexture) &&
      JSON.stringify(this.metadata) === JSON.stringify(other.metadata)
    );
  }
}

/**
 * Interface for material options to pass to the constructor.
 * All properties are optional.
 */
export interface MaterialOptions {
  color?: Vector3D;
  emissiveColor?: Vector3D;
  opacity?: number;
  transparent?: boolean;
  metallic?: number;
  roughness?: number;
  albedoTexture?: TextureInput | null;
  metallicRoughnessTexture?: TextureInput | null;
  normalTexture?: TextureInput | null;
  occlusionTexture?: TextureInput | null;
  emissiveTexture?: TextureInput | null;
  metadata?: Record<string, any>;
}
