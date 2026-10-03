export type RendererCapabilityCanvas = {
    getContext(contextId: 'webgl2'): unknown;
};
/** Mirrors `GPUPowerPreference` without pulling WebGPU ambient types into the declaration build. */
export type RendererPowerPreference = 'high-performance' | 'low-power';
type RendererGpuAdapter = {
    features?: Iterable<string>;
    requestDevice(descriptor?: {
        requiredFeatures?: string[];
    }): Promise<unknown>;
};
type RendererGpu = {
    requestAdapter(options?: Record<string, unknown>): Promise<RendererGpuAdapter | null>;
};
export type RendererCapability = {
    backend: 'webgpu';
    device: unknown;
    status: 'supported';
} | {
    backend: 'webgl';
    status: 'supported';
} | {
    error?: unknown;
    status: 'unsupported';
};
export type RendererBackendParameters = {
    device?: unknown;
    forceWebGL?: boolean;
};
type InitializableRenderer = {
    dispose?: () => void;
    init: () => Promise<unknown>;
};
export type RendererInitializationResult<Renderer> = {
    backend: 'webgpu' | 'webgl';
    renderer: Renderer;
    status: 'ready';
} | {
    error?: unknown;
    status: 'unsupported';
};
export declare function detectRendererCapability({ canvas, gpu, powerPreference, webgpuTimeoutMs, }?: {
    canvas?: RendererCapabilityCanvas | null;
    gpu?: RendererGpu | null;
    powerPreference?: RendererPowerPreference;
    webgpuTimeoutMs?: number;
}): Promise<RendererCapability>;
export declare function initializeGpuRenderer<Renderer extends InitializableRenderer>({ createRenderer, forceWebGL, gpu, powerPreference, probeCanvas, webgpuTimeoutMs, }: {
    createRenderer: (parameters: RendererBackendParameters) => Renderer;
    forceWebGL?: boolean;
    gpu?: RendererGpu | null;
    powerPreference?: RendererPowerPreference;
    probeCanvas?: RendererCapabilityCanvas | null;
    webgpuTimeoutMs?: number;
}): Promise<RendererInitializationResult<Renderer>>;
export {};
//# sourceMappingURL=renderer-capability.d.ts.map