import type { Control, ControlValue } from '@pascal-app/core';
/** One interactive control (toggle / slider / temperature) rendered inside the
 *  item controls overlay. Shared by the parametric `InteractiveSystem` and the
 *  baked-GLB `GlbInteractive` overlay so both look and behave identically. */
export declare const ControlWidget: ({ control, value, onChange, }: {
    control: Control;
    value: ControlValue;
    onChange: (v: ControlValue) => void;
}) => import("react").JSX.Element | null;
//# sourceMappingURL=control-widget.d.ts.map