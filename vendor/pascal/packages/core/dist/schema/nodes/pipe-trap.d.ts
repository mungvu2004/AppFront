import { z } from 'zod';
/**
 * DWV trap — the P-trap between a fixture and the waste system. Holds a
 * water seal that blocks sewer gas; every drained fixture has exactly
 * one. Modeled as an explicit fitting (not folded into the fixture) so
 * the trap-arm rule (IPC 909.1 max developed length to the vent) has a
 * node to attach to and the inspector can edit size + arm length.
 *
 * Local-frame convention (before `rotation`): inlet faces +Y (up, to
 * the fixture tailpiece), outlet faces +X (the horizontal trap arm
 * toward the vented waste line).
 */
export declare const PipeTrapNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`pipe-trap_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"pipe-trap">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    diameter: z.ZodDefault<z.ZodNumber>;
    pipeMaterial: z.ZodDefault<z.ZodEnum<{
        abs: "abs";
        pvc: "pvc";
        "cast-iron": "cast-iron";
    }>>;
    armLengthM: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type PipeTrapNode = z.infer<typeof PipeTrapNode>;
export type PipeTrapNodeId = PipeTrapNode['id'];
//# sourceMappingURL=pipe-trap.d.ts.map