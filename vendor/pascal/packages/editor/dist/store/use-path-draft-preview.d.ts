import type { AnyNode } from '@pascal-app/core';
export type PathDraftKind = 'duct-segment' | 'lineset' | 'liquid-line' | 'pipe-segment';
export type PathDraftPoint = [number, number, number];
export type PathDraftParameter = boolean | number | string;
export type PathDraftParameters = Record<string, PathDraftParameter>;
type PathDraftPreviewState = {
    kind: PathDraftKind | null;
    points: PathDraftPoint[];
    cursor: PathDraftPoint | null;
    parameters: PathDraftParameters;
    relatedNodes: AnyNode[];
    setDraft(kind: PathDraftKind, points: readonly PathDraftPoint[], cursor: PathDraftPoint | null, parameters?: Readonly<PathDraftParameters>, relatedNodes?: readonly AnyNode[]): void;
    clear(kind: PathDraftKind): void;
    reset(): void;
};
export declare const usePathDraftPreview: import("zustand").UseBoundStore<import("zustand").StoreApi<PathDraftPreviewState>>;
export {};
//# sourceMappingURL=use-path-draft-preview.d.ts.map