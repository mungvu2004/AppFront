import { z } from 'zod';
export declare const ImportedMeshPrimitive: z.ZodObject<{
    positions: z.ZodArray<z.ZodNumber>;
    normals: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    indices: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
    color: z.ZodDefault<z.ZodString>;
    opacity: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type ImportedMeshPrimitive = z.infer<typeof ImportedMeshPrimitive>;
/** Triangle geometry retained when an import has no native Pascal shape. */
export declare const ImportedMeshNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`imesh_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"imported-mesh">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    primitives: z.ZodDefault<z.ZodArray<z.ZodObject<{
        positions: z.ZodArray<z.ZodNumber>;
        normals: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        indices: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
        color: z.ZodDefault<z.ZodString>;
        opacity: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ImportedMeshNode = z.infer<typeof ImportedMeshNode>;
//# sourceMappingURL=imported-mesh.d.ts.map