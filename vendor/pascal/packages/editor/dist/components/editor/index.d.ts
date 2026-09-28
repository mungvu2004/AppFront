import { type ViewerImmersiveSession } from '@pascal-app/viewer';
import { type ReactNode } from 'react';
import { type SaveStatus } from '../../hooks/use-auto-save';
import { type SceneGraph } from '../../lib/scene';
import { type CommandPaletteEmptyAction } from '../ui/command-palette';
import type { ExtraPanel } from '../ui/sidebar/icon-rail';
import { type SettingsPanelProps } from '../ui/sidebar/panels/settings-panel';
import { type SitePanelProps } from '../ui/sidebar/panels/site-panel';
import type { SidebarTab } from '../ui/sidebar/tab-bar';
import { type SnapshotCameraData } from './thumbnail-generator';
export interface EditorProps {
    layoutVersion?: 'v1' | 'v2';
    appMenuButton?: ReactNode;
    sidebarTop?: ReactNode;
    navbarSlot?: ReactNode;
    sidebarTabs?: (SidebarTab & {
        component: React.ComponentType;
    })[];
    viewerToolbarLeft?: ReactNode;
    viewerToolbarRight?: ReactNode;
    /**
     * Full-bleed surface swapped in over the 3D canvas (v2) — e.g. the studio
     * gallery. The canvas stays mounted underneath (no WebGL re-init) and the
     * viewer toolbar stays on top so the host's stage switch remains reachable.
     */
    stageOverlay?: ReactNode;
    /**
     * Docked below the node inspector (v2). Hosts mount the "save as preset"
     * affordance here so it reads as part of the inspector surface and shows
     * only while a node is selected.
     */
    inspectorFooter?: ReactNode;
    /**
     * Docked below the multi-selection panel (v2). Hosts mount whole-selection
     * affordances here (e.g. "Save to my catalog"); shows only while more than
     * one node is selected.
     */
    multiSelectionFooter?: ReactNode;
    /** Host-owned content mounted inside the editor's React Three Fiber scene. */
    viewerSceneSlot?: ReactNode;
    /** Host-owned SVG content mounted in the transformed floor-plan scene. */
    floorplanSceneSlot?: ReactNode;
    projectId?: string | null;
    guardAgainstSceneWipe?: boolean;
    onLoad?: () => Promise<SceneGraph | null>;
    onSave?: (scene: SceneGraph, options?: {
        keepalive?: boolean;
    }) => Promise<void>;
    /**
     * Cmd/Ctrl+S. Return true when the host handled the save (the community
     * version checkpoint); anything else falls through to flushing the autosave,
     * so the chord still saves when the host's control isn't mounted.
     */
    onSaveShortcut?: () => boolean | undefined;
    onDirty?: () => void;
    onSaveStatusChange?: (status: SaveStatus) => void;
    previewScene?: SceneGraph;
    isVersionPreviewMode?: boolean;
    isLoading?: boolean;
    onLoaderChange?: (visible: boolean) => void;
    onThumbnailCapture?: (blob: Blob, cameraData: SnapshotCameraData) => void;
    /**
     * When true, skip the viewer post-FX pipeline (same as `?disable=postFx`).
     * Hosts use this for a stable local "light preview" without relying only on
     * module-load URL flags or shading toggles.
     */
    disablePostFx?: boolean;
    /** Host-provided immersive XR runtime for the main 3D canvas. */
    immersive?: ViewerImmersiveSession;
    sidebarOverlay?: ReactNode;
    viewerBanner?: ReactNode;
    settingsPanelProps?: SettingsPanelProps;
    sitePanelProps?: SitePanelProps;
    extraSidebarPanels?: ExtraPanel[];
    commandPaletteEmptyAction?: CommandPaletteEmptyAction;
}
export default function Editor(props: EditorProps): import("react").JSX.Element;
//# sourceMappingURL=index.d.ts.map