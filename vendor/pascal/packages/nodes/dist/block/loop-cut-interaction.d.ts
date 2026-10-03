export type LoopCutInteractionStage = 'choosing-ring' | 'sliding';
export type LoopCutPointerAction = 'begin-slide' | 'commit-current' | 'commit-centered' | 'cancel';
export declare function resolveLoopCutPointerAction(stage: LoopCutInteractionStage, button: number): LoopCutPointerAction | null;
export declare function resolveLoopCutSlideFactor(cuts: number, requestedFactor: number): number;
//# sourceMappingURL=loop-cut-interaction.d.ts.map