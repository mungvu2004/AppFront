import type { IconRef, LazyComponent } from '@pascal-app/core';
export type EditorHostPanelWorkspace = string & {};
export type EditorHostPanel = {
    id: string;
    label: string;
    icon: IconRef;
    component: LazyComponent;
    kinds?: readonly string[];
    workspaces?: readonly EditorHostPanelWorkspace[];
    pluginId?: string;
    description?: string;
    creator?: {
        name: string;
        url?: string;
    };
    pluginUrl?: string;
    defaultInstalled?: boolean;
    /** Short label shown next to the plugin name in the manager, e.g. "Pro". */
    badge?: string;
};
/**
 * A host-owned reason why a plugin cannot be installed right now (a plan the
 * account doesn't have, for instance). The manager swaps its Install button
 * for `actionLabel`; uninstalling is never locked.
 */
export type PluginInstallLock = {
    reason: string;
    actionLabel: string;
    onAction: () => void;
};
declare class EditorHostPanelRegistryImpl {
    private readonly panels;
    private readonly listeners;
    private cached;
    subscribe: (onChange: () => void) => (() => void);
    getSnapshot: () => EditorHostPanel[];
    panelForKind: (kind: string) => string | undefined;
    getDefaultInstalledPluginIds: () => string[];
    reset(): void;
    registerPanel(panel: EditorHostPanel): void;
    private emit;
}
export declare const editorHostPanelRegistry: EditorHostPanelRegistryImpl;
declare class PluginInstallLocksImpl {
    private locks;
    private readonly listeners;
    subscribe: (onChange: () => void) => (() => void);
    getSnapshot: () => Readonly<Record<string, PluginInstallLock>>;
    set(locks: Record<string, PluginInstallLock>): void;
}
export declare const pluginInstallLocks: PluginInstallLocksImpl;
/** Replaces every install lock, keyed by `pluginId`. Pass `{}` to clear. */
export declare function setPluginInstallLocks(locks: Record<string, PluginInstallLock>): void;
export declare function registerEditorHostPanel(panel: EditorHostPanel): void;
/**
 * The distinct plugins the manager can act on — every registered panel that
 * declares a `pluginId`, deduplicated, because one plugin may contribute
 * several panels and the manager lists plugins, not panels.
 *
 * Registration is what makes a plugin *manageable*, not installation: an
 * uninstalled plugin still has to appear so it can be installed.
 */
export declare function managedPluginIds(panels: readonly EditorHostPanel[]): string[];
/**
 * Does the plugin *manager* tab belong in the rail?
 *
 * It is a management surface — it installs and uninstalls plugins into the
 * scene — so it earns a slot when there is something to manage, or when the
 * scene is writable and the "create a plugin" path is still worth offering to
 * whoever owns it.
 *
 * That leaves exactly one case out, and it is a real screen rather than a
 * hypothetical: the open lobby (`/play/<id>`) mounts the editor under a
 * read-only lease and registers NO host panels, so the manager was the only
 * tab in the rail. The rail therefore opened by default onto a "Plugins"
 * heading with nothing under it, covering roughly 40% of a visitor's window
 * over the world they had come to play in (owner report 2026-08-31). With no
 * tabs at all the v2 layout drops the whole left column, which is the lobby as
 * intended: the canvas, and nothing else.
 *
 * A read-only *editor* keeps the tab as long as plugins are registered — a
 * viewer can still read what a project uses; only the install button is
 * disabled. So this hides an empty panel, never a populated one.
 */
export declare function showsPluginManager({ managedPluginCount, readOnly, workspaceMode, }: {
    managedPluginCount: number;
    readOnly: boolean;
    workspaceMode: string;
}): boolean;
export {};
//# sourceMappingURL=plugin-panels.d.ts.map