import { z } from 'zod';
/**
 * Duct fitting — the junction pieces that connect round duct segments:
 * elbows (direction change), tees (branch takeoff), reducers (diameter
 * transition).
 *
 * Phase 2 of the HVAC node system. Fittings are the first kind to expose
 * typed ports (`def.ports`) — placement tools snap duct endpoints onto a
 * fitting's collars, and the future system graph walks ports to decide
 * connectivity.
 *
 * `position` is level-local meters; `rotation` is an XYZ euler in radians
 * so a fitting can turn a horizontal run vertical (riser elbows).
 *
 * Local-frame conventions (before `rotation` is applied):
 *   - elbow:   inlet faces -X, outlet turned by `angle` degrees in the
 *              XZ plane (90° → +Z).
 *   - tee:     run along the X axis (ports face -X and +X), branch
 *              collar at `branchAngle`° from the +X (outlet) axis in the
 *              XZ plane — 90° a square straight tee, <90° a lateral
 *              leaning downstream toward the outlet, >90° leaning upstream
 *              toward the inlet — sized at `diameter2`.
 *   - cross:   four-way junction — run along the X axis (ports face -X
 *              and +X) at the run profile, two opposed branches square to
 *              the run along ±Z (branch faces +Z, branch2 faces -Z) at the
 *              branch profile (`shape2` / `diameter2`).
 *   - reducer: inlet at `diameter` faces -X, outlet at `diameter2`
 *              faces +X.
 *   - transition: square-to-round — rect end at `width` × `height` faces
 *              -X, round end at `diameter2` faces +X. `diameter` carries
 *              the rect end's area-equivalent round size.
 */
export declare const DuctFittingNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`duct-fitting_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"duct-fitting">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    fittingType: z.ZodDefault<z.ZodEnum<{
        elbow: "elbow";
        tee: "tee";
        cross: "cross";
        reducer: "reducer";
        transition: "transition";
        "end-cap": "end-cap";
        damper: "damper";
        "access-panel": "access-panel";
        coupling: "coupling";
    }>>;
    shape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    inletShape: z.ZodOptional<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    outletShape: z.ZodOptional<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    shape2: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    width2: z.ZodDefault<z.ZodNumber>;
    height2: z.ZodDefault<z.ZodNumber>;
    angle: z.ZodDefault<z.ZodNumber>;
    branchAngle: z.ZodDefault<z.ZodNumber>;
    diameter: z.ZodDefault<z.ZodNumber>;
    diameter2: z.ZodDefault<z.ZodNumber>;
    ductMaterial: z.ZodDefault<z.ZodEnum<{
        "sheet-metal": "sheet-metal";
        flex: "flex";
        "duct-board": "duct-board";
    }>>;
    system: z.ZodDefault<z.ZodEnum<{
        supply: "supply";
        return: "return";
    }>>;
    damperAngle: z.ZodDefault<z.ZodNumber>;
    panelWidth: z.ZodDefault<z.ZodNumber>;
    panelHeight: z.ZodDefault<z.ZodNumber>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type DuctFittingNode = z.infer<typeof DuctFittingNode>;
export type DuctFittingNodeId = DuctFittingNode['id'];
//# sourceMappingURL=duct-fitting.d.ts.map