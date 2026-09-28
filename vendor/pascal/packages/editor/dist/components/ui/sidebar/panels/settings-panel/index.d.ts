export interface ProjectVisibility {
    isPrivate: boolean;
    showScansPublic: boolean;
    showGuidesPublic: boolean;
}
export interface SettingsPanelProps {
    /** Merged onto the scrolling root so hosts can restyle padding (e.g. inside a dialog). */
    className?: string;
    projectId?: string;
    /** Shown as the scene name in apps the scene is sent to (Blender collection name). */
    projectName?: string;
    projectVisibility?: ProjectVisibility;
    onVisibilityChange?: (field: 'isPrivate' | 'showScansPublic' | 'showGuidesPublic', value: boolean) => Promise<void>;
}
export declare function SettingsPanel({ className, projectId, projectName, projectVisibility, onVisibilityChange, }?: SettingsPanelProps): import("react").JSX.Element;
//# sourceMappingURL=index.d.ts.map