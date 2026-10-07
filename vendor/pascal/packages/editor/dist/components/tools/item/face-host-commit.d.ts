import type { ItemNode, NodeEvent } from '@pascal-app/core';
import type { CommitResult, PlacementContext } from './placement-types';
export type FaceHostClickCommitOutcome = {
    committedId: string | null;
    wasAdopted: boolean;
};
export declare function commitFaceHostClick({ commitDraft, enterFaceHost, event, getContext, }: {
    commitDraft: (nodeUpdate: Partial<ItemNode>) => FaceHostClickCommitOutcome;
    enterFaceHost: (event: NodeEvent) => boolean;
    event: NodeEvent;
    getContext: () => PlacementContext;
}): FaceHostClickCommitOutcome | null;
export declare function resolveFaceHostPreviewCommit(context: PlacementContext): CommitResult | null;
//# sourceMappingURL=face-host-commit.d.ts.map