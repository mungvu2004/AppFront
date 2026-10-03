interface SliderControlProps {
    label: React.ReactNode;
    value: number;
    onChange: (value: number) => void;
    onCommit?: (value: number) => void;
    onCancel?: () => void;
    previewWhileTyping?: boolean;
    min?: number;
    max?: number;
    precision?: number;
    step?: number;
    className?: string;
    unit?: string;
    restoreOnCommit?: boolean;
    mixed?: boolean;
}
export declare function SliderControl({ label, value, onChange, onCommit, onCancel, previewWhileTyping, min, max, precision: storedPrecision, step: storedStep, className, unit, restoreOnCommit, mixed, }: SliderControlProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=slider-control.d.ts.map