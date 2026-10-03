export declare const DORMER_WINDOW_GAP = 0.12;
export declare const DORMER_WINDOW_MARGIN = 0.12;
export declare const DORMER_WINDOW_MIN_WIDTH = 0.3;
export type DormerWindowRowItem = {
    id: string;
    position: readonly [number, number, number];
    width: number;
};
export type DormerWindowRowPlacement = {
    id: string;
    position: [number, number, number];
    width: number;
};
export declare function planDormerWindowRow(dormerWidth: number, windows: readonly DormerWindowRowItem[]): DormerWindowRowPlacement[] | null;
//# sourceMappingURL=window-layout.d.ts.map