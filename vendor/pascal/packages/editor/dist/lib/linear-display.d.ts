import { type LinearUnit, type MetricNotation } from './measurements';
export declare function getLinearDisplay(unit: string, viewerUnit: LinearUnit, metricNotation: MetricNotation, precision: number, step: number): {
    isImperial: boolean;
    displayUnit: string;
    parseUnit: string | undefined;
    precision: number;
    step: number;
    toDisplay: (stored: number) => number;
    toStored: (display: number) => number;
    roundStored: (stored: number) => number;
};
//# sourceMappingURL=linear-display.d.ts.map