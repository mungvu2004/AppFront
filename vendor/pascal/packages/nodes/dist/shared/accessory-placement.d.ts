import type { AnyNode, AnyNodeId, DuctFittingNode, PipeFittingNode } from '@pascal-app/core';
import { Quaternion } from 'three';
import type { ScenePort } from './ports';
export declare function inheritFittingProfile<T extends DuctFittingNode | PipeFittingNode>(node: T, port: ScenePort, nodes: Record<AnyNodeId, AnyNode>): T;
export declare function placeAccessPanel(raw: [number, number, number], node: DuctFittingNode, nodes: Record<AnyNodeId, AnyNode>, levelId: AnyNodeId | null, in3D: boolean, gridStep: number): {
    position: [number, number, number];
    rotation: [number, number, number];
} | null;
export declare function accessoryMateQuaternion(node: DuctFittingNode, port: ScenePort, nodes: Record<AnyNodeId, AnyNode>): Quaternion;
//# sourceMappingURL=accessory-placement.d.ts.map