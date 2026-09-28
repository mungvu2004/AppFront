import { z } from 'zod';
/**
 * Duct terminal — where the air loop meets the room: supply registers,
 * ceiling diffusers, return grilles.
 *
 * Phase 3 of the HVAC node system. Each terminal exposes a single typed
 * port at its collar (behind/above/below the face depending on mount),
 * so duct runs end onto it like any other port.
 *
 * `position` is the center of the visible face in level-local meters —
 * floor registers at y≈0, ceiling diffusers at ceiling height, wall
 * registers at their height on the wall. `rotation` is yaw radians.
 */
export declare const DuctTerminalNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`duct-terminal_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"duct-terminal">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    terminalType: z.ZodDefault<z.ZodEnum<{
        "supply-register": "supply-register";
        diffuser: "diffuser";
        "return-grille": "return-grille";
    }>>;
    mount: z.ZodDefault<z.ZodEnum<{
        wall: "wall";
        ceiling: "ceiling";
        floor: "floor";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    collarShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    collarDiameter: z.ZodDefault<z.ZodNumber>;
    collarWidth: z.ZodDefault<z.ZodNumber>;
    collarHeight: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type DuctTerminalNode = z.infer<typeof DuctTerminalNode>;
export type DuctTerminalNodeId = DuctTerminalNode['id'];
//# sourceMappingURL=duct-terminal.d.ts.map