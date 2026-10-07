import { z } from 'zod';
/**
 * HVAC equipment — the boxes duct systems start and end at: furnace,
 * air handler, outdoor condenser.
 *
 * Phase 3 of the HVAC node system. Furnaces and air handlers expose
 * typed duct ports (supply plenum on top, return drop on the side) so
 * duct runs and fittings snap onto them. Every unit also exposes a
 * refrigerant service port on its valve face — a condenser, the outdoor
 * half of a split system, carries no duct ports but pipes to the indoor
 * coil through a `lineset` run mating onto that port.
 *
 * Floor-placed: `position` is level-local meters with y at the base,
 * `rotation` is yaw radians (the editor's default R-rotate applies).
 */
export declare const HvacEquipmentNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`hvac-equipment_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"hvac-equipment">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    equipmentType: z.ZodDefault<z.ZodEnum<{
        furnace: "furnace";
        "air-handler": "air-handler";
        condenser: "condenser";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    supplyShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    returnShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    supplyDiameter: z.ZodDefault<z.ZodNumber>;
    returnDiameter: z.ZodDefault<z.ZodNumber>;
    supplyWidth: z.ZodDefault<z.ZodNumber>;
    supplyHeight: z.ZodDefault<z.ZodNumber>;
    returnWidth: z.ZodDefault<z.ZodNumber>;
    returnHeight: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type HvacEquipmentNode = z.infer<typeof HvacEquipmentNode>;
export type HvacEquipmentNodeId = HvacEquipmentNode['id'];
//# sourceMappingURL=hvac-equipment.d.ts.map