interface OpacityControlProps {
    visible?: boolean;
    opacity?: number;
    onVisibilityToggle: () => void;
    onOpacityChange: (opacity: number) => void;
    className?: string;
}
export declare function OpacityControl({ visible, opacity, onVisibilityToggle, onOpacityChange, className, }: OpacityControlProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=opacity-control.d.ts.map