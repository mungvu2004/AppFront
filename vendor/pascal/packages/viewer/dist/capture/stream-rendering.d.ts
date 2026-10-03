import { type CaptureArtifactReference, type CaptureStreamDescriptor } from '@pascal-app/core/capture';
export type CaptureModelFormat = 'gltf' | 'usdz';
export declare function isCaptureStreamRenderable(stream: CaptureStreamDescriptor, customRendererKeys?: ReadonlySet<string>): boolean;
/**
 * Extracted viewer previews (device motion, point cloud, surface mesh) are
 * archived as JSON payload artifacts whose content matches the inline shape.
 * One predicate decides both renderability and runtime hydration, so a
 * stream can never be declared renderable without a hydration path.
 */
export declare function streamHydratesJsonPayload(stream: CaptureStreamDescriptor): boolean;
export declare function isCaptureModelArtifact(artifact: CaptureArtifactReference | undefined): boolean;
export declare function captureModelFormat(artifact: CaptureArtifactReference | undefined): CaptureModelFormat | null;
export declare function isCapturePointCloudArtifact(artifact: CaptureArtifactReference | undefined): boolean;
//# sourceMappingURL=stream-rendering.d.ts.map