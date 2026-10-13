import type { ReactNode } from 'react';
import { ClippingGroup, Plane } from 'three/webgpu';
/** Slider range of the cut, in metres above the ground plane. */
export declare const SECTION_PLANE_MIN_M = 0;
export declare const SECTION_PLANE_MAX_M = 30;
export declare const SECTION_PLANE_STEP_M = 0.1;
type SectionPlaneState = {
    enabled: boolean;
    /** World Y of the cut. Everything ABOVE it is clipped away. */
    height: number;
    setEnabled: (enabled: boolean) => void;
    toggle: () => void;
    setHeight: (height: number) => void;
};
export declare const clampSectionHeight: (height: number) => number;
export declare const useSectionPlane: import("zustand").UseBoundStore<import("zustand").StoreApi<SectionPlaneState>>;
/**
 * Plane that keeps what is below `height`: three keeps the side where
 * `normal·p + constant >= 0`, so a downward normal with `constant = height`
 * keeps `y <= height`.
 */
export declare function sectionPlaneAt(height: number, target?: Plane): Plane;
/** The group that holds the rendered building — the ViewCube frames its bounds. */
export declare const getSectionedSceneRoot: () => ClippingGroup | null;
/**
 * Wraps the rendered scene in a WebGPU `ClippingGroup` (the node renderer has
 * no global `renderer.clippingPlanes`). The group is ALWAYS mounted and only
 * its `enabled` flag flips — toggling the wrapper itself would remount every
 * mesh in the scene.
 */
export declare function SectionPlaneGroup({ children }: {
    children?: ReactNode;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=section-plane.d.ts.map