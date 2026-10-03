import type { GuideNode } from '@pascal-app/core';
type GuideEditorEvents = {
    'guide:set-reference-scale': {
        guideId: GuideNode['id'];
    };
    'guide:cancel-reference-scale': undefined;
    'guide:deleted': {
        guideId: GuideNode['id'];
    };
};
export declare const guideEmitter: import("mitt").Emitter<GuideEditorEvents>;
export {};
//# sourceMappingURL=guide-events.d.ts.map