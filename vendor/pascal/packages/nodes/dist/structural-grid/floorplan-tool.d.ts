import { type AnyNode } from '@pascal-app/core';
import { type FloorplanToolContext } from '@pascal-app/editor';
type PlanPoint = [number, number];
export type StructuralGridLabelFamily = 'numeric' | 'alphabetic';
export declare function shouldConsumeStructuralGridPointerEvent(event: {
    type: string;
    button: number;
    buttons: number;
}): boolean;
export declare function structuralGridLabelFamily(start: PlanPoint, end: PlanPoint): StructuralGridLabelFamily;
export declare function alphabeticGridLabel(index: number): string;
export declare function nextStructuralGridLabel(nodes: Readonly<Record<string, AnyNode>>, levelId: string, start: PlanPoint, end: PlanPoint): string;
export declare function snapStructuralGridAngle(start: PlanPoint, point: PlanPoint): PlanPoint;
export declare function FloorplanStructuralGridToolLayer({ activeLevelId, finishTool, gridSnapStep, sceneApi, selectNode, }: FloorplanToolContext): import("react").JSX.Element | null;
export default FloorplanStructuralGridToolLayer;
//# sourceMappingURL=floorplan-tool.d.ts.map