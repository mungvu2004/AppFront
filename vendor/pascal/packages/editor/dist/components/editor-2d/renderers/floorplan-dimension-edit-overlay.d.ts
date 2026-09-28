import type { AnyNodeId } from '@pascal-app/core';
import useEditor from '../../../store/use-editor';
/**
 * Click-to-type dimensions — WS3.
 *
 * Single-clicking a dimension label opens an inline input over the label
 * plate, pre-filled with the current text. Enter commits, Esc cancels.
 * Committing DRIVES geometry: the anchor the dimension runs toward moves
 * along the dimension direction by the delta, and connected wall junctions
 * follow (`planDimensionDrive`). When nothing bindable is under the far
 * anchor the value is written as `textOverride` on a construction-dimension
 * node instead, and the label renders an "override" badge.
 *
 * The label is found by DOM delegation on the attributes
 * `floorplan-dimension-renderer.tsx` emits, so this works identically for
 * `dimension` and `dimension-string` geometry, for automatic wall dimensions,
 * contextual dimensions and manual construction-dimension nodes — and on
 * sheets, which mount the same renderer.
 */
type EditGateEditorState = Pick<ReturnType<typeof useEditor.getState>, 'workspaceMode' | 'mode' | 'isPreviewMode' | 'isCaptureMode' | 'isFirstPersonMode'>;
/**
 * Typing a dimension moves geometry, so it is only offered on an editable
 * scene in idle select mode — never in studio, sheets, preview, capture or
 * read-only (which is how version preview locks the graph).
 */
export declare function isDimensionEditAllowed(editor: EditGateEditorState, scene: {
    readOnly: boolean;
}): boolean;
export declare function useDimensionEditAllowed(): boolean;
type EditTarget = {
    ownerNodeId: AnyNodeId;
    text: string;
    value: number;
    witnessStart: [number, number];
    witnessEnd: [number, number];
    rect: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
};
export declare function FloorplanDimensionEditOverlay(): React.ReactElement | null;
type CommitOutcome = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
/**
 * Apply a typed dimension value. Exported for tests — it is the seam between
 * the pure drive math and the scene store.
 */
export declare function commitDimensionValue(args: {
    target: Pick<EditTarget, 'ownerNodeId' | 'witnessStart' | 'witnessEnd' | 'value'>;
    nextLength: number;
    unit?: 'metric' | 'imperial';
}): CommitOutcome;
export {};
//# sourceMappingURL=floorplan-dimension-edit-overlay.d.ts.map