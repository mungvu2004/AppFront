/**
 * Inspector panel for a placed box-vent. Exposes the same parametrics
 * as the auto-derived inspector (style + dimensions) plus Move /
 * Duplicate / Delete actions wired into the same ghost-preview drag
 * flow the placement tool uses.
 *
 * Move sets the vent as `editor.movingNode` — the registered move
 * affordance tool (see `./move-tool.tsx`) takes over from there.
 * Duplicate inserts a fresh clone into the scene (marked `isNew` so a
 * cancelled drag deletes it), then routes the same way. On click the
 * ghost commits; on Esc it cancels and the original mesh is restored.
 */
export default function BoxVentPanel(): import("react").JSX.Element | null;
//# sourceMappingURL=panel.d.ts.map