/**
 * Mounts every registered node kind's system component, ordered by
 * `system.priority` (default {@link DEFAULT_PRIORITY}).
 *
 * Two resilience rules, both learned from a live session in which the wall
 * systems bundle (geometry rebuild + cutout stamps + batching) never ran
 * while everything else did (QA f2 probe6: 24 walls stuck on placeholder
 * geometry, no `wallHidden` stamps, base materials untouched):
 *
 * 1. `entries` re-derives on `useRegistryVersion()` — kinds register
 *    asynchronously (plugin discovery, HMR), and a list snapshotted once at
 *    mount permanently drops any system whose kind registers later. Same
 *    staleness class SelectionManager already guards against ("plugin
 *    nodes select-but-never-hover").
 * 2. Each system gets its OWN Suspense boundary. With one shared boundary,
 *    ANY lazily-loading (or load-failing) system chunk unmounts every
 *    other system while it is pending — one bad chunk must not take the
 *    wall pipeline down with it.
 */
export declare function RegisteredSystems(): import("react").JSX.Element | null;
//# sourceMappingURL=registered-systems.d.ts.map