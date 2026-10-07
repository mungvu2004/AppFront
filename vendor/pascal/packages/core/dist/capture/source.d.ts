import { z } from 'zod';
import { type CaptureArtifactReference, type CaptureSessionDescriptor, type CaptureSessionLocator } from './schema.js';
export declare const CaptureStreamPacketSchema: z.ZodObject<{
    protocolVersion: z.ZodLiteral<1>;
    sessionId: z.ZodString;
    streamId: z.ZodString;
    generation: z.ZodNumber;
    sequence: z.ZodNumber;
    timestamp: z.ZodNumber;
    frameId: z.ZodOptional<z.ZodString>;
    keyframe: z.ZodOptional<z.ZodBoolean>;
    bounds: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    payload: z.ZodUnknown;
}, z.core.$strip>;
export type CaptureStreamPacket = z.infer<typeof CaptureStreamPacketSchema>;
export type CaptureSourceEvent = {
    type: 'descriptor';
    descriptor: CaptureSessionDescriptor;
} | {
    type: 'packet';
    packet: CaptureStreamPacket;
} | {
    type: 'closed';
};
export type CaptureArtifactResolution = {
    url: string;
    dispose?: () => void;
};
export type CaptureSubscriptionOptions = {
    signal?: AbortSignal;
    streamIds?: readonly string[];
};
export interface CaptureSource {
    describe(signal?: AbortSignal): Promise<CaptureSessionDescriptor>;
    resolveArtifact?(artifact: CaptureArtifactReference, signal?: AbortSignal): Promise<CaptureArtifactResolution>;
    subscribe?(options?: CaptureSubscriptionOptions): AsyncIterable<CaptureSourceEvent>;
}
export type CaptureSourceResolver = (locator: CaptureSessionLocator) => CaptureSource | Promise<CaptureSource>;
export type HttpCaptureSourceOptions = {
    credentials?: RequestCredentials;
    fetch?: typeof globalThis.fetch;
    headers?: HeadersInit;
    manifestUrl?: (locator: CaptureSessionLocator) => string;
    resolveArtifact?: (artifact: CaptureArtifactReference, signal?: AbortSignal) => Promise<CaptureArtifactResolution>;
};
export type PushCaptureSourceOptions = {
    maxQueuedEventsPerSubscriber?: number;
};
export declare function createHttpCaptureSource(locatorInput: CaptureSessionLocator, options?: HttpCaptureSourceOptions): CaptureSource;
export declare class PushCaptureSource implements CaptureSource {
    #private;
    constructor(descriptor: CaptureSessionDescriptor, options?: PushCaptureSourceOptions);
    describe(): Promise<CaptureSessionDescriptor>;
    resolveArtifact(artifact: CaptureArtifactReference): Promise<CaptureArtifactResolution>;
    subscribe(options?: CaptureSubscriptionOptions): AsyncIterable<CaptureSourceEvent>;
    updateDescriptor(descriptor: CaptureSessionDescriptor): void;
    publishPacket(packetInput: CaptureStreamPacket): void;
    close(): void;
}
//# sourceMappingURL=source.d.ts.map