/**
 * Wall assemblies — real layered stacks with true thicknesses, plus the
 * offset-miter geometry that lets the layer boundaries be drawn on the 2D plan
 * with clean corners.
 *
 * ## Where the numbers come from
 *
 * Every thickness below is keyed to the 2021 IRC (ASTM C90 for the CMU unit
 * depth), and each constant carries its citation. Anything not covered by a
 * standard we can name is marked `unverified` on the preset and surfaced in
 * the inspector — we do not invent thicknesses.
 *
 * This is a drafting aid, not engineering. Values are typical/approximate — verify with the AHJ.
 *
 * ## Stack order
 *
 * Outside → inside: exterior finish, [air space], sheathing, framing, interior
 * finish (2021 IRC R703.1 / R703.2 / R703.3).
 *
 * The weather-resistive barrier (IRC R703.2) is deliberately NOT a layer: at
 * about 0.01 in it has no drawable thickness at plan scale, and adding a
 * symbolic one would make `wall.thickness` disagree with reality. Same for the
 * vapour retarder.
 *
 * ## Which side is exterior
 *
 * `wall.frontSide` / `wall.backSide` (schema `wall.ts`). `frontSide` is the
 * +normal side, where `normal = perp(end - start) = (-dy, dx)/L` — this is the
 * same convention `resolveWallSurfaceSides` writes with
 * (`packages/core/src/lib/space-detection.ts:825-872`) and the same "left" side
 * the miter code offsets by +halfThickness.
 *
 *   frontSide === 'exterior' && backSide !== 'exterior'  ->  exterior = +1
 *   backSide  === 'exterior' && frontSide !== 'exterior' ->  exterior = -1
 *   otherwise (both interior, both exterior, or unknown) ->  null
 *
 * Fallback when it is `null`: the stack is still drawn at its true total
 * thickness (thickness must never change because a room was not detected), the
 * exterior face is pinned to the +normal side, and `exteriorSideResolved`
 * reports the fallback so callers can say so. A wall with both sides interior
 * is a PARTITION and should carry a partition assembly — one with neither
 * `exterior` nor `sheathing`, whose interior finish is then applied to BOTH
 * faces and no cladding or sheathing is drawn (see `resolveWallAssembly`).
 */
import type { WallNode } from '../../schema/index.js';
import type { WallAssembly } from '../../schema/nodes/wall.js';
import { type Point2D, type WallMiterData } from './wall-mitering.js';
/** 1/2 in gypsum board. 2021 IRC R702.3.5 + Table R702.3.5. */
export declare const GYPSUM_HALF: number;
/** 5/8 in gypsum board. 2021 IRC Table R702.3.5. */
export declare const GYPSUM_FIVE_EIGHTHS: number;
/** 7/16 in wood structural panel, field default. 2021 IRC Table R602.3(3). */
export declare const WSP_SHEATHING: number;
/** 1/2 in glass-mat gypsum sheathing. 2021 IRC R702.3.5 + Table R703.3(1). */
export declare const GYPSUM_SHEATHING: number;
/** 2x4 stud, actual 3-1/2 in. 2021 IRC R602.3 / Table R602.3(5). */
export declare const STUD_2X4: number;
/** 2x6 stud, actual 5-1/2 in. Same source as STUD_2X4. */
export declare const STUD_2X6: number;
/** Vinyl / wood lap siding bounding depth, 3/4 in. 2021 IRC R703.11 / R703.5 + Table R703.3(1). */
export declare const SIDING_LAP: number;
/** Fiber cement lap board, 5/16 in board. 2021 IRC R703.10.2 + Table R703.3(1). */
export declare const FIBER_CEMENT: number;
/** 3-coat cement plaster, 7/8 in. 2021 IRC R703.7 + Table R702.1(1). */
export declare const STUCCO_3_COAT: number;
/** Anchored brick wythe, nominal 4 in = 3-5/8 actual. 2021 IRC R703.8 + Table R703.3(1). */
export declare const BRICK_VENEER: number;
/** Nominal 1 in air space behind brick. 2021 IRC Table R703.8.4(1) + R703.8.4.2. */
export declare const BRICK_AIR_SPACE: number;
/** Actual depth of a nominal 8 in CMU unit, 7-5/8 in. ASTM C90. */
export declare const CMU_8_ACTUAL: number;
/**
 * 1x3 furring strip laid flat, 3/4 in. UNVERIFIED as an assembly thickness:
 * the code names 3/4 in vertical furring only as a cladding attachment over
 * foam (R703.15), not as a CMU furring layer. 3/4 in is the actual thickness
 * of nominal 1x lumber.
 */
export declare const FURRING_1X: number;
/**
 * Adhered stone veneer, 2-5/8 in. UNVERIFIED: 2-5/8 in is the maximum unit
 * thickness for adhered masonry veneer, not a cited assembly value, so any
 * preset using it is flagged.
 */
