import { z } from 'zod';
export declare const UNIT_KINDS: readonly ["apartment", "hotel-room", "commercial", "common"];
export type UnitKind = (typeof UNIT_KINDS)[number];
export declare const DEFAULT_UNIT_COLOR = "#f59e0b";
export declare const UnitNode: z.ZodObject<{
    object: z.ZodDefault<z.ZodLiteral<"node">>;
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`unit_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"unit">>;
    name: z.ZodDefault<z.ZodString>;
    kind: z.ZodDefault<z.ZodEnum<{
        apartment: "apartment";
        "hotel-room": "hotel-room";
        commercial: "commercial";
        common: "common";
    }>>;
    members: z.ZodDefault<z.ZodArray<z.ZodDefault<z.ZodTemplateLiteral<`zone_${string}`>>>>;
    color: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type UnitNode = z.infer<typeof UnitNode>;
//# sourceMappingURL=unit.d.ts.map