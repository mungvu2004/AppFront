import type { ToolHint } from '@pascal-app/core';
import { type ContinuationContext } from '../../../lib/continuation';
import type { ContextualShortcutHint } from '../../../lib/contextual-help';
import { type SnapContext } from '../../../lib/snapping-mode';
export declare function ContextualHelperPanel({ hints, chipHints, snapContext, showPaintScope, continuationContext, }: {
    hints: ContextualShortcutHint[];
    chipHints?: ToolHint[];
    snapContext?: SnapContext | null;
    showPaintScope?: boolean;
    continuationContext?: ContinuationContext | null;
}): import("react").JSX.Element | null;
//# sourceMappingURL=contextual-helper-panel.d.ts.map