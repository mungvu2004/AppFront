import { type AnyNode } from '@pascal-app/core';
export interface FloorplanNodePreviewProps {
    node: AnyNode;
    parentNode?: AnyNode | null;
    contextNodes?: AnyNode[];
    opacity?: number;
    className?: string;
    selected?: boolean;
    highlighted?: boolean;
    hovered?: boolean;
    moving?: boolean;
}
/**
 * Stateless floor-plan ghost for an already-positioned node. Hosts can use
 * this to render host-owned placement previews without publishing transient
 * state into the editor's local placement-preview store.
 */
export declare const FloorplanNodePreview: import("react").MemoExoticComponent<({ node, parentNode, contextNodes: previewContextNodes, opacity, className, selected, highlighted, hovered, moving, }: FloorplanNodePreviewProps) => import("react").JSX.Element | null>;
/**
 * Renders a faint, non-interactive ghost of the node being placed by a
 * registry placement tool (e.g. column), following the cursor in the floor
 * plan. The 3D view shows a translucent mesh preview; in 2D that mesh is
 * hidden (canvas `display:none`), so without this the user only saw the grid
 * cursor dot + alignment guides — no sense of the footprint they were about
 * to drop. The placement tool publishes a transient, already-positioned +
 * aligned node to `usePlacementPreview`; we build its `def.floorplan`
 * footprint with active sibling, level-data, and theme context so kind-specific
 * shapes match the committed renderer.
 *
 * Mounted inside the floor-plan scene `<g>` so the geometry's level-local
 * meters get the same world→SVG transform every other entry does.
 */
export declare const FloorplanPlacementPreviewLayer: import("react").MemoExoticComponent<() => import("react").JSX.Element | null>;
//# sourceMappingURL=floorplan-placement-preview-layer.d.ts.map