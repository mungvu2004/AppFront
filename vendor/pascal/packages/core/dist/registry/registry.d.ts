import type { AnyNodeDefinition, BakePolicy, FloorplanScope, InspectorExtension, NodeRegistry, Plugin } from './types.js';
/** Monotonic counter, bumped on every kind registration (and test reset). */
export declare function getRegistryVersion(): number;
/**
 * Subscribe to registry changes (a kind registered via {@link registerNode}
 * / {@link loadPlugin}, or a test reset). Returns the unsubscribe function.
 * `useSyncExternalStore`-compatible.
 */
export declare function onRegistryChange(listener: () => void): () => void;
export declare const nodeRegistry: NodeRegistry & {
    _register: (def: AnyNodeDefinition) => void;
    _reset: () => void;
    _snapshot: () => () => void;
};
export declare function registerNode(def: AnyNodeDefinition): void;
/** The plugin that registered a node kind, when it came through {@link loadPlugin}. */
export declare function getNodePluginId(kind: string): string | undefined;
/**
 * Inspector-card sections registered for a node kind
 * ({@link InspectorExtension}), in plugin load order. Callers must still
 * apply the project's install gate (`installedPlugins` — same rule as
 * {@link isNodeKindEnabled}) before rendering. Re-derive on the
 * registry-version bump: plugins register asynchronously after mount.
 */
export declare function getInspectorExtensions(kind: string): InspectorExtension[];
/**
 * Whether a registered kind should participate in a project. Kinds registered
 * directly by the host and the built-in plugin are always enabled. An omitted
 * install list means a legacy scene whose plugin state predates persistence, so
 * loaded plugins remain visible for backward compatibility.
 */
export declare function isNodeKindEnabled(kind: string, installedPlugins?: readonly string[]): boolean;
/**
 * Returns the set of registered kinds whose definition declares the
 * `selectable` capability. Callers that maintain hardcoded "selectable kinds"
 * lists (SelectionManager, FloatingActionMenu) should concat this with their
 * legacy entries instead of editing the hardcoded list per migration.
 *
 * Phase 6 deletes the hardcoded lists entirely and uses this function as the
 * single source of truth. For now it's additive over the legacy lists so the
 * existing kinds keep working unchanged.
 */
export declare function getSelectableKinds(): string[];
/**
 * Returns true when the kind is declared selectable in the registry. Use
 * in expression chains like `if (node.type === 'wall' || isRegistrySelectable(node.type))`.
 */
export declare function isRegistrySelectable(kind: string): boolean;
/**
 * Whether the editor should apply its material-based selection highlight to a
 * kind. Selection highlighting is enabled by default, including for legacy or
 * unregistered kinds; definitions may explicitly opt out.
 */
export declare function isSelectionHighlightEnabled(kind: string): boolean;
/**
 * Kinds whose `def.floorplanScope` matches the requested scope. Used by
 * `FloorplanRegistryLayer` to discover building- and site-scoped kinds
 * without hardcoding kind names in the editor layer. `'level'` is the
 * default, so `kindsWithFloorplanScope('level')` includes kinds that
 * didn't set the field at all.
 */
export declare function kindsWithFloorplanScope(scope: FloorplanScope): string[];
/**
 * A kind's {@link BakePolicy} from the registry, defaulting to `'static'` for
 * kinds that don't declare one (or aren't registered). The bake and the baked
 * `/viewer` consult this instead of hardcoding kind names — see
 * plans/editor-plugin-trees-example.md → Part D.
 */
export declare function bakePolicyOf(kind: string): BakePolicy;
/** Registered kinds whose {@link BakePolicy} matches `policy`. `'static'` is the
 *  default, so `kindsWithBakePolicy('static')` includes kinds that didn't set it. */
export declare function kindsWithBakePolicy(policy: BakePolicy): string[];
/**
 * Returns true when the kind is movable from a 2D floor-plan handle —
 * either via `capabilities.movable`, an explicit
 * `def.floorplanMoveTarget`, or an `affordanceTools.move` 3D mover that
 * the floating action menu can engage. Replaces the kind-name ternary
 * chain in `floating-action-menu.tsx`.
 */
