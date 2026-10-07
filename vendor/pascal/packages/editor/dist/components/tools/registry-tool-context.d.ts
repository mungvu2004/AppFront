import type { AnyNodeId, LevelNode, SceneApi } from '@pascal-app/core';
import { type ReactNode } from 'react';
export type RegistryToolContextValue = {
    activeLevelId: LevelNode['id'] | null;
    isCameraDragging: () => boolean;
    sceneApi: SceneApi;
    selectNode: (nodeId: AnyNodeId) => void;
    unit: 'metric' | 'imperial';
};
export declare function RegistryToolProvider({ children, value, }: {
    children: ReactNode;
    value: RegistryToolContextValue;
}): import("react").JSX.Element;
export declare function useRegistryToolContext(): RegistryToolContextValue;
//# sourceMappingURL=registry-tool-context.d.ts.map