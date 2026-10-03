import { type AnyNode, type LeanToExtensionNode, type RoofSegmentTrim } from '@pascal-app/core';
import type { LeanToCornerSide } from './corner-joint';
export declare const FREESTANDING_CANOPY_JOINTS_KEY = "leanToFreestandingCanopyJoints";
export type CanopySide = 'positive' | 'negative';
export type FreestandingCanopyJoint = {
    side: LeanToCornerSide;
    kind: 'corner' | 'linear';
    neighborId: string;
    neighborSide: LeanToCornerSide;
    innerCanopySide: CanopySide;
    interiorAngle: number;
    trimX: number;
    trimZ: number;
    gutterMitre: number;
    sharedPostOwner: boolean;
};
export type CanopyRoofPlaneJointLayout = {
    centerX: number;
    trim: RoofSegmentTrim;
    width: number;
};
export type CanopyGutterJointLayout = {
    joints: Partial<Record<LeanToCornerSide, FreestandingCanopyJoint & {
        gutterMitre: number;
    }>>;
    maxX: number;
    minX: number;
};
export type FreestandingCanopyJointMetadata = Partial<Record<LeanToCornerSide, Pick<FreestandingCanopyJoint, 'kind' | 'innerCanopySide' | 'trimX' | 'trimZ' | 'gutterMitre' | 'sharedPostOwner'>>>;
export declare function canopyCornerJointMetadata(joints: Partial<Record<LeanToCornerSide, FreestandingCanopyJoint>>): FreestandingCanopyJointMetadata;
export declare function readFreestandingCanopyJointMetadata(leanTo: LeanToExtensionNode): FreestandingCanopyJointMetadata;
export declare function resolveFreestandingCanopyJoints(leanTo: LeanToExtensionNode, nodes: Record<string, AnyNode> | undefined): Partial<Record<LeanToCornerSide, FreestandingCanopyJoint>>;
export declare function resolveCanopyRoofPlaneJointLayout(leanTo: LeanToExtensionNode, nodes: Record<string, AnyNode> | undefined, planeSide: CanopySide): CanopyRoofPlaneJointLayout;
export declare function resolveCanopyGutterJointLayout(leanTo: LeanToExtensionNode, nodes: Record<string, AnyNode> | undefined, planeSide: CanopySide): CanopyGutterJointLayout;
//# sourceMappingURL=canopy-joint.d.ts.map