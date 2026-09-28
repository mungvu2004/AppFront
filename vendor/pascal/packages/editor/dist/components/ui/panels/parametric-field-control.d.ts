import type { AnyNode, ParamField } from '@pascal-app/core';
interface ParametricFieldControlProps {
    field: ParamField<AnyNode>;
    value: unknown;
    mixed?: boolean;
    onChange: (patch: Partial<AnyNode>) => void;
    onCommit?: (patch: Partial<AnyNode>) => void;
}
export declare function ParametricFieldControl({ field, value, mixed, onChange, onCommit, }: ParametricFieldControlProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=parametric-field-control.d.ts.map