import { z } from 'zod';
/**
 * DWV pipe segment — drain / waste / vent runs in US residential
 * plumbing. Phase 2 of the distribution-system effort: the plumbing
 * sibling of `duct-segment`, sharing the polyline model and the typed
 * port machinery.
 *
 * The defining difference from ducts is SLOPE: drains must fall
 * (IPC: ¼" per foot for pipes under 3", ⅛" allowed at 3"+). Slope is
 * stored implicitly in the path's Y coordinates — the draw tool drops
 * Y as you draw a waste run; vents run level or vertical.
 *
 * Path coordinates are level-local meters. Y may be negative (drains
 * drop below the floor into the joist / crawl space).
 */
export declare const PipeSegmentNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`pipe-segment_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"pipe-segment">>;
    path: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    autoHangers: z.ZodOptional<z.ZodBoolean>;
    hangerOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        fraction: z.ZodOptional<z.ZodNumber>;
        skipped: z.ZodOptional<z.ZodBoolean>;
        hostId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    hangerStyle: z.ZodOptional<z.ZodEnum<{
        double: "double";
        single: "single";
    }>>;
    hangerSpacing: z.ZodOptional<z.ZodNumber>;
    hangerMaxReach: z.ZodOptional<z.ZodNumber>;
    wallAttachment: z.ZodOptional<z.ZodObject<{
        wallId: z.ZodDefault<z.ZodTemplateLiteral<`wall_${string}`>>;
        side: z.ZodEnum<{
            front: "front";
            back: "back";
        }>;
        startUV: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        endUV: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        offset: z.ZodNumber;
    }, z.core.$strip>>;
    diameter: z.ZodDefault<z.ZodNumber>;
    pipeMaterial: z.ZodDefault<z.ZodEnum<{
        abs: "abs";
        pvc: "pvc";
        "cast-iron": "cast-iron";
    }>>;
    system: z.ZodDefault<z.ZodEnum<{
        waste: "waste";
        vent: "vent";
    }>>;
}, z.core.$strip>;
export type PipeSegmentNode = z.infer<typeof PipeSegmentNode>;
export type PipeSegmentNodeId = PipeSegmentNode['id'];
//# sourceMappingURL=pipe-segment.d.ts.map