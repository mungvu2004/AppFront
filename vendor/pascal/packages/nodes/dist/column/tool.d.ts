/**
 * Registry-driven column placement tool. Mirrors the shelf build tool:
 * a translucent `ColumnPreview` ghost follows the cursor (the piece the
 * legacy editor-side `ColumnTool` lacked — it only showed a sphere), grid
 * snap is layered with Figma-style alignment, and a `grid:click` commits.
 *
 * Lives in `packages/nodes` (not the editor) specifically so it can import
 * the column geometry for the ghost — the editor package can't depend on
 * `nodes`. Wired via `def.tool`, so `ToolManager`'s registry-first path
 * mounts it and the legacy `<ColumnTool>` branch no longer fires.
 */
declare const ColumnTool: () => import("react").JSX.Element | null;
export default ColumnTool;
//# sourceMappingURL=tool.d.ts.map