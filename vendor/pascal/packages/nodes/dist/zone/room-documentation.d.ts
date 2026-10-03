import { type AnyNode, type ZoneNode } from '@pascal-app/core';
import type { FloorplanSchedule } from '@pascal-app/editor';
import { type ConstructionLengthProfile, type ConstructionLinearUnit } from '../shared/construction-length';
export declare function buildRoomFloorplanSchedule(args: {
    siblings: ReadonlyArray<ZoneNode>;
    nodes: Readonly<Record<string, AnyNode>>;
    levelId: string;
    unit: ConstructionLinearUnit;
    profile?: ConstructionLengthProfile;
}): FloorplanSchedule | null;
//# sourceMappingURL=room-documentation.d.ts.map