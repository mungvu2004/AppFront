import { type ReactNode } from 'react';
export type BottomSheetHandle = {
    snapTo: (heightPx: number) => void;
    getHeight: () => number;
};
interface BottomSheetProps {
    initialHeightPx: number;
    snapPointsPx: number[];
    onCommit: (heightPx: number) => void;
    children: ReactNode;
}
export declare const BottomSheet: import("react").ForwardRefExoticComponent<BottomSheetProps & import("react").RefAttributes<BottomSheetHandle>>;
export {};
//# sourceMappingURL=bottom-sheet.d.ts.map