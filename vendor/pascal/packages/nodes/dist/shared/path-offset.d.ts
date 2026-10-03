type Point = [number, number, number];
/**
 * Offset a polyline horizontally by `offset` meters to one side, mitered at
 * bends so the parallel line meets cleanly. Positive `offset` shifts along the
 * `+UP × heading` side of each segment; negative flips to the other side. Used
 * to lay a thin line beside an existing run (the liquid-line follow-trace).
 */
export declare function offsetPathHorizontal(path: readonly Point[], offset: number): Point[];
export {};
//# sourceMappingURL=path-offset.d.ts.map