/**
 * Registry-driven ceiling system bundle. Wraps `CeilingSystem` so it
 * mounts via `RegisteredSystems`.
 *
 * Future: extract polygon triangulation + hole CSG into a pure
 * `buildCeilingGeometry(node)` and migrate to `def.geometry`.
 */
declare const CeilingSystems: () => import("react").JSX.Element;
export default CeilingSystems;
//# sourceMappingURL=system.d.ts.map