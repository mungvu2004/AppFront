import { z } from 'zod';
/**
 * Standalone refrigerant liquid line — the thin bare-copper line that carries
 * warm liquid out to the indoor coil. It is the line that used to be drawn as
 * the lineset's second rail; broken out here as its own polyline run so it can
 * be drawn on its own, including traced alongside an existing lineset.
 *
 * Path coordinates are level-local meters: [x, y, z] tuples, the same space as
 * lineset and duct paths. Diameter is nominal copper OD in inches.
 */
export declare const LiquidLineNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`liquid-line_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"liquid-line">>;
    path: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    diameter: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type LiquidLineNode = z.infer<typeof LiquidLineNode>;
export type LiquidLineNodeId = LiquidLineNode['id'];
//# sourceMappingURL=liquid-line.d.ts.map