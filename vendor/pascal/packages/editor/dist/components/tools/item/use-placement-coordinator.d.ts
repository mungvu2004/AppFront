import type { AssetInput, ItemNode } from '@pascal-app/core';
import { Vector3 } from 'three';
import type { PlacementState } from './placement-types';
import type { DraftNodeHandle } from './use-draft-node';
export interface PlacementCoordinatorConfig {
    asset: AssetInput | null;
    draftNode: DraftNodeHandle;
    initDraft: (gridPosition: Vector3) => void;
    onCommitted: () => boolean;
    onCancel?: () => void;
    initialState?: PlacementState;
    /** Scale to use when lazily creating a draft (e.g. for wall/ceiling duplicates). Defaults to [1,1,1]. */
    defaultScale?: [number, number, number];
    /** Painted slot overrides to seed onto a lazily-created draft (wall/ceiling
     *  duplicates) so the duplicate keeps its materials. */
    slots?: ItemNode['slots'];
    /** Move-mode sessions keep the grabbed item offset from the first surface hit
     *  (floor / wall / ceiling / item-surface / shelf) instead of snapping the
     *  item's origin under the cursor. */
    preserveDragOffset?: boolean;
}
export declare function usePlacementCoordinator(config: PlacementCoordinatorConfig): React.ReactNode;
//# sourceMappingURL=use-placement-coordinator.d.ts.map