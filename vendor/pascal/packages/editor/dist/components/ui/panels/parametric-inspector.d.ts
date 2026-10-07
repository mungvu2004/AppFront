import { type AnyNodeId } from '@pascal-app/core';
/**
 * Auto-derived right-panel inspector for any registry-backed node.
 *
 * Reads `definition.parametrics` from the registry and renders one
 * `<PanelSection>` per group, one control per field. Field kinds supported:
 * - `number` → SliderControl with min/max/step/unit from the descriptor
 * - `enum`   → dark-themed `<select>`
 * - `color`  → native color picker + hex input
 * - `vec3`   → three SliderControls for X / Y / Z
 *
 * Generic Actions section appends Move / Delete based on `capabilities`.
 *
 * Phase 4 will expand this with per-field `customEditor` support and a
 * `parametrics.customPanel?` escape hatch for kinds whose parametric editor
 * can't be auto-generated (topology editors etc.).
 */
export declare function ParametricInspector({ footer, nodeId, onClose, }?: {
    footer?: React.ReactNode;
    nodeId?: AnyNodeId;
    onClose?: () => void;
}): import("react").JSX.Element | null;
//# sourceMappingURL=parametric-inspector.d.ts.map