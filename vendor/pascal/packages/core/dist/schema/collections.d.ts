import type { AnyNodeId } from './types.js';
export type CollectionId = `collection_${string}`;
export type Collection = {
    id: CollectionId;
    name: string;
    color?: string;
    nodeIds: AnyNodeId[];
    controlNodeId?: AnyNodeId;
};
export declare const generateCollectionId: () => CollectionId;
//# sourceMappingURL=collections.d.ts.map