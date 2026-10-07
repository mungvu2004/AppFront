import { type ViewerStageMode } from './viewer-stage-modes';
export type { ViewerStageMode } from './viewer-stage-modes';
export type ViewerStageSwitcherProps = {
    className?: string;
    hideSplitOnMobile?: boolean;
    mode: ViewerStageMode;
    modes?: readonly ViewerStageMode[];
    onChange: (mode: ViewerStageMode) => void;
};
export declare function ViewerStageSwitcher({ className, hideSplitOnMobile, mode, modes, onChange, }: ViewerStageSwitcherProps): import("react").JSX.Element;
//# sourceMappingURL=viewer-stage-switcher.d.ts.map