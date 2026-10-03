import type { PipeSegmentNode } from '@pascal-app/core';
export type PipePreset = {
    id: string;
    label: string;
    system: PipeSegmentNode['system'];
    pipeMaterial: PipeSegmentNode['pipeMaterial'];
    diameter: number;
    sloped: boolean;
};
export declare const PIPE_PRESETS: readonly PipePreset[];
//# sourceMappingURL=mep-presets.d.ts.map