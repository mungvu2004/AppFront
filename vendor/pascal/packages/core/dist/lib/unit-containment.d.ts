import type { AnyNode, AnyNodeId, BuildingNode, LevelNode, UnitNode, WallNode, ZoneNode } from '../schema/index.js';
export type UnitDerivation = {
    unitId: UnitNode['id'];
    memberZoneIds: ZoneNode['id'][];
    levelIds: LevelNode['id'][];
    containedNodeIds: AnyNodeId[];
    boundaryWallIds: WallNode['id'][];
    supportIds: AnyNodeId[];
    visibleNodeIds: AnyNodeId[];
};
type Nodes = Readonly<Record<AnyNodeId, AnyNode>>;
export declare function deriveUnit(unit: UnitNode, nodes: Nodes): UnitDerivation;
export declare function unitsForZone(zoneId: ZoneNode['id'], nodes: Nodes): UnitNode[];
export declare function unassignedZoneIds(buildingId: BuildingNode['id'], nodes: Nodes): ZoneNode['id'][];
export declare function unitWarnings(unit: UnitNode, nodes: Nodes): Array<{
    code: 'empty' | 'non-adjacent-levels';
}>;
export {};
//# sourceMappingURL=unit-containment.d.ts.map