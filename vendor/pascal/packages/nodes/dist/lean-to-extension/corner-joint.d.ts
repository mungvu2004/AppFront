import { type AnyNode, type LeanToExtensionNode, WallNode } from '@pascal-app/core';
export type LeanToCornerSide = 'left' | 'right';
export type LeanToPlanPoint = [number, number];
export type LeanToCornerKind = 'convex' | 'concave' | 'linear';
export type LeanToFramingRetainedSide = 'front' | 'back';
export type LeanToCornerJoint = {
    side: LeanToCornerSide;
    kind: LeanToCornerKind;
    neighborId: string;
    neighborSide: LeanToCornerSide;
    roofExtension: number;
    roofPiece: LeanToPlanPoint[];
    roofPieces?: LeanToPlanPoint[][];
    roofAdditionPieces?: LeanToPlanPoint[][];
    mergeRoofPieces?: boolean;
    seam: [LeanToPlanPoint, LeanToPlanPoint] | null;
    framingRetainedSide?: LeanToFramingRetainedSide;
    beamExtension: number;
    gutterMitre: number;
    sharedPostOwner: boolean;
    sharedPostPosition: [number, number, number];
};
export declare const LEAN_TO_CORNER_JOINTS_KEY = "leanToCornerJoints";
export declare function applyLeanToCornerRoofPieces(base: LeanToPlanPoint[], joints: Partial<Record<LeanToCornerSide, LeanToCornerJoint>>): LeanToPlanPoint[][];
export declare function resolveLeanToCornerJoints(leanTo: LeanToExtensionNode, wall: WallNode | undefined, nodes: Record<string, AnyNode> | undefined): Partial<Record<LeanToCornerSide, LeanToCornerJoint>>;
export type LeanToCornerJointMetadata = Partial<Record<LeanToCornerSide, Pick<LeanToCornerJoint, 'beamExtension' | 'gutterMitre' | 'seam' | 'framingRetainedSide' | 'sharedPostOwner'>>>;
export declare function leanToCornerJointMetadata(joints: Partial<Record<LeanToCornerSide, LeanToCornerJoint>>): LeanToCornerJointMetadata;
export declare function readLeanToCornerJointMetadata(leanTo: LeanToExtensionNode): LeanToCornerJointMetadata;
//# sourceMappingURL=corner-joint.d.ts.map