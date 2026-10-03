import { type ToolOption } from '@pascal-app/core';
/**
 * The pick-one option rows a kind declares via `def.toolOptions` (e.g. the
 * roof's 'Create from: Draw / Room'), for whichever sidebar the host mounts
 * it in — the standalone Build tab and the community Build sidebar both get
 * every kind's options with no per-kind wiring. Renders nothing for kinds
 * without options. Selecting a choice only writes the kind's own state;
 * hosts that want selection to also arm the tool pass `onSelect`.
 */
export declare function ToolOptionsPanel({ kind, className, onSelect, getChoiceThumbnail, active, }: {
    kind: string | null | undefined;
    className?: string;
    onSelect?: (option: ToolOption, value: string) => void;
    getChoiceThumbnail?: (option: ToolOption, value: string) => string | undefined;
    active?: boolean;
}): import("react").JSX.Element | null;
//# sourceMappingURL=tool-options-panel.d.ts.map