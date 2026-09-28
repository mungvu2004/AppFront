import { z } from 'zod';
import { type AnyNodeType } from '../types.js';
/**
 * Minimal valid instances of every node kind, built from the kinds' own
 * schemas. Shared by the `AnyNode` contract test, the compiled-parser parity
 * test, and the schema bench so all three cover the same 48 kinds without
 * three copies of the table drifting apart.
 */
/** Fields a kind requires beyond the defaults its own schema fills in. */
export declare const NODE_REQUIRED_FIELDS: Record<string, Record<string, unknown>>;
/** Every kind `AnyNode` discriminates on. */
export declare const NODE_KINDS: AnyNodeType[];
/** A node schema as authored — discriminator still wrapped by `nodeType()`. */
export type AuthoredNodeSchema = z.ZodObject<{
    type: z.ZodDefault<z.ZodLiteral<string>>;
} & z.core.$ZodLooseShape>;
export declare function isAuthoredNodeSchema(value: unknown): value is AuthoredNodeSchema;
/** kind → the per-kind schema the package exports, keyed off its own default. */
export declare function authoredNodeSchemas(): Map<string, AuthoredNodeSchema>;
/**
 * kind → a minimal valid node with every schema default materialized.
 *
 * Always parsed through the raw authored schema, which `z.compile` leaves
 * untouched (it returns a clone), so the fixtures are an interpreted baseline
 * regardless of whether compiled parsers are enabled.
 */
export declare function nodeFixtures(): Map<AnyNodeType, Record<string, unknown>>;
//# sourceMappingURL=node-fixtures.d.ts.map