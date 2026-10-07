import type { CaptureStreamPacket } from '@pascal-app/core/capture';
export type PointCloudData = {
    colors: Float32Array | null;
    positions: Float32Array;
};
export declare function CapturePointCloudLayer({ artifactUrl, inline, maxPoints, packets, pointSize, }: {
    artifactUrl?: string;
    inline?: unknown;
    maxPoints?: number;
    packets?: readonly CaptureStreamPacket[];
    pointSize?: number;
}): import("react").JSX.Element | null;
export declare function buildPointCloudData(packets: readonly CaptureStreamPacket[], maxPoints: number): PointCloudData;
export declare function buildPointCloudPayloadData(value: unknown, maxPoints: number): PointCloudData;
//# sourceMappingURL=point-cloud-layer.d.ts.map