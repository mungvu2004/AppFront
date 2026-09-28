import type { ReferenceDeclaration } from '../registry/types.js';
/**
 * How today's code reads an inventoried reference: a plain `path`, a
 * `prefixed` value (`prefix` + id), or `linked-by`, a derived, unpersisted
 * relation computed by `relations.linkedBy`.
 */
export type ReferenceExtractor = 'path' | 'prefixed' | 'linked-by';
/** Hand-written remap or cleanup sites that handle a reference today, which P-03 replaces. */
export type ReferenceRemapSite = 'clone-scene-graph' | 'clone-level-subtree' | 'clone-nodes-into' | 'scene-clipboard' | 'level-duplication' | 'wall-merge' | 'wall-split' | 'wall-topology' | 'delete-nodes';
/**
 * One row of the existing-reference inventory (A-02): a declaration plus
 * how today's code handles it. `kind` is a node kind, `*` for every kind whose
 * schema has `path`, or `#scene` for scene-root records (`rootNodeIds`,
 * `collections`). Derived `linked-by` rows use the path `#linkedBy`.
 */
export type ExistingReference = ReferenceDeclaration & {
    kind: string;
    extractor: ReferenceExtractor;
    /** `linked-by` rows: the derivation rule. */
    linkedBy?: 'endpoint-match' | 'polygon-share';
    remaps: readonly ReferenceRemapSite[];
    note?: string;
};
export declare const EXISTING_REFERENCES: readonly ExistingReference[];
/** Candidate paths that are not references, with the reason. `kind: '*'` matches every kind. */
export declare const NON_REFERENCES: readonly {
    kind: string;
    path: string;
    reason: string;
}[];
export declare const METADATA_REFERENCES: readonly ExistingReference[];
/** Metadata keys found in editor sources that are not references. */
export declare const METADATA_NON_REFERENCES: readonly {
    path: string;
    reason: string;
}[];
/**
 * Whether a discovered metadata key is classified: a row at that path, a
 * dependent of a row, or a row beneath it.
 */
export declare function metadataKeyClassified(key: string, references: readonly ReferenceDeclaration[], nonReferences: readonly {
    path: string;
}[]): boolean;
//# sourceMappingURL=reference-inventory.d.ts.map