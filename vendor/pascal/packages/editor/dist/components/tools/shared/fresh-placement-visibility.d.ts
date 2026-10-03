import { type AnyNode } from '@pascal-app/core';
type FreshPlacementNode = Pick<AnyNode, 'id' | 'metadata'>;
type FreshPlacementVisibilityArgs = {
    node: FreshPlacementNode;
    enabled?: boolean;
};
export declare function useFreshPlacementVisibility({ node, enabled, }: FreshPlacementVisibilityArgs): {
    isFreshPlacement: boolean;
    previewVisible: boolean;
    revealFreshPlacement: () => void;
    useAbsoluteCursorPlacement: boolean;
};
export {};
//# sourceMappingURL=fresh-placement-visibility.d.ts.map