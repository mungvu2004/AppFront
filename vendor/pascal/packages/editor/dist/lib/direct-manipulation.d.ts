import { type AnyNode, type ArcResizeHandle, type SceneApi } from '@pascal-app/core';
export declare function getDirectRotateHandle(node: AnyNode): ArcResizeHandle<AnyNode> | null;
export declare function canDirectRotateNode(node: AnyNode): boolean;
export declare const EDITOR_HANDLE_HIT_AREA_USER_DATA_KEY = "editorHandleHitArea";
export declare function pointerEventHitsEditorHandle(event: unknown): boolean;
export declare function canDirectMoveNode(node: AnyNode): boolean;
export declare function shouldStartDirectMoveDrag({ allowPlainDrag, commandModifier, handleOwnsPointer, nodeId, selectedIds, }: {
    allowPlainDrag: boolean;
    commandModifier: boolean;
    handleOwnsPointer: boolean;
    nodeId: string;
    selectedIds: readonly string[];
}): boolean;
export declare function resolveDirectManipulationNode(node: AnyNode, nodes: Readonly<Record<string, AnyNode | undefined>>): AnyNode;
export declare function resolveMoveActionNode(node: AnyNode, nodes: Readonly<Record<string, AnyNode | undefined>>): AnyNode;
export declare function snapDirectRotationDelta(delta: number, free: boolean): number;
export declare function resolveDirectRotationDragDelta(startX: number, clientX: number, radiansPerPixel: number, free: boolean): number;
export declare function resolveDirectRotationPatch(node: AnyNode, delta: number, sceneApi?: SceneApi): Partial<AnyNode> | null;
//# sourceMappingURL=direct-manipulation.d.ts.map