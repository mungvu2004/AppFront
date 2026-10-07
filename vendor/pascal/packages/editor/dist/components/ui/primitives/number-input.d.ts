interface NumberInputProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    precision?: number;
    step?: number;
    className?: string;
}
export declare function NumberInput({ label, value, onChange, min, max, precision, step, className, }: NumberInputProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=number-input.d.ts.map