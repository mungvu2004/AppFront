import type { Control, ControlValue } from '@pascal-app/core';
import type { ProceduralItemNode } from '@pascal-app/core/procedural-items';
export type ControlDescriptor = {
    key: string;
    control: Control;
    value: ControlValue;
    onChange: (value: ControlValue) => void;
};
export declare function proceduralControlDescriptors(parts: ProceduralItemNode['recipe']['parts'], state: {
    parts: Record<string, boolean>;
    lightsOn: boolean;
} | undefined, togglePart: (partId: string) => void, toggleLights: () => void, lampDefault?: boolean): ControlDescriptor[];
//# sourceMappingURL=procedural-controls.d.ts.map