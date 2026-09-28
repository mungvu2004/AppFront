import { type ReactNode } from 'react';
interface MobilePanelSheetProps {
    open: boolean;
    onClose: () => void;
    icon?: string;
    title: string;
    children: ReactNode;
}
export declare function MobilePanelSheet({ open, onClose, icon, title, children }: MobilePanelSheetProps): import("react").ReactPortal | null;
export {};
//# sourceMappingURL=mobile-panel-sheet.d.ts.map