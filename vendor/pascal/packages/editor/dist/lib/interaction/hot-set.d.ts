import type { InteractionScope } from './scope';
export type AttachClass = 'wall' | 'ceiling' | 'surface';
export declare function attachClassOf(attachTo: string | undefined | null): AttachClass;
export type HotSetCandidate = {
    type: string;
    isFloorLike: boolean;
    exposesTop: boolean;
    exposesSides?: boolean;
    attachClass: AttachClass;
};
export declare function isPickableForAttach(placed: AttachClass, candidate: HotSetCandidate): boolean;
export declare function isCandidateInHotSet(scope: InteractionScope, placedAttachClass: AttachClass | null, candidate: HotSetCandidate): boolean;
//# sourceMappingURL=hot-set.d.ts.map