import type { z } from 'zod';
/**
 * Walks a zod schema's AST and returns every persisted path that could hold a
 * reference (R3 coverage). A candidate is a leaf whose field name ends in
 * `Id`/`Ids`, is `id` below the root, `children` or `members`, or names a URL,
 * `src`, a `slot` key, thumbnail or material preset; any typed-id (`template_literal`) or `custom`
 * leaf; every record key; and every string-like record value. The inventory
 * must classify each candidate as a reference or a declared non-reference, so
 * a new id-like field cannot land without a policy. Beside a field ending in
 * `Id`, host-derived siblings (`side`, `wallT`, `offset`, `*Face`, `*UV`,
 * `*Edge`, `*EdgeRange`, any non-id `host*`) of any type are candidates too:
 * they must be listed as `dependents` of the reference they follow.
 *
 * Paths use the `ReferencePath` grammar: tuple and array elements are `[]`,
 * record values `*`, record keys `@key`; union branches merge.
 */
export declare function discoverReferenceCandidates(schema: z.ZodType): string[];
//# sourceMappingURL=reference-discovery.d.ts.map