import { type ScanNode } from '@pascal-app/core';
import { type CaptureSessionDescriptor, type CaptureSource, type CaptureSourceResolver, type CaptureStreamDescriptor, type CaptureStreamPacket } from '@pascal-app/core/capture';
import { type ComponentType } from 'react';
export type CaptureMeshPresentation = {
    dollhouse?: boolean;
    previewMaterial?: 'clay' | 'recorded';
};
export type CaptureStreamRendererProps = {
    artifactUrl: string | null;
    descriptor: CaptureSessionDescriptor;
    meshPresentation?: CaptureMeshPresentation;
    packets: readonly CaptureStreamPacket[];
    scan: ScanNode;
    source: CaptureSource;
    stream: CaptureStreamDescriptor;
    streamEpoch: string;
};
export type CaptureStreamRenderer = ComponentType<CaptureStreamRendererProps>;
export type CaptureRuntimeErrorContext = {
    phase: 'source';
    scanId: ScanNode['id'];
    sessionId: string;
} | {
    layerKey: string;
    phase: 'stream';
    scanId: ScanNode['id'];
    sessionId: string;
    streamId: string;
    streamKind: string;
};
export type CaptureRuntimeProps = {
    defaultLayerVisibility?: Readonly<Record<string, boolean>>;
    maxPacketsPerStream?: number;
    onError?: (error: Error, context: CaptureRuntimeErrorContext) => void;
    renderers?: Readonly<Record<string, CaptureStreamRenderer>>;
    resolveSource: CaptureSourceResolver;
    retryKey?: number | string;
};
export declare function CaptureRuntime({ defaultLayerVisibility, maxPacketsPerStream, onError, renderers, resolveSource, retryKey, }: CaptureRuntimeProps): import("react").JSX.Element;
export declare function CaptureStreamLayer({ descriptor, meshPresentation, packets, renderers, scan, source, stream, streamEpoch, }: Omit<CaptureStreamRendererProps, 'artifactUrl'> & {
    renderers: Readonly<Record<string, CaptureStreamRenderer>>;
}): import("react").JSX.Element | null;
//# sourceMappingURL=capture-runtime.d.ts.map