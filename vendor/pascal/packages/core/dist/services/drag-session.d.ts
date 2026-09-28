import { type ChildQuery, type SpatialQuery } from '../registry/relations-resolver.js';
import type { DragAction, Modifiers, SceneApi } from '../registry/types.js';
import type { AnyNode } from '../schema/types.js';
import type { Vec2 } from './snap.js';
/**
 * Pure orchestrator for a single `DragAction` lifecycle:
 *   begin → (preview → snap? → apply → cascade dirty)* → commit | cancel
 *
 * Bracketed by `pauseHistory()` / `resumeHistory()` so the entire drag is one
 * undo step. The React hook (`useDragAction` in `@pascal-app/editor`) wraps
 * this with event subscriptions; tests drive it directly.
 */
export type DragSessionInput = {
    node?: AnyNode;
    point: Vec2;
    handleId?: string;
    modifiers?: Modifiers;
};
export type DragSessionOptions = {
    spatialQuery?: SpatialQuery;
    childQuery?: ChildQuery;
    /** Called once the session terminates via `commit()`. */
    onCommit?: () => void;
    /** Called once the session terminates via `cancel()` or `dispose()`. */
    onCancel?: () => void;
};
export type DragSession<Ctx, Draft> = {
    /** Begin the drag — pause history, capture ctx via `action.begin`. */
    start: (input: DragSessionInput) => void;
    /** Per-pointer-move tick — run preview/snap/apply and cascade dirty marks. */
    move: (point: Vec2, modifiers: Modifiers) => void;
    /** Pointer-up / discrete commit. Returns true if `action.commit` agreed. */
    commit: () => boolean;
    /** Pointer-cancel / Esc / external abort — restores all touched nodes. */
    cancel: () => void;
    /** Returns the latest draft `apply` produced (or null before first move). */
    getDraft: () => Draft | null;
    isActive: () => boolean;
    /** Idempotent cleanup. If active, restores scene state and resumes
     * history, but does **not** fire `onCancel`. Use for React-effect
     * teardown — onCancel would re-trigger the parent's state machine and
     * break StrictMode's double-mount cycle. Esc / external aborts must
     * still call `cancel()` directly. */
    dispose: () => void;
};
export declare function createDragSession<Ctx, Draft>(action: DragAction<Ctx, Draft>, scene: SceneApi, options?: DragSessionOptions): DragSession<Ctx, Draft>;
//# sourceMappingURL=drag-session.d.ts.map