type MovementSfxStepKeyArgs = {
    coords: readonly number[];
    gridSnapActive: boolean;
    gridStep: number;
    freeStep?: number;
};
export declare function movementSfxStepKey({ coords, gridSnapActive, gridStep, freeStep, }: MovementSfxStepKeyArgs): string;
export declare function createMovementSfxTick(): {
    tick: (args: MovementSfxStepKeyArgs, emitInitialStep?: boolean) => void;
    schedule(args: MovementSfxStepKeyArgs, shouldPlay: () => boolean, emitInitialStep?: boolean): void;
    flush: () => void;
    cancel: () => void;
};
export {};
//# sourceMappingURL=movement-tick.d.ts.map