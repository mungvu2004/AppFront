import { z } from 'zod';
/**
 * Material preset name reference
 * @example 'white', 'brick', 'wood', 'glass', 'preview-valid'
 */
export declare const Material: z.ZodOptional<z.ZodString>;
export declare const generateId: <T extends string>(prefix: T) => `${T}_${string}`;
export declare const objectId: <T extends string>(prefix: T) => z.ZodDefault<z.ZodTemplateLiteral<`${`${T}_` extends infer T_1 ? T_1 extends `${T}_` ? T_1 extends string | number | bigint | boolean | null | undefined ? `${T_1 extends infer T_2 ? T_2 extends T_1 ? T_2 extends undefined ? "" : T_2 : never : never}` : T_1 extends z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>> ? `${z.core.output<T_1> extends infer T_3 extends string | number | bigint | boolean | null | undefined ? T_3 extends undefined ? "" : T_3 : never}` : never : never : never}${string}`>>;
export declare const nodeType: <T extends string>(type: T) => z.ZodDefault<z.ZodLiteral<T>>;
export declare const BaseNode: z.ZodObject<{
    object: z.ZodDefault<z.ZodLiteral<"node">>;
    id: z.ZodString;
    type: z.ZodDefault<z.ZodLiteral<"node">>;
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
}, z.core.$strip>;
export type BaseNode = z.infer<typeof BaseNode>;
//# sourceMappingURL=base.d.ts.map