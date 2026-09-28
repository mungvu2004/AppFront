interface SegmentedControlProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: {
        label: React.ReactNode;
        value: T;
    }[];
    className?: string;
    disabled?: boolean;
    mixed?: boolean;
}
export declare function SegmentedControl<T extends string>({ value, onChange, options, className, disabled, mixed, }: SegmentedControlProps<T>): import("react").JSX.Element;
export {};
//# sourceMappingURL=segmented-control.d.ts.map