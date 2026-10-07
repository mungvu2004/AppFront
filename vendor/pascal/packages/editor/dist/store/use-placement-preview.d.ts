import type { AnyNode } from '@pascal-app/core';
export type PlacementPreviewDimension = {
    id: string;
    start: [number, number, number];
    end: [number, number, number];
    offsetNormal: [number, number];
    offsetDistance: number;
    value: number;
    renderIn3d?: boolean;
    renderInFloorplan?: boolean;
};
type PlacementPreviewState = {
    /** Transient preview node, already positioned + rotated at the (snapped,
     *  aligned) cursor. `null` when no placement is active. */
    node: AnyNode | null;
    contextNodes: AnyNode[];
    /** Optional synthetic parent for the preview's `def.floorplan` context.
     *  Door / window glyph builders need `ctx.parent` to be a wall to draw their
     *  real symbol (swing arc / panes); off any real wall we hand them a
     *  synthetic wall segment centred at the cursor so the floating ghost shows
     *  the faithful blueprint symbol instead of a bare rectangle. `null` for
     *  self-contained kinds (column / elevator). */
    parentNode: AnyNode | null;
    dimensions: PlacementPreviewDimension[];
    activeDimensionId: string | null;
    dimensionInput: string;
    set(node: AnyNode | null, parentNode?: AnyNode | null, dimensions?: PlacementPreviewDimension[], contextNodes?: AnyNode[]): void;
    selectDimension(id: string | null): void;
    setDimensionInput(value: string): void;
    clearDimensionEditor(): void;
    clear(): void;
};
declare const usePlacementPreview: import("zustand").UseBoundStore<import("zustand").StoreApi<PlacementPreviewState>>;
export default usePlacementPreview;
//# sourceMappingURL=use-placement-preview.d.ts.map