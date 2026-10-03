import type { CaptureStreamDescriptor } from '@pascal-app/core/capture';
export declare function isCaptureLayerVisible(layers: Readonly<Record<string, boolean>>, layerKey: string, defaultLayerVisibility?: Readonly<Record<string, boolean>>): boolean;
export declare function isCaptureStreamVisible(stream: CaptureStreamDescriptor, layers: Readonly<Record<string, boolean>>, defaultLayerVisibility?: Readonly<Record<string, boolean>>): boolean;
export declare function isCaptureSessionVisible(showScans: boolean, scanVisible: boolean): boolean;
//# sourceMappingURL=layer-visibility.d.ts.map