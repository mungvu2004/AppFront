import type { AnyNode, AnyNodeId, LevelNode, UnitNode, ZoneNode } from '../schema/index.js';
export type UnitReport = {
    memberCount: number;
    levelSpan: {
        minOrdinal: number;
        maxOrdinal: number;
        count: number;
    } | null;
    grossAreaM2: number;
    members: Array<{
        zoneId: ZoneNode['id'];
        name: string;
        levelId: LevelNode['id'] | null;
        levelOrdinal: number | null;
        areaM2: number;
    }>;
};
export declare function buildUnitReport(unit: UnitNode, nodes: Readonly<Record<AnyNodeId, AnyNode>>): UnitReport;
//# sourceMappingURL=unit-report.d.ts.map