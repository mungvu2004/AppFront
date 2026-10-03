/**
 * Registry-driven window system bundle.
 *
 *  - **`WindowSystem`** — rebuilds frame / sash / divider / sill /
 *    muntin geometry. Cascades dirty to parent wall for the cutout.
 *  - **`WindowAnimationSystem`** — advances sash/panel open state at
 *    frame priority 2, then marks the window dirty for the geometry
 *    rebuild at priority 3.
 */
declare const WindowSystems: () => import("react").JSX.Element;
export default WindowSystems;
//# sourceMappingURL=system.d.ts.map