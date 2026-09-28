import { type WallNode } from '@pascal-app/core';
/**
 * Phase 5 Stage D — wall curve tool (kind-owned).
 *
 * 1:1 port of the legacy `CurveWallTool`. Same snap pipeline and
 * activation grace. History uses an idempotent lease because cancel and
 * effect cleanup can both release the active interaction.
 */
export declare const CurveWallTool: React.FC<{
    node: WallNode;
}>;
export default CurveWallTool;
//# sourceMappingURL=curve-tool.d.ts.map