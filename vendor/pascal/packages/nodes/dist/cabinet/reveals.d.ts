export type CabinetRevealGapId = '2' | '3' | '4' | '6';
export declare const CABINET_REVEAL_GAPS: readonly [{
    readonly id: "2";
    readonly label: "2 mm";
    readonly value: 0.002;
}, {
    readonly id: "3";
    readonly label: "3 mm";
    readonly value: 0.003;
}, {
    readonly id: "4";
    readonly label: "4 mm";
    readonly value: 0.004;
}, {
    readonly id: "6";
    readonly label: "6 mm";
    readonly value: 0.006;
}];
export declare function cabinetRevealGapId(value: number): CabinetRevealGapId | 'custom';
export declare function cabinetRevealGapById(id: CabinetRevealGapId): {
    readonly id: "2";
    readonly label: "2 mm";
    readonly value: 0.002;
} | {
    readonly id: "3";
    readonly label: "3 mm";
    readonly value: 0.003;
} | {
    readonly id: "4";
    readonly label: "4 mm";
    readonly value: 0.004;
} | {
    readonly id: "6";
    readonly label: "6 mm";
    readonly value: 0.006;
};
//# sourceMappingURL=reveals.d.ts.map