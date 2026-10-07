interface MetricControlProps {
    label: React.ReactNode;
    value: number;
    onChange: (value: number) => void;
    onCommit?: (value: number) => void;
    min?: number;
    max?: number;
    precision?: number;
    step?: number;
    className?: string;
    unit?: string;
    restoreOnCommit?: boolean;
}
export declare function MetricControl({ label, value, onChange, onCommit, min, max, precision: storedPrecision, step: storedStep, className, unit, restoreOnCommit, }: MetricControlProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=metric-control.d.ts.map