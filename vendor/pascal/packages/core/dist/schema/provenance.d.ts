import { z } from 'zod';
/**
 * Typed source identity of a node (owner decision D5): which source elements
 * it reproduces, and which nodes it was derived from by an edit.
 *
 * The field is `provenance`, not `source`: a hosted third-party plugin already
 * declares its own top-level `source` (`articraft:asset`), and `.extend()`
 * would silently replace the base field for that kind.
 *
 * Caps are fixed and never enforced by truncation. A node over a cap fails
 * its schema, so every validated writer (store, hosted save, collaboration,
 * MCP) refuses it with an issue at the capped path, while load keeps a stored
 * node verbatim. A writer with more ids than fit must refuse, or keep the
 * extra ids off the node (sub-record `src`, the import artifact's alias table).
 *
 * Length caps are UTF-8 bytes (F8): every string is printable ASCII, one byte
 * per character, and an importer percent-encodes anything else, which keeps
 * the id exactly recoverable. A byte-counting refinement would not survive the
 * JSON Schema snapshot hosted plugins are validated by. A maximal value,
 * JSON escapes included, serialises to under 24 KiB, the F8 field cap. Bulk
 * writers chunk their operations by encoded bytes.
 */
/** Refs per node. The /next house's largest node carries 18 source ids. */
export declare const PROVENANCE_MAX_REFS = 32;
/** Node ids in one lineage record (the pieces of a merge). */
export declare const PROVENANCE_MAX_LINEAGE_IDS = 32;
/** A namespace: `al` (a SketchUp source at a config hash), `ifc:<file>`, `cap:<capture>`. */
export declare const PROVENANCE_MAX_NAMESPACE_BYTES = 48;
/** A source id, stored verbatim (never slugged). The house's longest is 72. */
export declare const PROVENANCE_MAX_ID_BYTES = 160;
/** A node id, as the collaboration protocol bounds it. */
export declare const PROVENANCE_MAX_NODE_ID_BYTES = 128;
/**
 * How a ref claims its source element:
 * - `primary`: this node reproduces the element 1:1 (the default when absent);
 * - `piece`: one of several declared pieces across sibling nodes, scored on their union;
 * - `absorbed`: folded into this node without an address of its own (traceable, never exact);
 * - `alias`: a retired id that resolves to this node;
 * - `derived`: a copy or user variant; it never claims the element.
 */
export declare const ProvenanceRole: z.ZodEnum<{
    primary: "primary";
    piece: "piece";
    absorbed: "absorbed";
    alias: "alias";
    derived: "derived";
}>;
export type ProvenanceRole = z.infer<typeof ProvenanceRole>;
export declare const ProvenanceRef: z.ZodObject<{
    ns: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        primary: "primary";
        piece: "piece";
        absorbed: "absorbed";
        alias: "alias";
        derived: "derived";
    }>>;
}, z.core.$strip>;
export type ProvenanceRef = z.infer<typeof ProvenanceRef>;
export declare const ProvenanceLineageOp: z.ZodEnum<{
    import: "import";
    split: "split";
    merge: "merge";
    duplicate: "duplicate";
    convert: "convert";
    promote: "promote";
    "make-independent": "make-independent";
    attach: "attach";
}>;
export type ProvenanceLineageOp = z.infer<typeof ProvenanceLineageOp>;
/**
 * The last edit that derived this node, and the node ids it came from. The ids
 * are history: they are compared, never dereferenced, and may name nodes that
 * no longer exist (the other walls of a merge).
 */
export declare const ProvenanceLineage: z.ZodObject<{
    op: z.ZodEnum<{
        import: "import";
        split: "split";
        merge: "merge";
        duplicate: "duplicate";
        convert: "convert";
        promote: "promote";
        "make-independent": "make-independent";
        attach: "attach";
    }>;
    fromIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type ProvenanceLineage = z.infer<typeof ProvenanceLineage>;
export declare const Provenance: z.ZodObject<{
    refs: z.ZodArray<z.ZodObject<{
        ns: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<{
            primary: "primary";
            piece: "piece";
            absorbed: "absorbed";
            alias: "alias";
            derived: "derived";
        }>>;
    }, z.core.$strip>>;
    lineage: z.ZodOptional<z.ZodObject<{
        op: z.ZodEnum<{
            import: "import";
            split: "split";
            merge: "merge";
            duplicate: "duplicate";
            convert: "convert";
            promote: "promote";
            "make-independent": "make-independent";
            attach: "attach";
        }>;
        fromIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Provenance = z.infer<typeof Provenance>;
//# sourceMappingURL=provenance.d.ts.map