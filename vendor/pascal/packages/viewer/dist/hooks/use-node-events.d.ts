import { type AnyNode, type AnyNodeType } from '@pascal-app/core';
import type { ThreeEvent } from '@react-three/fiber';
type NodeByKind<K extends AnyNodeType> = Extract<AnyNode, {
    type: K;
}>;
export declare function useNodeEvents<K extends AnyNodeType>(node: NodeByKind<K>, type: K): {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
    onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
    onClick: (_e: ThreeEvent<PointerEvent>) => void;
    onPointerEnter: (e: ThreeEvent<PointerEvent>) => void;
    onPointerLeave: (e: ThreeEvent<PointerEvent>) => void;
    onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
    onDoubleClick: (e: ThreeEvent<PointerEvent>) => void;
    onContextMenu: (e: ThreeEvent<PointerEvent>) => void;
};
export {};
//# sourceMappingURL=use-node-events.d.ts.map