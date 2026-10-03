import { type AnyNode } from '@pascal-app/core';
export type FloorplanPreviewScene = {
    nodes: Record<string, AnyNode>;
    installedPlugins?: readonly string[];
};
export type FloorplanPreviewProps = {
    className?: string;
    compassHost?: Element | null;
    levelId?: string | null;
    navigationVisible?: boolean;
    onLevelChange?: (levelId: string) => void;
    scene?: FloorplanPreviewScene | null;
    showCompass?: boolean;
    showLevelSelector?: boolean;
    synchronizeNavigation?: boolean;
};
export declare function normalizeFloorplanPreviewNodes(nodes: Record<string, unknown>): Record<string, AnyNode>;
export declare function FloorplanPreview({ className, compassHost, levelId, navigationVisible, onLevelChange, scene, showCompass, showLevelSelector, synchronizeNavigation, }: FloorplanPreviewProps): import("react").JSX.Element;
//# sourceMappingURL=floorplan-preview.d.ts.map