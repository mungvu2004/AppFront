import type { CaptureSessionDescriptor, CaptureSessionLocator, CaptureSource, CaptureSourceResolver, CaptureStreamDescriptor, CaptureStreamPacket } from '@pascal-app/core/capture';
export type CaptureSourceState = {
    descriptor: CaptureSessionDescriptor | null;
    descriptorVersion: number;
    error: Error | null;
    loading: boolean;
    packets: Readonly<Record<string, readonly CaptureStreamPacket[]>>;
    retry: () => void;
    source: CaptureSource | null;
    streamEpochs: Readonly<Record<string, string>>;
};
export type UseCaptureSourceOptions = {
    maxPacketsPerStream?: number;
    streamFilter?: (stream: CaptureStreamDescriptor) => boolean;
    subscribe?: boolean;
};
export declare function useCaptureSource(locator: CaptureSessionLocator | null, resolveSource: CaptureSourceResolver, options?: UseCaptureSourceOptions): CaptureSourceState;
export declare function captureSubscriptionStreamIds(descriptor: CaptureSessionDescriptor, streamFilter: ((stream: CaptureStreamDescriptor) => boolean) | undefined): readonly string[] | undefined;
export declare function retainLiveCapturePackets(packetsByStream: Readonly<Record<string, readonly CaptureStreamPacket[]>>, descriptor: CaptureSessionDescriptor): Readonly<Record<string, readonly CaptureStreamPacket[]>>;
export declare function appendCapturePacket(packetsByStream: Readonly<Record<string, readonly CaptureStreamPacket[]>>, packet: CaptureStreamPacket, maxPacketsPerStream: number): Readonly<Record<string, readonly CaptureStreamPacket[]>>;
export declare function nextCaptureStreamEpoch(currentEpoch: string | undefined, previousPackets: readonly CaptureStreamPacket[], packet: CaptureStreamPacket): string;
//# sourceMappingURL=source-state.d.ts.map