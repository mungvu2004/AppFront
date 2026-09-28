import { z } from 'zod';
/**
 * Refrigerant lineset — the copper pipe pair that links the outdoor
 * condenser to the indoor coil (furnace / air handler) of a split system.
 * It is the refrigerant-side analogue of a duct run: a polyline of points,
 * but carrying two lines instead of one airway.
 *
 * Real linesets run a fat insulated SUCTION line (cool vapour back to the
 * compressor) beside a thin bare LIQUID line (warm liquid out to the coil).
 * The geometry builder draws a single copper line on the path centerline
 * (sized to `suctionDiameter`, wrapped in a foam jacket when `insulated`);
 * draw the liquid line as a second lineset rather than both off one path.
 *
 * Path coordinates are level-local meters: [x, y, z] tuples, same space as
 * duct paths and grid events. Diameters are nominal copper OD in inches.
 */
export declare const LinesetNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`lineset_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"lineset">>;
    path: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    suctionDiameter: z.ZodDefault<z.ZodNumber>;
    liquidDiameter: z.ZodDefault<z.ZodNumber>;
    insulated: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type LinesetNode = z.infer<typeof LinesetNode>;
export type LinesetNodeId = LinesetNode['id'];
//# sourceMappingURL=lineset.d.ts.map