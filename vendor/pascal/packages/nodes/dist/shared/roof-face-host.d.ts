import { type RoofWallFaceId } from '@pascal-app/core';
import { type ReactNode } from 'react';
/**
 * Mounts a roof-hosted wall child inside its host face frame. Children
 * of roof segments render under the roof's `roof-elements` group (roof
 * frame); this wrapper applies the segment transform plus the face
 * frame, both derived from the LIVE-override-merged segment — hosted
 * nodes therefore track segment handle drags in real time instead of
 * jumping to their new spot on commit. Inside the frame, children use
 * plain wall-child position conventions ([u, v, z-from-mid-plane]).
 */
export declare function RoofFaceHostFrame({ roofSegmentId, roofFace, children, }: {
    roofSegmentId: string;
    roofFace: RoofWallFaceId | undefined;
    children: ReactNode;
}): import("react").JSX.Element | null;
//# sourceMappingURL=roof-face-host.d.ts.map