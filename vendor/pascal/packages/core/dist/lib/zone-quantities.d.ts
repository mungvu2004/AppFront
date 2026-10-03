import type { AnyNode, ZoneNode } from '../schema/index.js';
export type ZoneQuantityValue = {
    status: 'available';
    value: number;
    note?: string;
} | {
    status: 'unavailable';
    reason: string;
};
export type ZoneQuantityReport = {
    classification: 'footprint' | 'enclosed-room';
    footprintArea: number;
    perimeter: number;
    edgeLengths: number[];
    boundaryWallIds: string[];
    wallSurface: ZoneQuantityValue;
    floorSurface: ZoneQuantityValue;
    volume: ZoneQuantityValue;
};
export declare function deriveZoneQuantityReport(zone: ZoneNode, sceneNodes: Readonly<Record<string, AnyNode>>): ZoneQuantityReport;
//# sourceMappingURL=zone-quantities.d.ts.map