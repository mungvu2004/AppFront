import { type AnyNodeId, type RoofNode, type RoofSegmentNode } from '@pascal-app/core';
type DuplicateRoofMode = 'select' | 'move';
type DuplicateRoofOptions = {
    mode?: DuplicateRoofMode;
    offset?: [number, number, number];
    parentId?: AnyNodeId;
};
type DuplicateRoofResult = {
    roof: RoofNode;
    segmentIds: RoofSegmentNode['id'][];
};
export declare function duplicateRoofSubtree(sourceRoofId: AnyNodeId, options?: DuplicateRoofOptions): DuplicateRoofResult;
export declare function clearRoofDuplicateMetadata(roofId: AnyNodeId, updates?: Partial<Pick<RoofNode, 'position' | 'rotation' | 'metadata' | 'visible'>>): void;
export {};
//# sourceMappingURL=roof-duplication.d.ts.map