import { type CabinetModuleNode as CabinetModuleNodeType, type FloorplanMoveTarget } from '@pascal-app/core';
/**
 * 2D floor-plan move for a cabinet module — the parity twin of the 3D
 * `movable.parentFrame` path. A module's `position` is run-local (rotated
 * frame), so the generic overlay translate — which writes plan-space
 * coordinates — teleports modules of any rotated / offset run and skips
 * sibling edge-mating. Each tick: grid-snap the cursor in plan frame,
 * convert through `planToLocal`, magnet against sibling modules, write the
 * local position, and bump the run's layout revision so spans / countertop
 * re-flow live (module position is not in the run's geometryKey). History is
 * paused by the overlay; its snapshot-diff commit makes the drag one undo
 * step covering both the module and the run metadata.
 */
export declare const cabinetModuleFloorplanMoveTarget: FloorplanMoveTarget<CabinetModuleNodeType>;
//# sourceMappingURL=floorplan-move.d.ts.map