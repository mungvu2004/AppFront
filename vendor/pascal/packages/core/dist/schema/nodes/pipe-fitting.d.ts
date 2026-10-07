import { z } from 'zod';
/**
 * DWV pipe fitting — the joints drain systems are actually built from:
 * elbows (bends), wyes (45° branch entries, the code-preferred way to
 * join horizontal drains), sanitary tees (square branch entries), and
 * crosses (two opposed branches where a run passes straight through).
 *
 * Local-frame conventions (before `rotation`):
 *   - elbow:        inlet faces -X, outlet turned `angle`° in XZ.
 *   - wye:          run along X (inlet -X, outlet +X), branch collar at
 *                   45° between +X and +Z.
 *   - sanitary-tee: run along X, branch collar faces +Z.
 *   - cross:        run along X, two opposed branch collars on ±Z.
 */
export declare const PipeFittingNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`pipe-fitting_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"pipe-fitting">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    fittingType: z.ZodDefault<z.ZodEnum<{
        elbow: "elbow";
        cross: "cross";
        reducer: "reducer";
        "end-cap": "end-cap";
        coupling: "coupling";
        wye: "wye";
        "sanitary-tee": "sanitary-tee";
        cleanout: "cleanout";
    }>>;
    angle: z.ZodDefault<z.ZodNumber>;
    diameter: z.ZodDefault<z.ZodNumber>;
    diameter2: z.ZodDefault<z.ZodNumber>;
    cleanoutStyle: z.ZodDefault<z.ZodEnum<{
        end: "end";
        inline: "inline";
    }>>;
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
export type PipeFittingNode = z.infer<typeof PipeFittingNode>;
export type PipeFittingNodeId = PipeFittingNode['id'];
//# sourceMappingURL=pipe-fitting.d.ts.map