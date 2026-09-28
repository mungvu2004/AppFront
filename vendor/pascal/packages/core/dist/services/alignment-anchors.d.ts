/**
 * Node → alignment-anchor adapters.
 *
 * `alignment.ts` is pure geometry and knows nothing about nodes. This
 * module bridges the scene graph to it: it reads a floor-placed kind's
 * footprint from the registry and turns it into the bbox anchors the
 * resolver matches against. Kept out of `alignment.ts` so that file stays
 * registry-free.
 *
 * All coordinates are XZ meters in the same frame as `node.position`
 * (building-local for nodes inside a building). The 3D move producer works
 * entirely in that frame, so the resulting guides line up with the cursor.
 */
import { type PlanAabb } from '../lib/plan-footprint.js';
import type { AnyNode } from '../schema/types.js';
import { type AlignmentAnchor } from './alignment.js';
export type FootprintAABB = PlanAabb;
/**
 * Axis-aligned XZ bounding box of a rotated rectangle centred at
 * `position`. Delegates to pure `planFootprintAABB` (same math as
 * spatial-grid / MCP layout clearance).
 */
export declare function footprintAABBFrom(position: readonly [number, number, number], dimensions: readonly [number, number, number], rotationY: number): FootprintAABB;
/** XZ footprint AABB of a floor-placed node at its current position, or
 *  null for kinds without a usable footprint. */
export declare function footprintAABB(node: AnyNode): FootprintAABB | null;
/** XZ footprint AABB of a floor-placed node relocated so its centre sits at
 *  the proposed (x, z). `rotationY` overrides the node's footprint rotation
 *  (R/T bumps it before the scene commit lands). Null when no footprint. */
export declare function footprintAABBAt(node: AnyNode, x: number, z: number, rotationY?: number): FootprintAABB | null;
/**
 * Corner anchors for the moving node's footprint relocated so its centre
 * sits at the proposed (x, z). Corners only — the moving item aligns by its
 * edges, never its centreline. Returns [] when the kind has no footprint.
 */
export declare function movingFootprintAnchors(node: AnyNode, x: number, z: number, rotationY?: number): AlignmentAnchor[];
/**
 * Corner anchors for a moving node relocated to the proposed plan position.
 * Covers both the centred-box path (`floorPlaced.footprint` /
 * `alignmentFootprint: box`) and explicit AABB footprints such as stairs,
 * whose occupied plan bounds depend on children or curved/spiral geometry.
 */
export declare function movingAlignmentAnchors(node: AnyNode, nodes: Readonly<Record<string, AnyNode>> | undefined, x: number, z: number, rotationY?: number): AlignmentAnchor[];
/**
 * Alignment anchors for a wall segment: the two centerline endpoints + chord
 * midpoint, plus — when `thickness` is known — four **face** corner anchors,
 * each endpoint offset by ±thickness/2 perpendicular to the wall axis.
 *
 * The face anchors are what let a footprint align to a wall's *face* rather
 * than its centerline: for an axis-aligned wall the two same-side face
 * anchors share a constant X (vertical wall) or Z (horizontal wall) running
 * the wall's full length, so the point-to-point resolver snaps a moving
 * corner flush to the face anywhere along the wall (the perpendicular
 * tie-break connects the guide to the nearer face endpoint). A diagonal wall
 * gets only its face/centerline endpoints — point-to-point can't represent a
 * sloped face line; that's an accepted v1 limitation.
 *
 * Curve offset is ignored — endpoints are exact and the chord midpoint is
 * good enough for v1. Coordinates are the wall's `start` / `end`
 * (building-local XZ meters).
 */
export declare function wallSegmentAnchors(id: string, start: readonly [number, number], end: readonly [number, number], thickness?: number): AlignmentAnchor[];
/** Each vertex of a polygon (slab / ceiling footprint) as a `corner` anchor. */
export declare function polygonAnchors(id: string, points: readonly (readonly [number, number])[]): AlignmentAnchor[];
/**
 * Alignment anchors a node contributes to the candidate pool, dispatched by
 * kind: walls / fences → segment endpoints + midpoint; slabs / ceilings →
 * polygon vertices; everything else → the corners of its plan bounding box
 * (`alignmentAABB`, which covers floor-placed kinds, the elevator's
 * alignment box, and the stair's chain / sector footprint). Kinds with no
 * usable footprint contribute nothing.
 *
 * `nodes` is needed only by kinds whose footprint walks siblings / children
 * (a straight stair's `stair-segment` chain); every other kind derives its
 * anchors from `node` alone.
 */
export declare function nodeAlignmentAnchors(node: AnyNode, nodes?: Readonly<Record<string, AnyNode>>): AlignmentAnchor[];
/**
 * Anchors from every alignable node except `excludeId` — the unified
 * candidate pool every move / placement tool resolves against, so any
 * draggable object can align to any other (items, walls, fences, slabs,
 * ceilings, columns).
 *
 * When `levelId` is given, nodes that belong to a *different* level are
 * dropped. Alignment is XZ-only, so without this a node directly below on
 * another floor (e.g. the ground floor while you place on the first) would
 * snap and draw a guide even though the two sit at different heights.
 * Building-/site-scoped nodes with no level ancestor (e.g. an elevator
 * shaft, which is parented to the building and spans every floor) resolve to
 * null and stay in the pool so they align on any floor. The 2D floor-plan
 * deliberately omits the filter — aligning a wall to the one directly below
 * in plan is the whole point of the reference floor.
 */
export declare function collectAlignmentAnchors(nodes: Readonly<Record<string, AnyNode>>, excludeId: string, levelId?: string | null): AlignmentAnchor[];
//# sourceMappingURL=alignment-anchors.d.ts.map