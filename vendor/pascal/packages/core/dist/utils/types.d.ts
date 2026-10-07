/**
 * Type guard to check if a value is a plain object (and not null or an array).
 * Useful for narrowing down Zod's generic JSON types.
 */
export declare const isObject: (val: unknown) => val is Record<string, any>;
//# sourceMappingURL=types.d.ts.map