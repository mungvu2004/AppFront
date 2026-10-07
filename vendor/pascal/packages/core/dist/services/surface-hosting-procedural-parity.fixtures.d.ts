import type { resolveSurfacePlacement, SurfacePlacement, SurfaceRejectReason } from './surface-hosting.js';
type PlacementArgs = Parameters<typeof resolveSurfacePlacement>[0];
type ProceduralFixture = {
    label: string;
    host: unknown;
    rows: (Pick<PlacementArgs, 'childKind' | 'childFootprint' | 'hit' | 'checkFootprint'> & {
        expected: SurfacePlacement | null;
        rejections: SurfaceRejectReason[];
    })[];
};
export declare const frozenProceduralParity: ProceduralFixture[];
export {};
//# sourceMappingURL=surface-hosting-procedural-parity.fixtures.d.ts.map