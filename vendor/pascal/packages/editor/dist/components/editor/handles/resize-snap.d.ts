export declare function resolveResizeSnapValue({ rawValue, fallbackValue, gridSnapEnabled, gridSnapActive, gridSnapStep, magneticSnapActive, magneticSnap, connectionSnapActive, connectionSnap, }: {
    rawValue: number;
    fallbackValue?: number;
    gridSnapEnabled: boolean;
    gridSnapActive: boolean;
    gridSnapStep: number;
    magneticSnapActive: boolean;
    magneticSnap?: (value: number) => number;
    connectionSnapActive?: boolean;
    connectionSnap?: (value: number) => number;
}): number;
//# sourceMappingURL=resize-snap.d.ts.map