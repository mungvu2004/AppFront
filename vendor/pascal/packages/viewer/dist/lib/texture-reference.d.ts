import type * as THREE from 'three';
export type PascalTextureMap = 'basecolor' | 'normal' | 'roughness' | 'metalness' | 'height' | 'other';
export type PascalTextureColorSpace = 'srgb' | 'linear';
type PascalTextureRefBase = {
    v: 1;
    src: string;
    map: PascalTextureMap;
    colorSpace: PascalTextureColorSpace;
};
export type PascalTextureRef = (PascalTextureRefBase & {
    kind: 'library-material' | 'app-material' | 'project-asset';
}) | (PascalTextureRefBase & {
    kind: 'item-glb';
    imageIndex: number;
});
export declare function textureMapForSlot(slot: string): PascalTextureMap;
export declare function stampPascalTextureRef(texture: THREE.Texture, input: {
    /** 'material' resolves to library-material (storage bucket) or
     *  app-material (static catalog on the assets CDN) by URL shape. */
    kind: 'material' | 'project-asset';
    src: string;
    slot: string;
} | {
    kind: 'item-glb';
    src: string;
    slot: string;
    imageIndex: number;
}): PascalTextureRef | null;
export declare function getPascalTextureRef(texture: THREE.Texture): PascalTextureRef | null;
export {};
//# sourceMappingURL=texture-reference.d.ts.map