export declare function PanelTextField({ label, onCommit, value, }: {
    label: string;
    onCommit: (value: string) => void;
    value: string;
}): import("react").JSX.Element;
export declare function PanelSelect({ label, onChange, options, value, }: {
    label: string;
    onChange: (value: string) => void;
    options: ReadonlyArray<{
        label: string;
        value: string;
    }>;
    value: string;
}): import("react").JSX.Element;
//# sourceMappingURL=panel-fields.d.ts.map