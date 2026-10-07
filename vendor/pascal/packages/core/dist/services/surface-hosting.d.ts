import type { AnyNodeDefinition, SceneApi } from '../registry/types.js';
import type { AnyNode } from '../schema/types.js';
export type SurfaceId = string;
export interface SurfaceRegion {
    kind: 'rect' | 'polygon';
    /** Rectangle half-extents in the surface frame's XZ plane. */
    size?: readonly [number, number];
    center?: readonly [number, number];
    /** Counterclockwise boundary in the surface frame's XZ plane. */
    points?: readonly (readonly [number, number])[];
    holes?: readonly (readonly (readonly [number, number])[])[];
}
interface SurfaceFrame {
    label?: string;
    position: readonly [number, number, number];
    rotation?: readonly [number, number, number];
    normal: readonly [number, number, number];
    /** Defaults to true; the caller's snap function still controls whether the grid is active. */
    gridSnap?: boolean;
}
export type DeclaredHostSurface = SurfaceFrame & {
    id: SurfaceId;
    region: SurfaceRegion;
};
export type HostSurface = DeclaredHostSurface | (SurfaceFrame & {
    id: null;
    region?: never;
});
export interface SurfaceHit {
    point: readonly [number, number, number];
    normalWorldY: number;
    meshName?: string;
}
export interface SurfaceContext {
    scene: Pick<SceneApi, 'get' | 'nodes'>;
}
export interface SurfaceProvider {
    childFrame: 'host-local' | 'surface-local';
    surfaces?(host: AnyNode, ctx: SurfaceContext): readonly DeclaredHostSurface[];
    resolveHit(host: AnyNode, hit: SurfaceHit, ctx: SurfaceContext): HostSurface | null;
    accepts?(host: AnyNode, childKind: string, surface: HostSurface, ctx: SurfaceContext): boolean;
}
export type SurfaceRejectReason = 'host-not-eligible' | 'invalid-hit' | 'no-surface' | 'child-not-accepted' | 'footprint-outside-surface' | 'footprint-exceeds-host' | 'surface-cutout' | 'surface-occupied';
export type SurfacePlacement = {
    position: readonly [number, number, number];
    rotationY: number;
    surfaceId: SurfaceId | null;
    /** Movers write surfaceLocal for surface-local providers, otherwise the host-local pose. */
    childFrame: SurfaceProvider['childFrame'];
    /** Null exactly for hit-derived surfaces. Full XYZ rotation is needed on tilted surfaces. */
    surfaceLocal: {
        position: readonly [number, number, number];
        rotationY: number;
        rotation: readonly [number, number, number];
    } | null;
};
export declare const NON_PHYSICAL_HOST_KINDS: readonly string[];
export declare const hitDerivedSurfaceProvider: SurfaceProvider;
export declare const itemSurfaceProvider: SurfaceProvider;
export declare const shelfSurfaceProvider: SurfaceProvider;
export declare const proceduralItemSurfaceProvider: SurfaceProvider;
export declare function getSurfaceProvider(host: AnyNode): SurfaceProvider;
export declare function rendersHostedChildren(def: AnyNodeDefinition): boolean;
export declare function canHostSurfaceChild(host: AnyNode, childKind: string, childId?: string): boolean;
/** Hit and child rotation are host-local; bounds and dimensions are scaled child-local values. */
export declare function resolveSurfacePlacement(args: {
    host: AnyNode;
    surface?: HostSurface;
    childKind: string;
    childId?: string;
    childFootprint: {
        size: readonly [number, number, number];
        rotationY: number;
        /** Full host-local XYZ Euler rotation, when available; otherwise rotationY is used. */
        rotation?: readonly [number, number, number];
        localBounds?: {
            min: readonly [number, number, number];
            max: readonly [number, number, number];
        };
    };
    hit: SurfaceHit;
    /** Child origin after grab-offset correction; the hit still elects the actual support. */
    origin?: readonly [number, number, number];
    scene: SceneApi;
    /** Pure child-centered grid function; omitted means snapping is off. */
    snapScalar?: (position: number, dimension: number) => number;
    /** Defaults to true; drag previews may skip fit while still enforcing host and child eligibility. */
    checkFootprint?: boolean;
    onReject?: (reason: SurfaceRejectReason) => void;
}): SurfacePlacement | null;
export {};
//# sourceMappingURL=surface-hosting.d.ts.map