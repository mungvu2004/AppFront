import { z } from 'zod';
/**
 * One source reference as a string: `<ns>:<id>[::<sub>]`, the address form of a
 * typed provenance ref `{ ns, id }` (plan item I-01, owner decision D5) plus an
 * optional sub-part. Sub-records that carry provenance (an assembly layer's
 * `src`) store it in this form.
 *
 * - `ns`: the source namespace, ≤ 48 bytes. It may carry its own qualifier
 *   (`ifc:<file>`), so the id starts after the last single `:`.
 * - `id`: the source id, verbatim, ≤ 160 bytes, without `:`.
 * - `sub`: everything after the first `::`, ≤ 160 bytes.
 * No part is empty. Like the typed ref (`ProvenanceRef`, whose byte caps these
 * are), every character is printable ASCII, spaces included, one byte each;
 * importers percent-encode anything else.
 */
export type ParsedSourceRef = {
    ns: string;
    id: string;
    sub?: string;
};
export declare function parseSourceRef(value: string): ParsedSourceRef | null;
export declare const SourceRefString: z.ZodString;
//# sourceMappingURL=source-ref.d.ts.map