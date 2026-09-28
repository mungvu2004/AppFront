import { type AnyNode, type DormerEvent, type DormerNode, type WindowEvent, type WindowNode } from '@pascal-app/core';
import { type Object3D, Vector3 } from 'three';
export type DormerWindowTarget = {
    dormer: DormerNode;
    face: NonNullable<WindowNode['dormerFace']>;
    position: [number, number, number];
    valid: boolean;
};
export declare function dormerEventFromHostedWindow(event: WindowEvent, dormer: DormerNode, object: Object3D): DormerEvent;
export declare function getDormerWindowWorldYaw(event: DormerEvent, target: DormerWindowTarget): number;
export declare function getDormerWindowWorldNormal(event: DormerEvent, target: DormerWindowTarget, out?: Vector3): Vector3;
export declare function shouldWriteDormerWindowPreviewHost(node: WindowNode, target: DormerWindowTarget): boolean;
export declare function resolveDormerWindowTarget(args: {
    event: DormerEvent;
    width: number;
    height: number;
    nodes: Readonly<Record<string, AnyNode>>;
    ignoreId?: string;
    snap?: (value: number) => number;
}): DormerWindowTarget | null;
//# sourceMappingURL=dormer-wall-opening-placement.d.ts.map