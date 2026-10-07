/** Forget the shared expanded state. Called when the last selection clears so
 * a fresh selection opens the inspector collapsed — the sharing is only meant
 * to survive swaps between panels (roof ↔ segment), not a close/reopen. */
export declare function resetDesktopInspectorCollapsed(): void;
/**
 * Host-supplied inspector footer (e.g. community's "Save as preset"). The
 * `PanelManager` provides it so every panel — including kind-owned
 * `customPanel`s that render their own `<PanelWrapper>` without threading a
 * `footer` prop — picks it up without per-kind wiring. An explicit `footer`
 * prop still wins over the context.
 */
export declare const InspectorFooterContext: import("react").Context<import("react").ReactNode>;
interface PanelWrapperProps {
    title: string;
    /** Either a URL path (legacy panels pass `/icons/floor.webp` etc.,
     *  rendered via next/image) OR a React node (registry-driven
     *  inspector renders `<Icon icon="lucide:fence" />` from
     *  `def.presentation.icon`). */
    icon?: string | React.ReactNode;
    onClose?: () => void;
    onReset?: () => void;
    onBack?: () => void;
    children: React.ReactNode;
    /** Pinned below the scrollable body, inside the panel card. */
    footer?: React.ReactNode;
    className?: string;
    width?: number | string;
}
export declare function PanelWrapper({ title, icon, onClose, onReset, onBack, children, footer, className, width, }: PanelWrapperProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=panel-wrapper.d.ts.map