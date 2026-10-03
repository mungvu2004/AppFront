import { type AnyNode, type LazyComponent } from '@pascal-app/core';
import type { Object3D, Texture } from 'three';
export type ViewerPresentationConfiguration = {
    /** Returns a detached, versioned snapshot suitable for host-owned persistence. */
    getSnapshot: () => unknown;
    /** Validates and applies a previously persisted snapshot. */
    restore: (snapshot: unknown) => void;
    /** Restores the contribution's initial presentation state. */
    reset: () => void;
    /** Notifies the host only when persisted presentation state changes. */
    subscribe: (onChange: () => void) => () => void;
};
export type ViewerPresentationExportContext = {
    /** Full semantic snapshot; output selection never removes generation context. */
    nodes: Readonly<Record<string, AnyNode>>;
    /** Detached contribution configuration captured once when export starts. */
    configuration: unknown;
    onlyVisible: boolean;
    excludedNodeTypes: readonly string[];
};
export type ViewerPresentationStaticExport = {
    label: string;
    build: (ctx: ViewerPresentationExportContext) => Object3D | null | Promise<Object3D | null>;
};
/**
 * Marks a cached presentation texture handle as borrowed. Static export owns
 * every returned resource by default; the host clones marked handles before
 * attaching the contribution and never disposes the marked source handle.
 */
export declare function markViewerPresentationTextureBorrowed<T extends Texture>(texture: T): T;
export declare function isViewerPresentationTextureBorrowed(texture: Texture): boolean;
export type ViewerPresentationContribution = {
    /** Globally unique contribution id, conventionally `${pluginId}:presentation`. */
    id: string;
    /** Project installation gate. Omit only for host-owned, always-on presentation. */
    pluginId?: string;
    /** Lazy R3F subtree mounted as a sibling of the authored scene renderer. */
    component: LazyComponent;
    /** Optional host persistence seam; never stored in the semantic scene graph. */
    configuration?: ViewerPresentationConfiguration;
    /**
     * Explicit opt-in static artifact contribution. The returned root must be
     * detached and uses the presentation's existing world coordinates.
     */
    staticExport?: ViewerPresentationStaticExport;
};
declare class ViewerPresentationRegistryImpl {
    private readonly contributions;
    private readonly listeners;
    private cached;
    subscribe: (onChange: () => void) => (() => void);
    getSnapshot: () => ViewerPresentationContribution[];
    reset(): void;
    register(contribution: ViewerPresentationContribution): void;
    private emit;
}
export declare const viewerPresentationRegistry: ViewerPresentationRegistryImpl;
export declare function registerViewerPresentation(contribution: ViewerPresentationContribution): void;
/**
 * Mounts registered presentation-only R3F subtrees for the current project.
 * Hosts place this once inside each Viewer they want to include presentation;
 * semantic scene export remains isolated because the mount is a sibling of
 * `scene-renderer`, not one of its authored descendants.
 */
export declare function ViewerPresentations(): (import("react").JSX.Element | null)[];
export {};
//# sourceMappingURL=viewer-presentations.d.ts.map