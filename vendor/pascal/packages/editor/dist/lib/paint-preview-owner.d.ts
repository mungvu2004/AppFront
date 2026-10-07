export type PaintPreviewCleanup = (() => void) & {
    commit?: () => void;
};
type Interaction = {
    key: string;
    apply: (() => void) | null;
    preview: (() => PaintPreviewCleanup | null) | null;
};
export declare function combinePaintPreviews(previews: PaintPreviewCleanup[]): PaintPreviewCleanup;
export declare function createPaintPreviewOwner(): {
    wrap<T extends Interaction>(interaction: T | null): T | null;
};
export {};
//# sourceMappingURL=paint-preview-owner.d.ts.map