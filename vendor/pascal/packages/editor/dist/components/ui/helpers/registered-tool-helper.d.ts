import type { ToolHint } from '@pascal-app/core';
import type { ContinuationContext } from '../../../lib/continuation';
import type { SnapContext } from '../../../lib/snapping-mode';
/**
 * Generic helper panel rendered from `def.toolHints` data. Matches the
 * visual styling of the hand-written `<WallHelper>` / `<ItemHelper>` /
 * etc. so registry-driven kinds get a consistent look without each kind
 * writing its own component.
 *
 * Drops the need for per-kind helper files entirely — kinds declare
 * their hints as static data in their `NodeDefinition`.
 */
export declare function RegisteredToolHelper({ hints, shiftPressed, snapContext, continuationContext, }: {
    hints: ToolHint[];
    shiftPressed?: boolean;
    snapContext?: SnapContext | null;
    continuationContext?: ContinuationContext | null;
}): import("react").JSX.Element | null;
//# sourceMappingURL=registered-tool-helper.d.ts.map