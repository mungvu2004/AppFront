import z from 'zod';
import { AnyNode, type AnyNodeOption } from './types.js';
/**
 * Opt this process into compiled per-kind node parsers. Call at host startup.
 *
 * Compiled and interpreted parsers agree on both successful output and error
 * issues (`compiled-node-parsers.test.ts` asserts that for every node kind), so
 * this only ever changes throughput.
 */
export declare function enableCompiledNodeParsers(value?: boolean): void;
/** Whether {@link enableCompiledNodeParsers} is currently on. */
export declare function compiledNodeParsersEnabled(): boolean;
/**
 * The compiled clone of a single node kind's schema, or `schema` itself when
 * compilation is off or unavailable.
 *
 * Memoized per schema instance, so the codegen for a kind runs once per
 * process. Never pass `AnyNode` — see the module note on megamorphism.
 */
export declare function compiledNodeSchema<T extends z.ZodType>(schema: T): T;
/**
 * The `AnyNode` member that accepts `kind`, compiled when enabled.
 *
 * Returns `null` for anything the union does not discriminate on — an unknown
 * kind, a plugin-registered kind, a missing or non-string `type`. Callers fall
 * back to parsing the union so the failure path (and its `invalid_union` issue
 * at `['type']`) stays byte-identical.
 */
export declare function nodeSchemaForKind(kind: unknown): AnyNodeOption | null;
/**
 * Parse a node against the member for its own `type`, or against the whole
 * union when the kind is one `AnyNode` does not discriminate on.
 *
 * Drop-in for `AnyNode.safeParse(node)`: a discriminated union delegates to the
 * member anyway, so success values and failure issues are the same either way —
 * and the union fallback keeps the `invalid_union` issue at `['type']` for a
 * missing, unknown, or plugin-registered kind.
 */
export declare function parseNode(node: unknown): z.ZodSafeParseResult<AnyNode>;
//# sourceMappingURL=compiled-node-parsers.d.ts.map