import { type AnyNode, type AnyNodeDefinition, type GridEvent } from '@pascal-app/core';
import type { InteractionScope } from './scope';
type RegisteredDraftingConfig = NonNullable<AnyNodeDefinition['drafting']>;
type SurfaceHit = NonNullable<GridEvent['surfaceHit']>;
export declare const DRAFTING_SURFACE_EXTENSION_KEY = "pascal:editor/drafting-surface";
export type DraftingSurfaceExtension = {
    kind: SurfaceHit['kind'];
    raycast?: 'underside';
    classifyFace?: (node: AnyNode | undefined, localNormal: readonly [number, number, number]) => Pick<SurfaceHit, 'face' | 'side'> | null;
};
export declare function registeredDraftingConfig(scope: InteractionScope): RegisteredDraftingConfig | null;
export declare function registeredDraftingSurface(definition: AnyNodeDefinition): DraftingSurfaceExtension | null;
export {};
//# sourceMappingURL=registered-drafting.d.ts.map