import { z } from 'zod';
import type { MaterialSchema as MaterialSchemaType } from '../material.js';
export declare const RoofType: z.ZodEnum<{
    flat: "flat";
    hip: "hip";
    gable: "gable";
    shed: "shed";
    gambrel: "gambrel";
    dutch: "dutch";
    mansard: "mansard";
    conical: "conical";
}>;
export type RoofType = z.infer<typeof RoofType>;
export declare const MIN_ROOF_SEGMENT_TRIM_SPAN = 0.1;
export declare const RoofSegmentTrim: z.ZodDefault<z.ZodObject<{
    left: z.ZodDefault<z.ZodNumber>;
    right: z.ZodDefault<z.ZodNumber>;
    front: z.ZodDefault<z.ZodNumber>;
    back: z.ZodDefault<z.ZodNumber>;
    frontLeft: z.ZodDefault<z.ZodNumber>;
    frontRight: z.ZodDefault<z.ZodNumber>;
    backLeft: z.ZodDefault<z.ZodNumber>;
    backRight: z.ZodDefault<z.ZodNumber>;
    frontLeftX: z.ZodDefault<z.ZodNumber>;
    frontLeftZ: z.ZodDefault<z.ZodNumber>;
    frontRightX: z.ZodDefault<z.ZodNumber>;
    frontRightZ: z.ZodDefault<z.ZodNumber>;
    backLeftX: z.ZodDefault<z.ZodNumber>;
    backLeftZ: z.ZodDefault<z.ZodNumber>;
    backRightX: z.ZodDefault<z.ZodNumber>;
    backRightZ: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>;
export type RoofSegmentTrim = z.infer<typeof RoofSegmentTrim>;
export declare const ROOF_SHAPE_DEFAULTS: {
    /** Gambrel: lower (steep) face occupies this fraction of the horizontal half-depth. */
    readonly gambrelLowerWidthRatio: 0.5;
    /** Gambrel: lower (steep) face rises this fraction of the way to the peak. */
    readonly gambrelLowerHeightRatio: 0.6;
    /** Mansard: steep face occupies this fraction of `min(width, depth)`. */
    readonly mansardSteepWidthRatio: 0.15;
    /** Mansard: steep face rises this fraction of the way to the peak. */
    readonly mansardSteepHeightRatio: 0.7;
    /** Dutch: hip face occupies this fraction of `min(width, depth)`. */
    readonly dutchHipWidthRatio: 0.25;
    /** Dutch: hip face rises this fraction of the way to the peak. */
    readonly dutchHipHeightRatio: 0.5;
    /** Dutch: gable waist span along the ridge axis, as a fraction of the max span. */
    readonly dutchWaistLengthRatio: 0.98;
    /**
     * Dutch: how far the gablet's barge board extends outward past the gablet
     * end-wall, along the ridge axis, in metres. 0 disables the rake. The board
     * lies in the gablet's slope planes (coplanar with the main Dutch slopes)
     * and overhangs the lower hip skirt; the gablet end-wall itself stays put.
     */
    readonly dutchGabletRake: 0.48;
    /** Dutch: thickness of the top gable rake slab. */
    readonly dutchTopRakeThickness: 0.21;
};
export declare const RoofSegmentNode: z.ZodObject<{
    object: z.ZodDefault<z.ZodLiteral<"node">>;
    name: z.ZodOptional<z.ZodString>;
    parentId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    visible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    camera: z.ZodOptional<z.ZodObject<{
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        mode: z.ZodDefault<z.ZodEnum<{
            perspective: "perspective";
            orthographic: "orthographic";
        }>>;
        fov: z.ZodOptional<z.ZodNumber>;
        zoom: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    metadata: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    provenance: z.ZodOptional<z.ZodObject<{
        refs: z.ZodArray<z.ZodObject<{
            ns: z.ZodOptional<z.ZodString>;
            id: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<{
                primary: "primary";
                piece: "piece";
                absorbed: "absorbed";
                alias: "alias";
                derived: "derived";
            }>>;
        }, z.core.$strip>>;
        lineage: z.ZodOptional<z.ZodObject<{
            op: z.ZodEnum<{
                import: "import";
                split: "split";
                merge: "merge";
                duplicate: "duplicate";
                convert: "convert";
                promote: "promote";
                "make-independent": "make-independent";
                attach: "attach";
            }>;
            fromIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    id: z.ZodDefault<z.ZodTemplateLiteral<`rseg_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"roof-segment">>;
    material: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        preset: z.ZodOptional<z.ZodCatch<z.ZodEnum<{
            custom: "custom";
            white: "white";
            brick: "brick";
            concrete: "concrete";
            wood: "wood";
            glass: "glass";
            metal: "metal";
            plaster: "plaster";
            tile: "tile";
            marble: "marble";
        }>>>;
        properties: z.ZodOptional<z.ZodObject<{
            color: z.ZodDefault<z.ZodString>;
            roughness: z.ZodDefault<z.ZodNumber>;
            metalness: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            transparent: z.ZodDefault<z.ZodBoolean>;
            side: z.ZodDefault<z.ZodEnum<{
                front: "front";
                back: "back";
                double: "double";
            }>>;
        }, z.core.$strip>>;
        texture: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            repeat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            scale: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    materialPreset: z.ZodOptional<z.ZodString>;
    topMaterial: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        preset: z.ZodOptional<z.ZodCatch<z.ZodEnum<{
            custom: "custom";
            white: "white";
            brick: "brick";
            concrete: "concrete";
            wood: "wood";
            glass: "glass";
            metal: "metal";
            plaster: "plaster";
            tile: "tile";
            marble: "marble";
        }>>>;
        properties: z.ZodOptional<z.ZodObject<{
            color: z.ZodDefault<z.ZodString>;
            roughness: z.ZodDefault<z.ZodNumber>;
            metalness: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            transparent: z.ZodDefault<z.ZodBoolean>;
            side: z.ZodDefault<z.ZodEnum<{
                front: "front";
                back: "back";
                double: "double";
            }>>;
        }, z.core.$strip>>;
        texture: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            repeat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            scale: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    topMaterialPreset: z.ZodOptional<z.ZodString>;
    edgeMaterial: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        preset: z.ZodOptional<z.ZodCatch<z.ZodEnum<{
            custom: "custom";
            white: "white";
            brick: "brick";
            concrete: "concrete";
            wood: "wood";
            glass: "glass";
            metal: "metal";
            plaster: "plaster";
            tile: "tile";
            marble: "marble";
        }>>>;
        properties: z.ZodOptional<z.ZodObject<{
            color: z.ZodDefault<z.ZodString>;
            roughness: z.ZodDefault<z.ZodNumber>;
            metalness: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            transparent: z.ZodDefault<z.ZodBoolean>;
            side: z.ZodDefault<z.ZodEnum<{
                front: "front";
                back: "back";
                double: "double";
            }>>;
        }, z.core.$strip>>;
        texture: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            repeat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            scale: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    edgeMaterialPreset: z.ZodOptional<z.ZodString>;
    wallMaterial: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        preset: z.ZodOptional<z.ZodCatch<z.ZodEnum<{
            custom: "custom";
            white: "white";
            brick: "brick";
            concrete: "concrete";
            wood: "wood";
            glass: "glass";
            metal: "metal";
            plaster: "plaster";
            tile: "tile";
            marble: "marble";
        }>>>;
        properties: z.ZodOptional<z.ZodObject<{
            color: z.ZodDefault<z.ZodString>;
            roughness: z.ZodDefault<z.ZodNumber>;
            metalness: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            transparent: z.ZodDefault<z.ZodBoolean>;
            side: z.ZodDefault<z.ZodEnum<{
                front: "front";
                back: "back";
                double: "double";
            }>>;
        }, z.core.$strip>>;
        texture: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            repeat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            scale: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    wallMaterialPreset: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    roofType: z.ZodDefault<z.ZodEnum<{
        flat: "flat";
        hip: "hip";
        gable: "gable";
        shed: "shed";
        gambrel: "gambrel";
        dutch: "dutch";
        mansard: "mansard";
        conical: "conical";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    conicalStartAngle: z.ZodOptional<z.ZodNumber>;
    conicalSweepAngle: z.ZodOptional<z.ZodNumber>;
    conicalFullCircle: z.ZodOptional<z.ZodBoolean>;
    trim: z.ZodDefault<z.ZodObject<{
        left: z.ZodDefault<z.ZodNumber>;
        right: z.ZodDefault<z.ZodNumber>;
        front: z.ZodDefault<z.ZodNumber>;
        back: z.ZodDefault<z.ZodNumber>;
        frontLeft: z.ZodDefault<z.ZodNumber>;
        frontRight: z.ZodDefault<z.ZodNumber>;
        backLeft: z.ZodDefault<z.ZodNumber>;
        backRight: z.ZodDefault<z.ZodNumber>;
        frontLeftX: z.ZodDefault<z.ZodNumber>;
        frontLeftZ: z.ZodDefault<z.ZodNumber>;
        frontRightX: z.ZodDefault<z.ZodNumber>;
        frontRightZ: z.ZodDefault<z.ZodNumber>;
        backLeftX: z.ZodDefault<z.ZodNumber>;
        backLeftZ: z.ZodDefault<z.ZodNumber>;
        backRightX: z.ZodDefault<z.ZodNumber>;
        backRightZ: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    wallHeight: z.ZodDefault<z.ZodNumber>;
    pitch: z.ZodDefault<z.ZodNumber>;
    wallThickness: z.ZodDefault<z.ZodNumber>;
    deckThickness: z.ZodDefault<z.ZodNumber>;
    overhang: z.ZodDefault<z.ZodNumber>;
    shingleThickness: z.ZodDefault<z.ZodNumber>;
    arc: z.ZodOptional<z.ZodObject<{
        centerX: z.ZodNumber;
        centerZ: z.ZodNumber;
        radius: z.ZodNumber;
    }, z.core.$strip>>;
    shedSideInfillSpan: z.ZodOptional<z.ZodNumber>;
    shedSideInfillMinX: z.ZodOptional<z.ZodNumber>;
    shedSideInfillMaxX: z.ZodOptional<z.ZodNumber>;
    shedFootprintPieces: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>>>;
    shedOpenEndSides: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        right: "right";
        left: "left";
    }>>>;
    shedJointFrame: z.ZodOptional<z.ZodObject<{
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        rotation: z.ZodNumber;
    }, z.core.$strip>>;
    shedJointOwnerId: z.ZodOptional<z.ZodString>;
    shedJointNeighborIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    shedJointScopeId: z.ZodOptional<z.ZodString>;
    managedByParent: z.ZodDefault<z.ZodBoolean>;
    wallShell: z.ZodDefault<z.ZodEnum<{
        omit: "omit";
        auto: "auto";
        include: "include";
    }>>;
    shedInsetEndPanels: z.ZodDefault<z.ZodBoolean>;
    fascia: z.ZodOptional<z.ZodBoolean>;
    fasciaHighEdge: z.ZodOptional<z.ZodBoolean>;
    gambrelLowerWidthRatio: z.ZodDefault<z.ZodNumber>;
    gambrelLowerHeightRatio: z.ZodDefault<z.ZodNumber>;
    mansardSteepWidthRatio: z.ZodDefault<z.ZodNumber>;
    mansardSteepHeightRatio: z.ZodDefault<z.ZodNumber>;
    dutchHipWidthRatio: z.ZodDefault<z.ZodNumber>;
    dutchHipHeightRatio: z.ZodDefault<z.ZodNumber>;
    dutchWaistLengthRatio: z.ZodDefault<z.ZodNumber>;
    dutchGabletRake: z.ZodDefault<z.ZodNumber>;
    dutchTopRakeThickness: z.ZodDefault<z.ZodNumber>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type RoofSegmentNode = z.infer<typeof RoofSegmentNode>;
export declare function getConicalRoofCoverage(node: Pick<RoofSegmentNode, 'conicalFullCircle' | 'conicalStartAngle' | 'conicalSweepAngle'>): {
    fullCircle: boolean;
    startAngle: number;
    sweepAngle: number;
};
export declare function normalizeRoofSegmentTrim(node: Pick<RoofSegmentNode, 'width' | 'depth'> & {
    trim?: Partial<RoofSegmentTrim>;
}): RoofSegmentTrim;
/** Shape of the per-type ratios consumed by the slope helpers. */
type ShapeRatios = {
    gambrelLowerWidthRatio: number;
    gambrelLowerHeightRatio: number;
    mansardSteepWidthRatio: number;
    mansardSteepHeightRatio: number;
    dutchHipWidthRatio: number;
    dutchHipHeightRatio: number;
    dutchWaistLengthRatio: number;
};
type PitchInputs = {
    roofType: RoofType;
    width: number;
    depth: number;
} & Partial<ShapeRatios>;
export type DutchRoofMetrics = {
    axis: 'x' | 'z';
    inset: number;
    waistHalfX: number;
    waistHalfZ: number;
    ridgeStart: readonly [number, number];
    ridgeEnd: readonly [number, number];
    shoulderInsetAlongDepth: number;
    shoulderInsetAlongWidth: number;
};
export declare function getDutchRoofMetrics(input: Pick<RoofSegmentNode, 'width' | 'depth'> & Partial<Pick<RoofSegmentNode, 'dutchHipWidthRatio' | 'dutchWaistLengthRatio'>>): DutchRoofMetrics;
export type SegmentSlopeFrame = {
    /** Horizontal half-span of the primary slope face (eave-to-ridge). */
    run: number;
    /** Vertical height of the primary slope face. */
    rise: number;
    /** tan(pitch). 0 for flat or zero-pitch segments. */
    tanTheta: number;
    /** cos(pitch). 1 for flat or zero-pitch segments. */
    cosTheta: number;
    /** sin(pitch). 0 for flat or zero-pitch segments. */
    sinTheta: number;
    /** Overall eave-to-peak height of the assembled roof. */
    activeRh: number;
};
/**
 * One stop for the slope math every roof-segment consumer needs. Builds
 * `run`, `rise`, the trig triple, and the overall peak height from the
 * segment's pitch + footprint + roofType. Before this helper existed,
 * the table was duplicated in three places (the brush builder, the
 * skylight surface-frame routine, and the segment-hit raycaster) and
 * silently drifted when a new roof type was added.
 */
export declare function getSegmentSlopeFrame(node: Pick<RoofSegmentNode, 'roofType' | 'pitch' | 'width' | 'depth'> & Partial<ShapeRatios>): SegmentSlopeFrame;
/**
 * The eave-to-peak height of the assembled segment, derived from pitch +
 * footprint + roofType. Replaces the legacy `roofHeight` field on the node.
 */
export declare function getActiveRoofHeight(node: Parameters<typeof getSegmentSlopeFrame>[0]): number;
export type RoofSegmentVisibleTopBounds = {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
};
export declare function getRoofSegmentVisibleTopBounds(segment: RoofSegmentNode): RoofSegmentVisibleTopBounds;
/** Segment-local surface height used by roof accessory placement and hit disambiguation. */
export declare function getRoofSegmentSurfaceY(node: Pick<RoofSegmentNode, 'roofType' | 'width' | 'depth' | 'wallHeight'> & Parameters<typeof getSegmentSlopeFrame>[0], localX: number, localZ: number): number;
export declare function isBandedShedSegment(node: Pick<RoofSegmentNode, 'roofType' | 'arc'>): node is Pick<RoofSegmentNode, 'roofType' | 'arc'> & {
    arc: NonNullable<RoofSegmentNode['arc']>;
};
/**
 * Inverse of `getActiveRoofHeight` — recover the pitch a legacy
 * `roofHeight` value would correspond to. Used by the scene migration.
 * Ratio overrides are optional and default to the shape defaults.
 */
export declare function getPitchFromActiveRoofHeight(input: PitchInputs & {
    roofHeight: number;
}): number;
export type RoofSegmentSurfaceMaterialRole = 'top' | 'edge' | 'wall';
export type RoofSegmentSurfaceMaterialSpec = {
    material?: MaterialSchemaType;
    materialPreset?: string;
};
/**
 * Resolve the segment-level material for one of the three surface roles.
 * Falls back through: role-specific field → catch-all `material`. Pass the
 * parent roof to `parentFallback` when you want the roof's role material
 * to fill in for an unset segment slot — typical from the renderer.
 */
export declare function getEffectiveSegmentSurfaceMaterial(node: RoofSegmentNode, role: RoofSegmentSurfaceMaterialRole, parentFallback?: RoofSegmentSurfaceMaterialSpec): RoofSegmentSurfaceMaterialSpec;
/**
 * Returns true when the segment has any segment-level material override —
 * either the legacy catch-all or any of the three role-specific fields.
 * Used by `RoofRenderer` and `updateMergedRoofGeometry` to decide whether
 * the segment should be drawn as its own mesh or folded into the merged
 * shell.
 */
export declare function hasSegmentMaterialOverride(node: RoofSegmentNode): boolean;
export {};
//# sourceMappingURL=roof-segment.d.ts.map