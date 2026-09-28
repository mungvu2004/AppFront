import { type AnyNode } from '@pascal-app/core';
/**
 * Read-only unit list shared by the editor preview and the published viewer.
 * Clicking a row focuses the unit and reveals a member floor through the shared
 * `useViewer.selection`; a second click clears the focus. Hidden without units.
 */
export declare function ViewerUnitsPanel({ nodes }: {
    nodes: Readonly<Record<string, AnyNode>>;
}): import("react").JSX.Element | null;
//# sourceMappingURL=viewer-units-panel.d.ts.map