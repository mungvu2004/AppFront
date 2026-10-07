import type { ComponentType, ReactNode } from 'react';
export type PanelId = string;
export type ExtraPanel = {
    id: string;
    icon: ReactNode;
    label: string;
    component: ComponentType;
    pluginId?: string;
};
interface IconRailProps {
    activePanel: PanelId;
    onPanelChange: (panel: PanelId) => void;
    appMenuButton?: ReactNode;
    extraPanels?: ExtraPanel[];
    className?: string;
}
declare const panels: {
    id: PanelId;
    iconSrc: string;
    label: string;
}[];
export declare function IconRail({ activePanel, onPanelChange, appMenuButton, extraPanels, className, }: IconRailProps): import("react").JSX.Element;
export { panels };
//# sourceMappingURL=icon-rail.d.ts.map