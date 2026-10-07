import type { MouseEventHandler, PointerEventHandler } from 'react';
type NodeActionMenuProps = {
    onFind?: MouseEventHandler<HTMLButtonElement>;
    onAddHole?: MouseEventHandler<HTMLButtonElement>;
    onDelete?: MouseEventHandler<HTMLButtonElement>;
    onDuplicate?: MouseEventHandler<HTMLButtonElement>;
    onMove?: MouseEventHandler<HTMLButtonElement>;
    onEditMesh?: MouseEventHandler<HTMLButtonElement>;
    onCurve?: MouseEventHandler<HTMLButtonElement>;
    /** Session group (Ctrl/Cmd+G) — multi-selection floating pill. */
    onGroup?: MouseEventHandler<HTMLButtonElement>;
    /** Dissolve session group (Ctrl/Cmd+Shift+G). */
    onUngroup?: MouseEventHandler<HTMLButtonElement>;
    onPointerDown?: PointerEventHandler<HTMLDivElement>;
    onPointerUp?: PointerEventHandler<HTMLDivElement>;
    onPointerEnter?: PointerEventHandler<HTMLDivElement>;
    onPointerLeave?: PointerEventHandler<HTMLDivElement>;
};
export declare function NodeActionMenu({ onFind, onAddHole, onDelete, onDuplicate, onMove, onEditMesh, onCurve, onGroup, onUngroup, onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, }: NodeActionMenuProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=node-action-menu.d.ts.map