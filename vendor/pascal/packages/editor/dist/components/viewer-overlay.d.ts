type ProjectOwner = {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
};
interface ViewerOverlayProps {
    projectName?: string | null;
    owner?: ProjectOwner | null;
    canShowScans?: boolean;
    canShowGuides?: boolean;
    hideBottomBar?: boolean;
    onBack?: () => void;
}
export declare const ViewerOverlay: ({ projectName, owner, canShowScans, canShowGuides, hideBottomBar, onBack, }: ViewerOverlayProps) => import("react").JSX.Element;
export {};
//# sourceMappingURL=viewer-overlay.d.ts.map