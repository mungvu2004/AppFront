import { type DownspoutNode } from '@pascal-app/core';
/**
 * Position-along-the-eave editor for a downspout. The downspout's spot
 * is owned by its outlet on the host gutter (`gutter.outlets[].offset`),
 * not by the downspout itself — so this slider reads + writes that
 * outlet on the gutter rather than patching the downspout.
 *
 * Mesh-first commit (same shape as the in-world handle drags):
 *  - `onChange` (live, every drag tick) publishes the new outlets to the
 *    gutter's `useLiveNodeOverrides`. The gutter renderer rebuilds its
 *    mesh from that override and the downspout renderer re-reads its
 *    outlet — both move immediately, with NO write to the scene store /
 *    history. The slider also reads the override back so its number
 *    tracks during the drag.
 *  - `onCommit` (on release) writes the final outlets to the store once
 *    (the single undoable change — `SliderControl` resumes history
 *    first) and drops the override so the renderers read the store again.
 *
 * Wired via `parametrics.fields[].kind: 'custom'`; hidden when the
 * downspout isn't linked to an outlet.
 */
export declare function DownspoutPositionEditor({ node }: {
    node: DownspoutNode;
}): import("react").JSX.Element | null;
//# sourceMappingURL=inspector-editors.d.ts.map