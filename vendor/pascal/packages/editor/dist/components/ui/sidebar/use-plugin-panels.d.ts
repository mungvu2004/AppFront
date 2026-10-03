import type { ExtraPanel } from './icon-rail';
/**
 * Merge host-registered panels (from the observable {@link editorHostPanelRegistry})
 * with the host's `extraPanels`, returning the combined list the icon rail and
 * panel-content area render. Host panels keep their leading order and win on id
 * collisions. Subscribes to the registry so a panel that registers after the
 * first render makes the rail re-render.
 *
 * Panels are filtered by the current workspace: a panel surfaces only in the
 * workspaces it declares (`EditorHostPanel.workspaces`, default `['edit']`), so an
 * authoring panel like Nature doesn't ride into the studio rail.
 */
export declare function useHostPanels(hostPanels?: ExtraPanel[]): ExtraPanel[];
//# sourceMappingURL=use-plugin-panels.d.ts.map