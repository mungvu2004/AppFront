interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: React.ReactNode;
    label: string;
}
export declare function ActionButton({ icon, label, className, ...props }: ActionButtonProps): import("react").JSX.Element;
export declare function ActionGroup({ children, className, }: {
    children: React.ReactNode;
    className?: string;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=action-button.d.ts.map