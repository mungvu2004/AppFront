/**
 * Generic floor-elevation system.
 *
 * Walks `dirtyNodes` and, for any kind that declares
 * `capabilities.floorPlaced`, lifts the registered mesh's Y by whatever
 * slab the footprint overlaps. Items / shelves / etc. that sit directly
 * on a level pick this up automatically — no per-kind elevation logic.
 *
 * Skips nodes whose parent is not a level (items hosted on shelves /
 * tables inherit Y from the parent group), and respects
 * `floorPlaced.applies` so items with `asset.attachTo` (wall / ceiling
 * mounted) are left alone.
 *
 * Runs at priority 1 — before the priority-2 systems (`GeometrySystem`,
 * `ItemSystem`) so the dirty mark survives long enough for those to do
 * their own work. Kinds with no geometry/system have no downstream dirty
 * consumer, so this system clears their dirty mark after applying the lift.
 */
export declare const FloorElevationSystem: () => null;
//# sourceMappingURL=floor-elevation-system.d.ts.map