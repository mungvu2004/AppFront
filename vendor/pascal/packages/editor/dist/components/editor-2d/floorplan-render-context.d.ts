import type { FloorplanPalette } from '@pascal-app/core';
import { type ReactNode } from 'react';
/**
 * Per-frame render context shared between the legacy `floorplan-panel.tsx`
 * and the registry-driven `<FloorplanRegistryLayer>`.
 *
 * The legacy panel is the authoritative owner of the floor-plan SVG —
 * it computes `unitsPerPixel` from the viewBox / surface size, mounts the
 * pan/zoom `<g>`, and knows the active theme. The registry layer is mounted
 * inside the same `<g>`, so anything it draws shares the same coordinate
 * system; this context plumbs through the bits it can't recompute on its
 * own without re-implementing the legacy's resize / theme logic.
 *
 * Once `floorplan-panel.tsx` is fully migrated (Phase 6), this provider
 * moves into a kind-agnostic 2D editor shell and the context loses the
 * "legacy bridge" connotation.
 */
export type FloorplanRenderContextValue = {
    /** SVG units per screen pixel — used to keep handle radii consistent at any zoom. */
    unitsPerPixel: number;
    /** Themed palette mirroring the legacy `FloorplanPalette` accent slots. */
    palette: FloorplanPalette;
    /** SVG `<pattern>` id mounted in `<defs>` by the legacy panel for selection hatch fills. */
    hatchPatternId: string;
    /**
     * Rotation (degrees) applied to the registry layer's parent `<g>` by the
     * legacy panel — 90° by default, adjusted by building rotation. Renderers
     * that emit text labels use this to keep their final on-screen orientation
     * readable instead of mirroring whatever the parent rotation is.
     */
    sceneRotationDeg: number;
};
export type FloorplanStaticRenderContextValue = Omit<FloorplanRenderContextValue, 'sceneRotationDeg' | 'unitsPerPixel'> & {
    getSceneRotationDeg: () => number;
    getUnitsPerPixel: () => number;
    subscribeUnitsPerPixel: (listener: () => void) => () => void;
};
export type FloorplanRenderScaleReference = {
    read: () => number;
    subscribe: (listener: () => void) => () => void;
    update: (unitsPerPixel: number) => void;
};
export declare function createFloorplanRenderScaleReference(initialUnitsPerPixel: number): FloorplanRenderScaleReference;
export declare function FloorplanRenderProvider({ children, unitsPerPixel, palette, hatchPatternId, sceneRotationDeg, getSceneRotationDeg, }: FloorplanRenderContextValue & {
    children: ReactNode;
    getSceneRotationDeg: () => number;
}): import("react").JSX.Element;
/**
 * Read the active render context. Returns `null` when called outside a
 * provider — the registry layer treats this as "render statically, skip
 * theme-aware chrome and interactive handles". This makes the layer
 * usable in isolation tests + future editor shells without bringing the
 * whole legacy panel along.
 */
export declare function useFloorplanRender(): FloorplanRenderContextValue | null;
export declare function useFloorplanStaticRender(): FloorplanStaticRenderContextValue | null;
export declare function useFloorplanStaticUnitsPerPixel(): number;
export declare function useFloorplanSceneRotation(): number;
//# sourceMappingURL=floorplan-render-context.d.ts.map