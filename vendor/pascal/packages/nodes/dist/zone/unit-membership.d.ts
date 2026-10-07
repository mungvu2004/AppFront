import type { AnyNode, AnyNodeId, UnitNode, ZoneNode } from '@pascal-app/core';
type ResolveNode = (id: AnyNodeId) => AnyNode | undefined;
/**
 * Units under the building that owns this zone's level. Units are building
 * children, so this walks that short list instead of scanning every node
 * the way `unitsForZone` does — cheap enough for per-zone store selectors.
 */
export declare function buildingUnitsForZone(zone: Pick<ZoneNode, 'parentId'>, resolve: ResolveNode): UnitNode[];
/** The unit whose colour and name a member zone wears: the first one listing it. */
export declare function owningUnitForZone(zone: Pick<ZoneNode, 'id' | 'parentId'>, resolve: ResolveNode): UnitNode | null;
export {};
//# sourceMappingURL=unit-membership.d.ts.map