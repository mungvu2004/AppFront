/** Shared display/input conversion; values and bounds stay in the stored unit. */
export declare function useLinearDisplay(unit: string, precision: number, step?: number): {
    isImperial: boolean;
    displayUnit: string;
    parseUnit: string | undefined;
    precision: number;
    step: number;
    toDisplay: (stored: number) => number;
    toStored: (display: number) => number;
    roundStored: (stored: number) => number;
};
//# sourceMappingURL=use-linear-display.d.ts.map