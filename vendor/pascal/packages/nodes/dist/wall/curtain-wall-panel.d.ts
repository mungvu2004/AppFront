import { type CurtainWallConfig, type WallNode } from '@pascal-app/core';
type Props = {
    node: WallNode;
    height: number;
    unit: 'metric' | 'imperial';
    onUpdate: (patch: Partial<WallNode>) => void;
    onPreview: (patch: Partial<WallNode>) => void;
    onCommit: () => void;
    onCancel: () => void;
};
export declare function getCurtainWallUpdate(node: WallNode, patch: Partial<CurtainWallConfig>): Pick<WallNode, 'curtainWall'>;
export declare function CurtainWallPanel({ node, height, unit, onUpdate, onPreview, onCommit, onCancel, }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=curtain-wall-panel.d.ts.map