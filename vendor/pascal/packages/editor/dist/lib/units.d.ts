import { type AnyNode, type AnyNodeId, type BuildingNode, type LevelNode, UnitNode, type ZoneNode } from '@pascal-app/core';
type Nodes = Readonly<Record<AnyNodeId, AnyNode>>;
export declare function focusedUnitNode(): UnitNode | null;
/** Levels carrying member zones, lowest ordinal first. */
export declare function unitMemberLevels(unit: UnitNode, nodes: Nodes): LevelNode[];
export declare function enterUnitFocus(unitId: UnitNode['id']): void;
/** Ends unit focus. Returns false when no unit was focused. */
export declare function leaveUnitFocus(options?: {
    keepLayer?: boolean;
}): boolean;
/**
 * Puts a zone in exactly one unit (or none): it leaves every other unit in the
 * same store update, so the move is one undo step.
 */
export declare function assignZoneToUnit(zoneId: ZoneNode['id'], unitId: UnitNode['id'] | null): void;
export declare function toggleZoneMembership(unitId: UnitNode['id'], zoneId: ZoneNode['id']): void;
/**
 * The zone under a point on the current level, in building-local XZ. A 3D
 * click lands on whatever surface is closest (a floor slab sits above the
 * zone fill), so painting resolves the zone from the hit point instead of the
 * hit mesh. Nested zones resolve to the smallest one.
 */
export declare function zoneAtLevelPoint(x: number, z: number): ZoneNode | null;
export declare function zoneAtWorldPoint(worldX: number, worldZ: number): ZoneNode | null;
export declare const ZONE_PAINT_DELAY_MS = 250;
/**
 * The canvas paint gesture. The toggle waits out the double-click window so
 * the second click of a double-click cancels it instead of toggling twice;
 * the double-click itself then selects the zone.
 */
export declare function paintZoneMembership(unitId: UnitNode['id'], zoneId: ZoneNode['id']): void;
export declare function cancelPendingZonePaint(zoneId: ZoneNode['id']): boolean;
export declare function createUnitInBuilding(buildingId: BuildingNode['id']): UnitNode['id'] | null;
/**
 * Keeps unit focus coherent with the rest of the editor: a focus set from
 * anywhere (the unit inspector calls the viewer store directly) gets the full
 * enter treatment, and focus ends when the user switches layer or phase by
 * hand, selects anything other than the focused unit, or the unit is deleted.
 */
export declare function useUnitFocusRules(): void;
export {};
//# sourceMappingURL=units.d.ts.map