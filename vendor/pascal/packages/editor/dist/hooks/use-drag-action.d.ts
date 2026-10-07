import { type AnyNode, type AnyNodeId, type ChildQuery, type DragAction, type DragSessionInput, type Modifiers, type SpatialQuery } from '@pascal-app/core';
export type UseDragActionArgs<Ctx, Draft> = {
    /** When true the session is live: subscribes to grid events + Esc.
     * Flipping to false (or unmount) cancels and cleans up. */
    active: boolean;
    action: DragAction<Ctx, Draft>;
    /** Captured once at the moment `active` flips to true. */
    initial: DragSessionInput;
    /** Relations cascade plumbing. */
    spatialQuery?: SpatialQuery;
    childQuery?: ChildQuery;
    /** Fires once after `action.commit` returns true. */
    onCommit?: () => void;
    /** Fires once after `action.cancel` (Esc, unmount, or commit-returns-false). */
    onCancel?: () => void;
    /**
     * Milliseconds after activation during which `grid:click` is swallowed.
     * Stops the very click that mounted this tool (a DOM button or 3D
     * handle elsewhere) from cascading into the grid and immediately
     * committing the drag. Defaults to 150ms — matches the legacy guard
     * used by every kind-owned tool entered via a click.
     */
    activationGraceMs?: number;
};
/**
 * React hook wrapping the pure `createDragSession` orchestrator with the
 * editor's grid event emitter and an Esc-to-cancel keyboard binding.
 *
 * - Pauses scene history when active → resumes on commit/cancel/unmount
 * - Per `grid:move` runs preview + snap + apply and cascades dirty marks
 * - `grid:click` triggers commit; Escape triggers cancel
 *
 * For tests of the underlying behavior, drive `createDragSession` directly
 * (no React needed). This hook is the thin glue.
 */
export declare function useDragAction<Ctx, Draft>(args: UseDragActionArgs<Ctx, Draft>): void;
export type { AnyNode, AnyNodeId, DragAction, Modifiers };
//# sourceMappingURL=use-drag-action.d.ts.map