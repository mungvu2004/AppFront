import { type ReactNode } from 'react';
import { type CommandPaletteEmptyAction } from './../../../components/ui/command-palette';
import { type ExtraPanel } from './icon-rail';
import { type SettingsPanelProps } from './panels/settings-panel';
import { type SitePanelProps } from './panels/site-panel';
interface AppSidebarProps {
    appMenuButton?: ReactNode;
    sidebarTop?: ReactNode;
    settingsPanelProps?: SettingsPanelProps;
    sitePanelProps?: SitePanelProps;
    extraPanels?: ExtraPanel[];
    commandPaletteEmptyAction?: CommandPaletteEmptyAction;
}
export declare function AppSidebar({ appMenuButton, sidebarTop, settingsPanelProps, sitePanelProps, extraPanels: hostExtraPanels, commandPaletteEmptyAction, }: AppSidebarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=app-sidebar.d.ts.map