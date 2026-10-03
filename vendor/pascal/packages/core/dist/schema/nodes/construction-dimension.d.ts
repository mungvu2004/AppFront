import { z } from 'zod';
export declare const ConstructionDimensionBaseline: z.ZodObject<{
    origin: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    direction: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strip>;
export declare const ConstructionDimensionChainMode: z.ZodEnum<{
    "point-to-point": "point-to-point";
    continuous: "continuous";
}>;
export declare const ConstructionDimensionMode: z.ZodEnum<{
    radius: "radius";
    linear: "linear";
    diameter: "diameter";
    "center-mark": "center-mark";
    chord: "chord";
    "arc-length": "arc-length";
    angular: "angular";
    coordinate: "coordinate";
}>;
export declare const ConstructionDrawingType: z.ZodEnum<{
    "floor-plan": "floor-plan";
    "foundation-plan": "foundation-plan";
    "reflected-ceiling-plan": "reflected-ceiling-plan";
    "roof-plan": "roof-plan";
    "site-plan": "site-plan";
}>;
export declare const ConstructionDimensionDrawingPresentation: z.ZodEnum<{
    shown: "shown";
    omit: "omit";
    controlled: "controlled";
}>;
export declare const ConstructionDimensionDrawingOverride: z.ZodObject<{
    drawingType: z.ZodEnum<{
        "floor-plan": "floor-plan";
        "foundation-plan": "foundation-plan";
        "reflected-ceiling-plan": "reflected-ceiling-plan";
        "roof-plan": "roof-plan";
        "site-plan": "site-plan";
    }>;
    presentation: z.ZodEnum<{
        shown: "shown";
        omit: "omit";
        controlled: "controlled";
    }>;
    suppressedSegmentIndexes: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
}, z.core.$strip>;
export declare const ConstructionDimensionDatumPolicy: z.ZodEnum<{
    centerline: "centerline";
    "wall-face": "wall-face";
    "structural-face": "structural-face";
    "finish-face": "finish-face";
}>;
export declare const ConstructionDimensionTerminator: z.ZodEnum<{
    "architectural-tick": "architectural-tick";
    "filled-arrow": "filled-arrow";
    "open-arrow": "open-arrow";
    dot: "dot";
}>;
export declare const ConstructionDimensionTextPosition: z.ZodEnum<{
    above: "above";
    centered: "centered";
}>;
export declare const ConstructionDimensionImperialPrecision: z.ZodEnum<{
    1: "1";
    "1/2": "1/2";
    "1/4": "1/4";
    "1/8": "1/8";
    "1/16": "1/16";
}>;
export declare const ConstructionDimensionMetricNotation: z.ZodEnum<{
    meters: "meters";
    millimeters: "millimeters";
}>;
export declare const ConstructionDimensionNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`construction-dimension_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"construction-dimension">>;
    anchors: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
        kind: z.ZodLiteral<"feature">;
        reference: z.ZodObject<{
            nodeId: z.ZodString;
            featureId: z.ZodString;
            parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
        }, z.core.$strip>;
        fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    }, z.core.$strip>]>>>;
    baseline: z.ZodDefault<z.ZodObject<{
        origin: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        direction: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strip>>;
    chainMode: z.ZodDefault<z.ZodEnum<{
        "point-to-point": "point-to-point";
        continuous: "continuous";
    }>>;
    mode: z.ZodDefault<z.ZodEnum<{
        radius: "radius";
        linear: "linear";
        diameter: "diameter";
        "center-mark": "center-mark";
        chord: "chord";
        "arc-length": "arc-length";
        angular: "angular";
        coordinate: "coordinate";
    }>>;
    featureCount: z.ZodDefault<z.ZodNumber>;
    showCenterMark: z.ZodDefault<z.ZodBoolean>;
    prefix: z.ZodDefault<z.ZodString>;
    suffix: z.ZodDefault<z.ZodString>;
    textOverride: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    datumPolicy: z.ZodDefault<z.ZodEnum<{
        centerline: "centerline";
        "wall-face": "wall-face";
        "structural-face": "structural-face";
        "finish-face": "finish-face";
    }>>;
    terminator: z.ZodDefault<z.ZodEnum<{
        "architectural-tick": "architectural-tick";
        "filled-arrow": "filled-arrow";
        "open-arrow": "open-arrow";
        dot: "dot";
    }>>;
    textPosition: z.ZodDefault<z.ZodEnum<{
        above: "above";
        centered: "centered";
    }>>;
    imperialPrecision: z.ZodDefault<z.ZodEnum<{
        1: "1";
        "1/2": "1/2";
        "1/4": "1/4";
        "1/8": "1/8";
        "1/16": "1/16";
    }>>;
    metricNotation: z.ZodDefault<z.ZodEnum<{
        meters: "meters";
        millimeters: "millimeters";
    }>>;
    extensionStartGap: z.ZodDefault<z.ZodNumber>;
    extensionOvershoot: z.ZodDefault<z.ZodNumber>;
    drawingType: z.ZodDefault<z.ZodEnum<{
        "floor-plan": "floor-plan";
        "foundation-plan": "foundation-plan";
        "reflected-ceiling-plan": "reflected-ceiling-plan";
        "roof-plan": "roof-plan";
        "site-plan": "site-plan";
    }>>;
    drawingOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        drawingType: z.ZodEnum<{
            "floor-plan": "floor-plan";
            "foundation-plan": "foundation-plan";
            "reflected-ceiling-plan": "reflected-ceiling-plan";
            "roof-plan": "roof-plan";
            "site-plan": "site-plan";
        }>;
        presentation: z.ZodEnum<{
            shown: "shown";
            omit: "omit";
            controlled: "controlled";
        }>;
        suppressedSegmentIndexes: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>>;
    controllingDimensionId: z.ZodDefault<z.ZodNullable<z.ZodDefault<z.ZodTemplateLiteral<`construction-dimension_${string}`>>>>;
}, z.core.$strip>;
export type ConstructionDimensionBaseline = z.infer<typeof ConstructionDimensionBaseline>;
export type ConstructionDimensionChainMode = z.infer<typeof ConstructionDimensionChainMode>;
export type ConstructionDimensionMode = z.infer<typeof ConstructionDimensionMode>;
export type ConstructionDrawingType = z.infer<typeof ConstructionDrawingType>;
export type ConstructionDimensionDrawingPresentation = z.infer<typeof ConstructionDimensionDrawingPresentation>;
export type ConstructionDimensionDrawingOverride = z.infer<typeof ConstructionDimensionDrawingOverride>;
export type ConstructionDimensionDatumPolicy = z.infer<typeof ConstructionDimensionDatumPolicy>;
export type ConstructionDimensionTerminator = z.infer<typeof ConstructionDimensionTerminator>;
export type ConstructionDimensionTextPosition = z.infer<typeof ConstructionDimensionTextPosition>;
export type ConstructionDimensionImperialPrecision = z.infer<typeof ConstructionDimensionImperialPrecision>;
export type ConstructionDimensionMetricNotation = z.infer<typeof ConstructionDimensionMetricNotation>;
export type ConstructionDimensionNode = z.infer<typeof ConstructionDimensionNode>;
export declare const CONSTRUCTION_DRAWING_TYPES: ("floor-plan" | "foundation-plan" | "reflected-ceiling-plan" | "roof-plan" | "site-plan")[];
export declare function resolveConstructionDimensionDrawingPresentation(node: Pick<ConstructionDimensionNode, 'drawingType' | 'drawingOverrides'>, drawingType: ConstructionDrawingType): ConstructionDimensionDrawingPresentation;
export declare function resolveConstructionDimensionDrawingOverride(node: Pick<ConstructionDimensionNode, 'drawingOverrides'>, drawingType: ConstructionDrawingType): ConstructionDimensionDrawingOverride | null;
export declare function setConstructionDimensionDrawingPresentation(node: Pick<ConstructionDimensionNode, 'drawingType' | 'drawingOverrides'>, drawingType: ConstructionDrawingType, presentation: ConstructionDimensionDrawingPresentation): ConstructionDimensionDrawingOverride[];
export declare function setConstructionDimensionDrawingSuppressedSegments(node: Pick<ConstructionDimensionNode, 'drawingType' | 'drawingOverrides'>, drawingType: ConstructionDrawingType, suppressedSegmentIndexes: readonly number[]): ConstructionDimensionDrawingOverride[];
export declare function constructionDimensionRequiredAnchorCount(mode: ConstructionDimensionMode): number;
//# sourceMappingURL=construction-dimension.d.ts.map