import { z } from 'zod';
export declare const ZoneNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`zone_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"zone">>;
    name: z.ZodString;
    polygon: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    autoFromWalls: z.ZodDefault<z.ZodBoolean>;
    boundaryWallIds: z.ZodDefault<z.ZodArray<z.ZodDefault<z.ZodTemplateLiteral<`wall_${string}`>>>>;
    spaceRole: z.ZodDefault<z.ZodEnum<{
        generic: "generic";
        room: "room";
    }>>;
    roomNumber: z.ZodDefault<z.ZodString>;
    enclosureStatus: z.ZodDefault<z.ZodEnum<{
        auto: "auto";
        open: "open";
        enclosed: "enclosed";
    }>>;
    floorFinish: z.ZodDefault<z.ZodString>;
    wallFinish: z.ZodDefault<z.ZodString>;
    ceilingFinish: z.ZodDefault<z.ZodString>;
    ceilingHeight: z.ZodDefault<z.ZodNumber>;
    occupancy: z.ZodDefault<z.ZodString>;
    clearDimensionPolicy: z.ZodDefault<z.ZodEnum<{
        none: "none";
        "inside-faces": "inside-faces";
        "finish-faces": "finish-faces";
    }>>;
    color: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type ZoneNode = z.infer<typeof ZoneNode>;
//# sourceMappingURL=zone.d.ts.map