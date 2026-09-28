import type { ReactNode } from 'react';
export type SidebarTab = {
    id: string;
    label: string;
    mobileDefaultSnap?: number;
    mobileIcon?: ReactNode;
    /** Desktop icon shown in the vertical rail (v2 layout). */
    icon?: ReactNode;
    /**
     * Rail entry that drives the stage instead of opening a sidebar panel:
     * activating it hides the panel column (preserving its collapse state) and
     * keeps the icon highlighted regardless of collapse.
     */
    noPanel?: boolean;
};
interface TabBarProps {
    tabs: SidebarTab[];
    activeTab: string;
    onTabChange: (id: string) => void;
}
export declare function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): import("react").JSX.Element;
interface IconRailProps {
    tabs: SidebarTab[];
    /** Highlighted tab. Stays highlighted while the panel is collapsed. */
    activeTab: string;
    /** True when the panel beside the rail is collapsed. */
    collapsed: boolean;
    /** Clicking a rail icon: switch tab, or toggle the panel (see layout). */
    onIconClick: (id: string) => void;
}
/**
 * Vertical icon rail for the v2 left column. Always visible (even when the
 * panel is collapsed) so the user can reopen the panel by clicking an icon.
 * The label renders as a hover tooltip on the right.
 */
export declare function IconRail({ tabs, activeTab, collapsed, onIconClick }: IconRailProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=tab-bar.d.ts.map