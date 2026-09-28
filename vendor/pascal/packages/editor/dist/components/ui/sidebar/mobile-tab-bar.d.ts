import type { SidebarTab } from './tab-bar';
interface MobileTabBarProps {
    tabs: SidebarTab[];
    activeTab: string;
    onTabPress: (id: string) => void;
}
export declare function MobileTabBar({ tabs, activeTab, onTabPress }: MobileTabBarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=mobile-tab-bar.d.ts.map