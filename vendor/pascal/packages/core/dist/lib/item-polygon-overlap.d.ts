/**
 * Test if an item's footprint overlaps with a polygon.
 * Checks: any item corner inside polygon, or any polygon vertex inside item AABB, or edges intersect.
 */
export declare function itemOverlapsPolygon(position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number], polygon: Array<[number, number]>, inset?: number): boolean;
//# sourceMappingURL=item-polygon-overlap.d.ts.map