import { type AnyNode } from '@pascal-app/core';
import type { Object3D } from 'three';
import * as THREE from 'three';
import { type GLTFWriter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { type ExportTextureUtils } from './export-texture-utils';
import { type CompressedTextureDecompressor } from './portable-export';
export type GlbExport = {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
    warnings: string[];
    dispose: () => void;
};
export type GlbExportOptions = {
    textures?: 'embed' | 'reference';
    onlyVisible?: boolean;
    /** Omit these node kinds and their rendered subtrees before baking. */
    excludedNodeTypes?: readonly string[];
    /** Selected static viewer-presentation contributions; omitted means none. */
    includedPresentationIds?: readonly string[];
    /** Portable materials/geometry normalisation vs the baked viewer artifact. */
    purpose?: 'portable' | 'viewer';
    /**
     * Door/window open clips. Defaults to `keep` for the viewer bake and for GLB
     * downloads (Blender turns them into actions); USDZ and print pass `none`
     * because those formats freeze geometry and cannot play them.
     */
    animations?: 'keep' | 'none';
    /** Called for actual lossy portable conversions discovered during preparation. */
    onWarning?: (warning: string) => void;
    /** Reject retained node kinds whose export geometry can only be baked asynchronously. */
    requireSynchronousBake?: boolean;
    /** GPU decompressor for compressed normal maps that must be baked; defaults to `textureUtils`. */
    decompressTexture?: CompressedTextureDecompressor;
    /**
     * Shared GPU decompressor for every compressed texture in the export. The
     * export entry points create one per export and dispose it; supplying your
     * own keeps ownership with you.
     */
    textureUtils?: ExportTextureUtils;
    /**
     * Wall-clock deadline for the whole export (preparation and serialisation),
     * after which it rejects instead of leaving the caller waiting. Defaults to
     * `DEFAULT_MODEL_EXPORT_TIMEOUT_MS`; `Infinity` disables it.
     */
    timeoutMs?: number;
};
export declare const DEFAULT_MODEL_EXPORT_TIMEOUT_MS = 180000;
/**
 * three's exporters finish inside `FileReader.onloadend` and `canvas.toBlob`
 * callbacks that carry no error path: a failed read or a callback the browser
 * never invokes calls neither `onDone` nor `onError`, so without a deadline the
 * returned promise stays pending forever and the export UI is stuck.
 */
export declare function withExportDeadline<Result>(promise: Promise<Result>, timeoutMs: number, format: string, onTimeout?: () => void): Promise<Result>;
/** Resolve after the next couple of animation frames, giving React/R3F time to
 * commit and mount export-only geometry (e.g. instanced kinds' real meshes)
 * before the exporter clones the scene graph. Callers must set
 * `useViewer.setExporting(true)` first and reset it after the export. */
export declare function nextFrames(): Promise<void>;
export declare function writeTextureReferenceExtras(writer: GLTFWriter, texture: THREE.Texture, textureDef: Record<string, unknown>): void;
export declare function exportSceneToGlb(sceneGroup: Object3D, nodes: Record<string, AnyNode>, options?: GlbExportOptions): Promise<ArrayBuffer>;
/**
 * Capture the live renderer synchronously, restore editor presentation, then do
 * async offscreen material/presentation work against only the owned clone.
 */
export declare function preparePortableSceneFromViewer(sceneGroup: Object3D, nodes: Record<string, AnyNode>, options?: GlbExportOptions): Promise<GlbExport>;
/** Serialise a prepared scene; callers own the deadline (see `exportSceneToGlb`). */
export declare function serializePreparedSceneToGlb(prepared: GlbExport, options: Pick<GlbExportOptions, 'textures' | 'onlyVisible'> & {
    textureUtils: ExportTextureUtils;
}): Promise<ArrayBuffer>;
/**
 * Build the legacy synchronous artifact used by geometry-only/print exports.
 * The default remains viewer-purpose so existing internal baked-viewer clips
 * are unchanged; portable downloads use the async entry point below.
 */
export declare function prepareSceneForExport(source: THREE.Object3D, nodes: Record<string, AnyNode>, options?: GlbExportOptions): GlbExport;
/** Capture once, await async bake hooks, then normalize a static portable tree. */
export declare function prepareSceneForExportAsync(source: THREE.Object3D, nodes: Record<string, AnyNode>, options?: GlbExportOptions): Promise<GlbExport>;
//# sourceMappingURL=glb-export.d.ts.map