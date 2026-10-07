import type { ReactNode } from 'react';
export type ViewerSceneHeaderProps = {
    projectName?: string | null;
    owner?: {
        username?: string | null;
    } | null;
    onBack?: () => void;
    /** Fallback destination when no `onBack` handler is supplied. Must already be
     *  sanitized by the caller. */
    backHref?: string;
    /** Extra row under the project info (e.g. likes/fork actions). */
    stats?: ReactNode;
};
export declare const ViewerSceneHeader: ({ projectName, owner, onBack, backHref, stats, }: ViewerSceneHeaderProps) => import("react").JSX.Element;
//# sourceMappingURL=viewer-scene-header.d.ts.map