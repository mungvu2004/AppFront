import type { ReactNode } from 'react';
import { type FloorplanPreviewScene } from './floorplan-preview';
import { type ViewerStageMode } from './viewer-stage-modes';
export type ViewerStageProps = {
    children?: ReactNode;
    className?: string;
    collapseSplitOnMobile?: boolean;
    compassHost?: Element | null;
    defaultMode?: ViewerStageMode;
    floorplanClassName?: string;
    levelId?: string | null;
    mode?: ViewerStageMode;
    modes?: readonly ViewerStageMode[];
    onLevelChange?: (levelId: string) => void;
    onModeChange?: (mode: ViewerStageMode) => void;
    scene?: FloorplanPreviewScene | null;
    showCompass?: boolean;
    showLevelSelector?: boolean;
    showSwitcher?: boolean;
    switcherClassName?: string;
    synchronizeNavigation?: boolean;
    threeDClassName?: string;
};
export declare function ViewerStage({ children, className, collapseSplitOnMobile, compassHost, defaultMode, floorplanClassName, levelId, mode: controlledMode, modes, onLevelChange, onModeChange, scene, showCompass, showLevelSelector, showSwitcher, switcherClassName, synchronizeNavigation, threeDClassName, }: ViewerStageProps): import("react").JSX.Element;
//# sourceMappingURL=viewer-stage.d.ts.map