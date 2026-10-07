import type { LevelNode } from '@pascal-app/core';
import type { LevelDuplicatePreset } from '../../lib/level-duplication';
export declare function LevelDuplicateDialog({ open, level, onConfirm, onOpenChange, }: {
    open: boolean;
    level: LevelNode | null;
    onConfirm: (preset: LevelDuplicatePreset) => void;
    onOpenChange: (open: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=level-duplicate-dialog.d.ts.map