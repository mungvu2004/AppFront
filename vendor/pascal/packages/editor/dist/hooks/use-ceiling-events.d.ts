/**
 * Reliable pointer events for placing ceiling-attached items.
 *
 * Mirrors {@link useGridEvents} (the floor path): rather than relying on the
 * thin, single-sided `ceiling-grid` overlay mesh to be hit by R3F's raycaster —
 * which misses from the "wrong" camera side, near polygon edges/holes, or while
 * the overlay is mid-reveal, dropping the commit click even though the green box
 * still shows — it intersects a math plane at each ceiling's height (double-sided,
 * so it hits from above or below) and point-in-polygon tests the hit. Emits
 * `ceiling:enter/move/leave/click` so both the placement coordinator and the 2D
 * floor-plan item preview keep working.
 *
 * Active only while a ceiling-attached item is being placed or moved. The
 * `ceiling-grid` mesh no longer emits these events (see `CeilingRenderer`), so
 * this is the single, reliable source.
 */
export declare function useCeilingEvents(): void;
//# sourceMappingURL=use-ceiling-events.d.ts.map