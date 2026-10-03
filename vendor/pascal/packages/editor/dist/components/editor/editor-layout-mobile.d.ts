import { type ReactNode } from 'react';
import type { SidebarTab } from '../ui/sidebar/tab-bar';
export interface EditorLayoutMobileProps {
    navbarSlot?: ReactNode;
    sidebarTabs?: SidebarTab[];
    renderTabContent: (tabId: string) => ReactNode;
    sidebarOverlay?: ReactNode;
    viewerToolbarLeft?: ReactNode;
    viewerToolbarRight?: ReactNode;
    viewerContent: ReactNode;
    overlays?: ReactNode;
}
export declare function EditorLayoutMobile({ navbarSlot, sidebarTabs, renderTabContent, sidebarOverlay, viewerToolbarLeft, viewerToolbarRight, viewerContent, overlays, }: EditorLayoutMobileProps): import("react").JSX.Element;
//# sourceMappingURL=editor-layout-mobile.d.ts.map