export declare function isRegistryMovable(kind: string): boolean;
/**
 * Whether the kind has a move tool that MOUNTS in the 3D viewport — the
 * generic `capabilities.movable` mover or a bespoke `affordanceTools.move`.
 * Narrower than {@link isRegistryMovable}, which also accepts floorplan-only
 * movers (e.g. zone) that have no 3D tool. Gates 3D direct move: Ctrl/Meta-drag
 * and the move-cross grip. Kept beside `isRegistryMovable` so the 2D and 3D
 * movability predicates can't drift apart.
 */
export declare function hasRegistry3DMoveTool(kind: string): boolean;
/**
 * Whether the kind can be saved as a reusable preset. Default: an
 * explicit `capabilities.presettable` boolean wins; otherwise the kind
 * is presettable iff it declares `def.parametrics`. Read by host apps
 * (community shell) to gate "save as preset" UI on a selection.
 */
export declare function isPresettable(def: AnyNodeDefinition): boolean;
export declare function isPresettableKind(kind: string): boolean;
/**
 * Resolve a kind's facing-triangle config, or `null` when it has none.
 * `{ reversed }` says whether the triangle points along the node's local -Z
 * (its front) instead of +Z. One reader (the editor-side `<FacingPoseIndicator>`
 * publishers) so placement and move stay consistent.
 */
export declare function resolveFacingIndicator(kind: string): {
    reversed: boolean;
} | null;
/**
 * Names of schema fields on `def` that are host references (`wallId`,
 * `wallT`, etc.). Read by host apps at preset-save time to strip these
 * from the stored payload — see `def.capabilities.hostRefFields` docs.
 * Returns an empty array for kinds that don't declare any.
 */
export declare function getHostRefFields(def: AnyNodeDefinition): ReadonlyArray<string>;
/**
 * Whether instances of this kind are created by drawing with a build tool
 * (tool id === node `type`) rather than dropping a finished instance. Read
 * by host apps to route preset placement of such kinds through
 * `setToolDefaults(type, params)` + `setTool(type)` — see
 * `def.capabilities.drawTool` docs.
 */
export declare function isDrawnViaTool(def: AnyNodeDefinition): boolean;
export declare function isDrawnViaToolKind(kind: string): boolean;
export declare function loadPlugin(plugin: Plugin): Promise<void>;
/**
 * App-level plugin discovery hook. The bootstrap loads `builtinPlugin`
 * unconditionally and then awaits this to pick up any extra plugins
 * (third-party node packs, AI-authored bundles, user-installed kinds).
 * Defaults to returning `[]` — apps that want external plugins call
 * {@link setPluginDiscovery} before the bootstrap module runs.
 *
 * Kept async so a future loader can fetch over the network without
 * changing the contract. See `wiki/architecture/plugin-authoring.md` for
 * the plugin author surface this enables.
 */
export type PluginDiscovery = () => Promise<Plugin[]>;
/**
 * Replace the plugin discovery implementation. Call once at app startup
 * before {@link discoverPlugins} is invoked (bootstrap order matters).
 *
 * The contract is intentionally minimal — just "return a list of
 * plugins to load." The loader can be a static `import.meta.glob`, a
 * `fetch` against a registry endpoint, a worker IPC, etc. Each returned
 * plugin still goes through {@link loadPlugin} so the same API-version
 * gate + duplicate-kind protection applies.
 */
export declare function setPluginDiscovery(fn: PluginDiscovery): void;
/**
 * Extend the current plugin discovery instead of replacing it. Useful for app-
 * bundled example or first-party plugins that should load alongside any host-
 * provided discovery source, not clobber it.
 */
export declare function extendPluginDiscovery(fn: PluginDiscovery): void;
/**
 * Run the active plugin discovery and return the discovered plugins.
 * Bootstrap code is expected to call this after `loadPlugin(builtinPlugin)`
 * and then `await loadPlugin(...)` each result in order.
 */
export declare function discoverPlugins(): Promise<Plugin[]>;
//# sourceMappingURL=registry.d.ts.map