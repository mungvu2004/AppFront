import { type FenceNode } from '@pascal-app/core';
/**
 * Phase 5 Stage D — fence curve tool (kind-owned).
 *
 * 1:1 port of the legacy `CurveFenceTool` (editor/components/tools/
 * fence/curve-fence-tool.tsx). Same snap pipeline, same history dance,
 * same activation grace. Imports adjusted to the
 * `@pascal-app/editor` public surface (triggerSFX, markToolCancelConsumed,
 * getSegmentGridStep, snapScalarToGrid). Mounted via
 * `def.affordanceTools.curve` — ToolManager picks it up at runtime,
 * legacy fallback is unused when this kind is registered.
 */
export declare const CurveFenceTool: React.FC<{
    node: FenceNode;
}>;
export default CurveFenceTool;
//# sourceMappingURL=curve-tool.d.ts.map