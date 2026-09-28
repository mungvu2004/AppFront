import { type AssetInput, ItemNode, type SurfaceRejectReason } from '@pascal-app/core';
import type { Vector3 } from 'three';
export interface DraftNodeHandle {
    updateSurface: (data: Partial<ItemNode>, surfaceId: string | null) => void;
    /** Current draft item, or null */
    readonly current: ItemNode | null;
    /** Whether the current draft was adopted (move mode) vs created (create mode) */
    readonly isAdopted: boolean;
    /** Create a new draft item at the given position. Returns the created node or null.
     *  `slots` seeds painted slot overrides so duplicates keep their materials. */
    create: (gridPosition: Vector3, asset: AssetInput, rotation?: [number, number, number], scale?: [number, number, number], slots?: ItemNode['slots']) => ItemNode | null;
    /** Take ownership of an existing scene node as the draft (for move mode). */
    adopt: (node: ItemNode) => void;
    /** Commit the current draft. Create mode: delete+recreate. Move mode: update in place.
     *  `supportElevationCap` (floor commits) is the pointer-decided surface
     *  elevation — it caps the persisted `supportSlabId` election so the
     *  commit lands on the surface the cursor pointed at. */
    commit: (finalUpdate: Partial<ItemNode>, options?: {
        supportElevationCap?: number | null;
        preferredSupportSlabId?: string | null;
        onReject?: (reason: SurfaceRejectReason) => void;
        pinSupport?: boolean;
    }) => string | null;
    /** Destroy the current draft. Create mode: delete node. Move mode: restore original state. */
    destroy: () => void;
}
/**
 * Hook that manages the lifecycle of a transient (draft) item node.
 * Handles temporal pause/resume for undo/redo isolation.
 *
 * Supports two modes:
 * - Create mode (via `create()`): draft is a new transient node. Commit = delete+recreate (undo removes node).
 * - Move mode (via `adopt()`): draft is an existing node. Commit = update in place (undo reverts position).
 */
export declare function useDraftNode(): DraftNodeHandle;
//# sourceMappingURL=use-draft-node.d.ts.map