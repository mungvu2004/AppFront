import { type ReactNode } from 'react';
import { type SidebarTab } from '../ui/sidebar/tab-bar';
export interface EditorLayoutV2Props {
    navbarSlot?: ReactNode;
    sidebarTabs?: SidebarTab[];
    renderTabContent: (tabId: string) => ReactNode;
    sidebarOverlay?: ReactNode;
    viewerToolbarLeft?: ReactNode;
    viewerToolbarRight?: ReactNode;
    viewerContent: ReactNode;
    overlays?: ReactNode;
    stageOverlay?: ReactNode;
}
export declare function EditorLayoutV2({ navbarSlot, sidebarTabs, renderTabContent, sidebarOverlay, viewerToolbarLeft, viewerToolbarRight, viewerContent, overlays, stageOverlay, }: EditorLayoutV2Props): import("react").JSX.Element;
//# sourceMappingURL=editor-layout-v2.d.ts.map