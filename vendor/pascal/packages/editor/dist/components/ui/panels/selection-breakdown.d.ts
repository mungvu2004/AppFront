/**
 * "1 slab · 1 stair · 2 fences" — one entry per node type in first-appearance
 * order so the line stays stable while shift-clicking. Labels derive from the
 * type id ('roof-segment' → 'roof segment'); pluralization is a simple +s
 * (the codebase has no pluralize helper and no current kind needs one).
 * Missing nodes (stale ids) are skipped.
 */
export declare function formatSelectionBreakdown(types: Array<string | null | undefined>): string;
//# sourceMappingURL=selection-breakdown.d.ts.map