export declare const STONE_VENEER_UNVERIFIED: number;
export type WallAssemblyLayerRole = 'exterior-finish' | 'air-gap' | 'sheathing' | 'framing' | 'interior-finish';
export type WallAssemblyLayer = {
    role: WallAssemblyLayerRole;
    /** Human-readable material, used verbatim in the inspector and in poché keys. */
    material: string;
    thickness: number;
    /**
     * Distance from the EXTERIOR face of the whole stack to this layer's OUTER
     * boundary. The first layer is always 0; the last layer's
     * `offsetFromExteriorFace + thickness === total`.
     */
    offsetFromExteriorFace: number;
};
export type ResolvedWallAssembly = {
    layers: WallAssemblyLayer[];
    total: number;
    /** 'envelope' has cladding/sheathing, 'partition' does not, 'unspecified' = no assembly. */
    kind: 'envelope' | 'partition' | 'unspecified';
    /** +1 = exterior on the +normal (front) side, -1 = -normal (back), null = undetermined. */
    exteriorSide: 1 | -1 | null;
    /** `exteriorSide` with the +normal fallback applied. Always a usable sign. */
    exteriorSideResolved: 1 | -1;
};
export type WallAssemblySideSource = Pick<WallNode, 'frontSide' | 'backSide'>;
/**
 * Which geometric side of the wall faces outdoors. See the module header for
 * the rule; `null` means "undetermined", not "interior".
 */
export declare function resolveWallExteriorSide(wall: WallAssemblySideSource): 1 | -1 | null;
/**
 * Total thickness of a stack, in metres. THE definition of `wall.thickness`
 * whenever an assembly is present.
 *
 * - envelope: exterior + sheathing + framing + interior
 * - partition (no exterior, no sheathing): interior + framing + interior
 */
export declare function assemblyThickness(assembly: WallAssembly): number;
/**
 * Resolve a wall into its ordered layer stack, outside → inside.
 *
 * `layers` always sums exactly to `total`, and `total` is what
 * `wall.thickness` must hold. A wall with no `assembly` resolves to a single
 * `framing` layer of `wall.thickness` so callers have one code path.
 */
export declare function resolveWallAssembly(wall: Pick<WallNode, 'thickness' | 'assembly' | 'frontSide' | 'backSide'>): ResolvedWallAssembly;
/**
 * The patch to apply when any layer changes: the assembly plus the re-derived
 * TOTAL thickness. Callers must never write one without the other.
 */
export declare function wallAssemblyPatch(assembly: WallAssembly): {
    assembly: WallAssembly;
    thickness: number;
};
export type WallAssemblyPreset = {
    id: string;
    label: string;
    category: 'exterior' | 'interior' | 'masonry';
    assembly: WallAssembly;
    /**
     * Present when at least one thickness in this preset could not be cited to
     * a named standard. The inspector shows this verbatim.
     */
    unverified?: string;
};
export declare const WALL_ASSEMBLY_PRESETS: readonly WallAssemblyPreset[];
/**
 * The catalog material the 3D exterior face is skinned with for each
 * assembly cladding, when the wall has no painted exterior slot of its own.
 * This is what makes a wall that SAYS "lap siding" in its assembly LOOK like
 * lap siding in the viewer, the elevation and the section alike. Stone has
 * no catalog finish yet and 'none' is bare — both return null (drawn with the
 * plain wall default). Only `library:` refs, never an invented colour.
 */
export declare const WALL_FINISH_LIBRARY_REF: Record<string, string | null>;
/** `library:` ref for the wall's assembly cladding, or null when it has none. */
export declare function wallAssemblyFinishRef(wall: Pick<WallNode, 'assembly'>): string | null;
export declare function getWallAssemblyPreset(id: string | undefined): WallAssemblyPreset | undefined;
/** True when the wall's assembly came from a preset we could not fully cite. */
export declare function wallAssemblyUnverifiedNote(wall: Pick<WallNode, 'assembly'>): string | undefined;
/**
 * Signed offsets from the wall CENTRELINE of every layer boundary, ordered from
 * the +normal face inward to the -normal face. Always `layers.length + 1`
 * entries; the first is `+total/2` and the last is `-total/2`.
 *
 * `drawnThickness` lets the 2D plan exaggerate thin walls (the editor scales
 * wall bodies for legibility) without the layers drifting out of the drawn
 * footprint: the whole stack is scaled by `drawnThickness / total`.
 */
export declare function wallLayerBoundaryOffsets(wall: Pick<WallNode, 'thickness' | 'assembly' | 'frontSide' | 'backSide'>, drawnThickness?: number): number[];
/** Per-wall, per-junction resolved boundary points, indexed from the +normal face. */
export type WallLayerMiterData = {
    /** `wallId -> junctionKey -> points`, indexed from the wall's +normal face. */
    byWall: Map<string, Map<string, (Point2D | null)[]>>;
};
/**
 * Compute mitered layer-boundary points for every wall on a level.
 *
 * `walls` and `miterData` must be the same pair used for the footprint (the
 * floor plan exaggerates thin walls, so it passes the exaggerated list).
 * `getOffsets` returns each wall's boundary offsets from its centreline,
 * descending from +normal — i.e. `wallLayerBoundaryOffsets`.
 */
export declare function calculateLevelLayerMiters(walls: readonly WallNode[], miterData: WallMiterData, getOffsets: (wall: WallNode) => number[]): WallLayerMiterData;
export type WallLayerPolyline = {
    role: WallAssemblyLayerRole | 'face';
    /** Index from the +normal face; 0 and `count - 1` are the two outer faces. */
    index: number;
    offset: number;
    start: Point2D;
    end: Point2D;
};
/**
 * The drawn layer boundary lines for one wall, already mitered at both ends.
 * Index 0 and the last index are the outer faces (already drawn by the
 * footprint polygon); callers normally skip them and draw the interior ones.
 *
 * `role` names the layer OUTSIDE the boundary (the one nearer the +normal face
 * for a front-exterior wall), so a boundary can be styled by what it separates.
 */
export declare function getWallLayerPolylines(wall: WallNode, layerMiters: WallLayerMiterData, offsets: number[]): WallLayerPolyline[];
//# sourceMappingURL=wall-assembly.d.ts.map