/**
 * Stage E inspector for item. 1:1 port of the legacy
 * `editor/components/ui/panels/item-panel.tsx`, relocated into the
 * kind's folder so `parametrics.customPanel` mounts it through the
 * registry inspector. The catalog popover (`<CollectionsPopover>`) is
 * the only kind-specific UI that can't be expressed via the generic
 * auto-inspector today — kept inline.
 *
 * Slider-drag fix recipe applied: scale / position / rotation slider
 * `onChange` callbacks read from a `useRef(node)` instead of the
 * closure-captured node, which would re-render every panel-driven
 * update mid-drag and exceed React's update-depth budget on big scenes
 * (see the wiki / plan recipe).
 */
export default function ItemPanel(): import("react").JSX.Element | null;
//# sourceMappingURL=panel.d.ts.map