/**
 * Copy `userData` for an export clone. `structuredClone` throws the moment it
 * meets a function, and live scenes keep runtime resources in userData (a
 * plugin's effect material, TSL uniforms, a mesh reference) whose dispose
 * listeners are functions — so a plain `structuredClone(userData)` aborts the
 * whole export. Exports only ever read plain data back out of userData, so
 * runtime resources and functions are dropped instead of cloned.
 */
export declare function cloneExportUserData(userData: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=export-user-data.d.ts.map