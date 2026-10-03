import { type AnyNode, type AnyNodeId } from '@pascal-app/core';
type Pose = {
    position: [number, number, number];
    rotation: [number, number, number];
};
export declare function surfaceAttachmentId(node: Pick<AnyNode, 'id' | 'parentId'>): string | null;
export declare function surfaceAttachmentUpdates(id: AnyNodeId, parentId: string | null | undefined, surfaceId: string | null): {
    id: AnyNodeId;
    data: Partial<AnyNode>;
}[];
export declare function updateSurfaceNode(id: AnyNodeId, data: Partial<AnyNode>, surfaceId?: string | null): void;
export declare function surfaceFramePose(parentId: string | null | undefined, surfaceId: string | null, pose: Pose, toStorage: boolean): Pose;
export {};
//# sourceMappingURL=surface-attachment.d.ts.map