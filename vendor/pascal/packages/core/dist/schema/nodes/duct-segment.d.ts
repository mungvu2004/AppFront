import { z } from 'zod';
/**
 * Round duct segment — a polyline of 3D points connected by cylindrical
 * duct sections. Forced-air HVAC supply/return runs in US residential.
 *
 * Phase 1 of the HVAC node system: just the geometry primitive. Fittings,
 * terminals, equipment, and typed ports come in later slices.
 *
 * Path coordinates are level-local meters: [x, y, z] tuples. y is height
 * above the level floor. A duct hung at ceiling height through three points
 * is e.g. `[[0, 2.6, 0], [3, 2.6, 0], [3, 2.6, 4]]`.
 *
 * Diameters are nominal US round-duct sizes in inches; the geometry
 * builder converts to meters for the cylinder radius.
 */
export declare const DuctSegmentNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`duct-segment_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"duct-segment">>;
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
    shape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    diameter: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    roll: z.ZodDefault<z.ZodNumber>;
    ductMaterial: z.ZodDefault<z.ZodEnum<{
        spiral: "spiral";
        "sheet-metal": "sheet-metal";
        flex: "flex";
        "duct-board": "duct-board";
    }>>;
    seamDetail: z.ZodDefault<z.ZodBoolean>;
    insulated: z.ZodDefault<z.ZodBoolean>;
    insulationR: z.ZodDefault<z.ZodNumber>;
    system: z.ZodDefault<z.ZodEnum<{
        supply: "supply";
        return: "return";
    }>>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type DuctSegmentNode = z.infer<typeof DuctSegmentNode>;
export type DuctSegmentNodeId = DuctSegmentNode['id'];
//# sourceMappingURL=duct-segment.d.ts.map