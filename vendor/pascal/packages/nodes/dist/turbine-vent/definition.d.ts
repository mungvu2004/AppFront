import { type NodeDefinition } from '@pascal-app/core';
import { TurbineVentNode } from './schema';
/**
 * Turbine vent (whirlybird) — a wind-driven spinning exhaust vent that
 * sits on a roof slope. Parented to a `roof-segment`; position is
 * segment-local; rotation rotates the vent around the segment's vertical
 * axis after the slope tilt is applied.
 *
 * Composition (three-checkbox model):
 *  - **`renderer` (custom)** — like the box vent, the turbine needs the
 *    parent segment's transform + slope to position itself, which the
 *    registry-era roof-segment renderer doesn't auto-nest. The custom
 *    renderer reads the segment from `useScene`, applies the transform
 *    stack, and — uniquely among vents — drives the head's idle spin via
 *    `useFrame`. The spin lives in the renderer (not a `def.system`)
 *    because it's purely cosmetic: no cross-node cascade, no shared
 *    animation state, and it must not perturb the handle frame.
 *  - **no `geometry`** — geometry is created inside the renderer via the
 *    shared pure builders in `./geometry` (split base / head so the head
 *    can spin independently), matching box-vent's mount semantics.
 *  - **no `system`** — see above; the spin is renderer-local.
 */
export declare const turbineVentDefinition: NodeDefinition<typeof TurbineVentNode>;
//# sourceMappingURL=definition.d.ts.map