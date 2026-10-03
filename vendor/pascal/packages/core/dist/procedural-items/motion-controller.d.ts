import { type EvaluatedMotion, motionTimeline } from './recipe.js';
export type MotionCommand = {
    sequence: number;
    scope: 'all' | {
        partId: string;
    };
    target: boolean;
};
export declare class ProceduralMotionController {
    readonly motions: readonly EvaluatedMotion[];
    readonly timeline: ReturnType<typeof motionTimeline>;
    private collective;
    private parts;
    private spins;
    private targets;
    private sequence;
    constructor(motions: readonly EvaluatedMotion[], initial?: Record<string, boolean>);
    command(command: MotionCommand): void;
    tick(dt: number): {
        times: Record<string, number>;
        fractions: Record<string, number>;
        spins: Record<string, {
            phase: number;
            speed: number;
        }>;
        pending: boolean;
    };
}
//# sourceMappingURL=motion-controller.d.ts.map