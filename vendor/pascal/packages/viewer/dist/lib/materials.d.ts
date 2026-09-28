import { type MaterialPresetPayload, type MaterialSchema, type SceneMaterial, type SceneMaterialId, type SurfaceRole } from '@pascal-app/core';
import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
export type RenderShading = 'solid' | 'rendered';
export type ColorPreset = 'clay' | 'white' | 'mono' | 'blueprint';
export declare const CLAY_PALETTE: Record<SurfaceRole, string>;
export declare const WHITE_PALETTE: Record<SurfaceRole, string>;
export declare const MONO_PALETTE: Record<SurfaceRole, string>;
export declare const BLUEPRINT_PALETTE: Record<SurfaceRole, string>;
export declare const PRESET_PALETTES: Record<ColorPreset, Record<SurfaceRole, string>>;
export declare function resolveSurfaceColor(role: SurfaceRole, preset: ColorPreset, sceneThemeId?: string): string;
export declare const glassMaterial: MeshLambertNodeMaterial;
export declare function getMaterialTextureVersion(): number;
export declare function resolveTextureRepeat(repeat: unknown, scale: unknown): [number, number];
export declare function getTextureKey(material?: MaterialSchema): string;
export declare function applyMaterialPresetToMaterials(materialInput: THREE.Material | THREE.Material[], preset: MaterialPresetPayload | null | undefined): void;
export declare function createMaterialFromPreset(preset: MaterialPresetPayload, shading?: RenderShading): THREE.Material;
export declare function createMaterialFromPresetRef(materialPreset?: string, shading?: RenderShading): THREE.Material | null;
export declare function createMaterial(material?: MaterialSchema, shading?: RenderShading): THREE.Material;
/**
 * Cache-signature fragment for a catalog preset ref. Dynamic library
 * materials (AI-generated `library:mtl_*`) register asynchronously, so a ref
 * that fails to resolve is NOT static content: tag it so signature-keyed
 * material caches re-resolve once the library registers instead of pinning
 * the dangling-ref fallback for the whole session.
 */
export declare function materialPresetRefSignature(ref: string): string;
/**
 * Resolve a MaterialRef ('library:<id>' | 'scene:<id>') to a three.js material.
 * Returns null for an unknown / dangling ref so callers fall back to the
 * slot's default (authored material, then themed default). Never throws.
 */
export declare function resolveMaterialRef(ref: string | undefined, sceneMaterials: Record<SceneMaterialId, SceneMaterial> | undefined, shading?: RenderShading): THREE.Material | null;
/**
 * Resolve a node kind's declared slot default — either a catalog `library:<id>`
 * finish or a flat `#rrggbb` colour — to a renderable material. Shared by the
 * procedural kinds whose colored-mode unpainted appearance comes from a
 * declarative default (slab, wall).
 */
export declare function resolveSlotDefaultMaterial(slotDefault: string, shading?: RenderShading, roughness?: number): THREE.Material;
export declare function createDefaultMaterial(color?: string, roughness?: number, shading?: RenderShading, side?: THREE.Side): THREE.Material;
export declare function createSurfaceRoleMaterial(role: SurfaceRole, preset: ColorPreset, side?: THREE.Side, sceneThemeId?: string): THREE.Material;
export declare function baseMaterial(shading?: RenderShading): THREE.Material;
export declare function DEFAULT_WALL_MATERIAL(shading?: RenderShading): THREE.Material;
export declare function DEFAULT_SLAB_MATERIAL(shading?: RenderShading): THREE.Material;
export declare function DEFAULT_DOOR_MATERIAL(shading?: RenderShading): THREE.Material;
export declare function DEFAULT_WINDOW_MATERIAL(shading?: RenderShading): THREE.Material;
export declare function DEFAULT_CEILING_MATERIAL(shading?: RenderShading): THREE.Material;
export declare function DEFAULT_ROOF_MATERIAL(shading?: RenderShading): THREE.Material;
export declare function DEFAULT_SHELF_MATERIAL(shading?: RenderShading): THREE.Material;
export declare function DEFAULT_STAIR_MATERIAL(shading?: RenderShading): THREE.Material;
export declare function disposeMaterial(material: THREE.Material): void;
type MaterialCacheCleanup = (() => void) | (() => () => void);
export declare function registerMaterialCacheCleanup(cleanup: MaterialCacheCleanup): () => void;
export declare function clearMaterialCache(): void;
export {};
//# sourceMappingURL=materials.d.ts.map