import type { SelectionAffordanceInteractionApi } from '@pascal-app/editor';
import type { MutableRefObject } from 'react';
type FinishModal = (commit: boolean) => void;
export type BlockModalSessionOptions = {
    beginInputDrag: SelectionAffordanceInteractionApi['beginInputDrag'];
    cancelRef: MutableRefObject<(() => void) | null>;
    canCommit?: () => boolean;
    cursor: string;
    onFinish: (commit: boolean) => void;
    onKeyDown?: (event: KeyboardEvent, finish: FinishModal) => void;
    onPointerDown?: (event: PointerEvent, finish: FinishModal) => void;
    onPointerMove?: (event: PointerEvent) => void;
};
export declare function beginBlockModalSession({ beginInputDrag, cancelRef, canCommit, cursor, onFinish, onKeyDown, onPointerDown, onPointerMove, }: BlockModalSessionOptions): FinishModal;
export {};
//# sourceMappingURL=modal-session.d.ts.map