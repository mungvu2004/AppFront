import { type AnyNode, type AnyNodeId, type ParametricDescriptor } from '@pascal-app/core';
export type ReducedFieldValue<T = unknown> = {
    kind: 'same';
    value: T;
} | {
    kind: 'mixed';
};
export declare function reduceFieldValue(nodeIds: readonly string[], key: string, nodes: Readonly<Record<string, AnyNode | undefined>>): ReducedFieldValue;
export type HeightBoundMode = 'storey' | 'custom';
export declare function reduceHeightBoundMode(nodeIds: readonly string[], nodes: Readonly<Record<string, AnyNode | undefined>>): ReducedFieldValue<HeightBoundMode>;
export declare function fieldVisibleForAll(nodeIds: readonly string[], visibleIf: ((node: AnyNode) => boolean) | undefined, nodes: Readonly<Record<string, AnyNode | undefined>>): boolean;
export declare function firstNumericFieldValue(nodeIds: readonly string[], key: string, nodes: Readonly<Record<string, AnyNode | undefined>>, fallback?: number): number;
export declare function firstVec3FieldValue(nodeIds: readonly string[], key: string, nodes: Readonly<Record<string, AnyNode | undefined>>): [number, number, number];
export declare function buildMultiNodePatches(nodeIds: readonly AnyNodeId[], patchFor: (node: AnyNode) => Partial<AnyNode>, nodes: Readonly<Record<string, AnyNode | undefined>>, parametrics?: Pick<ParametricDescriptor<AnyNode>, 'derive' | 'reconcile'>): Array<{
    id: AnyNodeId;
    data: Partial<AnyNode>;
}>;
export declare function previewMultiNodeFields(entries: ReadonlyArray<readonly [AnyNodeId, Partial<AnyNode>]>): void;
export declare function commitMultiNodeFields(nodeIds: readonly AnyNodeId[], patchFor: (node: AnyNode) => Partial<AnyNode>, parametrics?: Pick<ParametricDescriptor<AnyNode>, 'derive' | 'reconcile'>): void;
//# sourceMappingURL=multi-field-value.d.ts.map