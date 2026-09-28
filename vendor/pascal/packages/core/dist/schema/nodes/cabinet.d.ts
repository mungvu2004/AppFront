import { z } from 'zod';
export declare const CabinetFrontStyleSchema: z.ZodEnum<{
    slab: "slab";
    shaker: "shaker";
    "raised-arch": "raised-arch";
}>;
export declare const CabinetTopFinishSchema: z.ZodEnum<{
    trim: "trim";
    none: "none";
    "top-cabinet": "top-cabinet";
}>;
/** Canonical metric cabinet family used when no regional profile is selected. */
export declare const CABINET_METRIC_DEFAULTS: {
    readonly depth: 0.6;
    readonly carcassHeight: 0.8;
    readonly plinthHeight: 0.1;
    readonly countertopThickness: 0.02;
};
declare const CabinetCompartment: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"shelf">;
    shelfCount: z.ZodOptional<z.ZodNumber>;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"drawer">;
    drawerCount: z.ZodOptional<z.ZodNumber>;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"door">;
    doorType: z.ZodOptional<z.ZodEnum<{
        glass: "glass";
        double: "double";
        "single-left": "single-left";
        "single-right": "single-right";
    }>>;
    shelfCount: z.ZodOptional<z.ZodNumber>;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"sink">;
    sinkLayout: z.ZodOptional<z.ZodEnum<{
        double: "double";
        single: "single";
        "double-offset": "double-offset";
    }>>;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"oven">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"microwave">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"dishwasher">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    cooktopLayout: z.ZodOptional<z.ZodEnum<{
        "gas-2burner": "gas-2burner";
        "gas-4burner": "gas-4burner";
        "gas-5burner-wok": "gas-5burner-wok";
        "gas-6burner": "gas-6burner";
    }>>;
    cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
    cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
    type: z.ZodLiteral<"cooktop-gas">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    cooktopLayout: z.ZodOptional<z.ZodEnum<{
        "induction-2zone": "induction-2zone";
        "induction-4zone": "induction-4zone";
    }>>;
    cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
    cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
    type: z.ZodLiteral<"cooktop-induction">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"pull-out-pantry">;
    shelfCount: z.ZodOptional<z.ZodNumber>;
    pantryRackStyle: z.ZodOptional<z.ZodEnum<{
        glass: "glass";
        wire: "wire";
        tray: "tray";
    }>>;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"fridge-single">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"fridge-double">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"fridge-top-freezer">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"fridge-bottom-freezer">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"hood-pyramid">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"hood-curved-glass">;
    id: z.ZodString;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>], "type">;
export type CabinetCompartmentSchema = z.infer<typeof CabinetCompartment>;
export declare const CabinetNode: z.ZodObject<{
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
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    carcassHeight: z.ZodDefault<z.ZodNumber>;
    operationState: z.ZodDefault<z.ZodNumber>;
    plinthHeight: z.ZodDefault<z.ZodNumber>;
    toeKickDepth: z.ZodDefault<z.ZodNumber>;
    boardThickness: z.ZodDefault<z.ZodNumber>;
    countertopThickness: z.ZodDefault<z.ZodNumber>;
    countertopOverhang: z.ZodDefault<z.ZodNumber>;
    countertopBackOverhang: z.ZodDefault<z.ZodNumber>;
    withFinishedBack: z.ZodDefault<z.ZodBoolean>;
    frontThickness: z.ZodDefault<z.ZodNumber>;
    frontGap: z.ZodDefault<z.ZodNumber>;
    frontStyle: z.ZodDefault<z.ZodEnum<{
        slab: "slab";
        shaker: "shaker";
        "raised-arch": "raised-arch";
    }>>;
    panelReady: z.ZodDefault<z.ZodBoolean>;
    handleStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        bar: "bar";
        cutout: "cutout";
        hole: "hole";
        knob: "knob";
    }>>;
    handlePosition: z.ZodDefault<z.ZodEnum<{
        center: "center";
        top: "top";
        auto: "auto";
    }>>;
    frontOverlay: z.ZodDefault<z.ZodEnum<{
        inset: "inset";
        full: "full";
    }>>;
    withBottomPanel: z.ZodDefault<z.ZodBoolean>;
    showPlinth: z.ZodDefault<z.ZodBoolean>;
    withCountertop: z.ZodDefault<z.ZodBoolean>;
    material: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        preset: z.ZodOptional<z.ZodCatch<z.ZodEnum<{
            custom: "custom";
            white: "white";
            brick: "brick";
            concrete: "concrete";
            wood: "wood";
            glass: "glass";
            metal: "metal";
            plaster: "plaster";
            tile: "tile";
            marble: "marble";
        }>>>;
        properties: z.ZodOptional<z.ZodObject<{
            color: z.ZodDefault<z.ZodString>;
            roughness: z.ZodDefault<z.ZodNumber>;
            metalness: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            transparent: z.ZodDefault<z.ZodBoolean>;
            side: z.ZodDefault<z.ZodEnum<{
                front: "front";
                back: "back";
                double: "double";
            }>>;
        }, z.core.$strip>>;
        texture: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            repeat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            scale: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    materialPreset: z.ZodOptional<z.ZodString>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    stack: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"shelf">;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"drawer">;
        drawerCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"door">;
        doorType: z.ZodOptional<z.ZodEnum<{
            glass: "glass";
            double: "double";
            "single-left": "single-left";
            "single-right": "single-right";
        }>>;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sink">;
        sinkLayout: z.ZodOptional<z.ZodEnum<{
            double: "double";
            single: "single";
            "double-offset": "double-offset";
        }>>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"oven">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"microwave">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"dishwasher">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        cooktopLayout: z.ZodOptional<z.ZodEnum<{
            "gas-2burner": "gas-2burner";
            "gas-4burner": "gas-4burner";
            "gas-5burner-wok": "gas-5burner-wok";
            "gas-6burner": "gas-6burner";
        }>>;
        cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
        cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
        type: z.ZodLiteral<"cooktop-gas">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        cooktopLayout: z.ZodOptional<z.ZodEnum<{
            "induction-2zone": "induction-2zone";
            "induction-4zone": "induction-4zone";
        }>>;
        cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
        cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
        type: z.ZodLiteral<"cooktop-induction">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"pull-out-pantry">;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        pantryRackStyle: z.ZodOptional<z.ZodEnum<{
            glass: "glass";
            wire: "wire";
            tray: "tray";
        }>>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-single">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-double">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-top-freezer">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-bottom-freezer">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"hood-pyramid">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"hood-curved-glass">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "type">>>;
    id: z.ZodDefault<z.ZodTemplateLiteral<`cabinet_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"cabinet">>;
    runTier: z.ZodDefault<z.ZodEnum<{
        wall: "wall";
        base: "base";
        tall: "tall";
    }>>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    barLedge: z.ZodOptional<z.ZodObject<{
        edge: z.ZodDefault<z.ZodEnum<{
            back: "back";
            right: "right";
            left: "left";
        }>>;
        height: z.ZodDefault<z.ZodNumber>;
        depth: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    withWaterfall: z.ZodDefault<z.ZodBoolean>;
    withFinishedEnds: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const CabinetModuleNode: z.ZodObject<{
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
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    carcassHeight: z.ZodDefault<z.ZodNumber>;
    operationState: z.ZodDefault<z.ZodNumber>;
    plinthHeight: z.ZodDefault<z.ZodNumber>;
    toeKickDepth: z.ZodDefault<z.ZodNumber>;
    boardThickness: z.ZodDefault<z.ZodNumber>;
    countertopThickness: z.ZodDefault<z.ZodNumber>;
    countertopOverhang: z.ZodDefault<z.ZodNumber>;
    countertopBackOverhang: z.ZodDefault<z.ZodNumber>;
    withFinishedBack: z.ZodDefault<z.ZodBoolean>;
    frontThickness: z.ZodDefault<z.ZodNumber>;
    frontGap: z.ZodDefault<z.ZodNumber>;
    frontStyle: z.ZodDefault<z.ZodEnum<{
        slab: "slab";
        shaker: "shaker";
        "raised-arch": "raised-arch";
    }>>;
    panelReady: z.ZodDefault<z.ZodBoolean>;
    handleStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        bar: "bar";
        cutout: "cutout";
        hole: "hole";
        knob: "knob";
    }>>;
    handlePosition: z.ZodDefault<z.ZodEnum<{
        center: "center";
        top: "top";
        auto: "auto";
    }>>;
    frontOverlay: z.ZodDefault<z.ZodEnum<{
        inset: "inset";
        full: "full";
    }>>;
    withBottomPanel: z.ZodDefault<z.ZodBoolean>;
    showPlinth: z.ZodDefault<z.ZodBoolean>;
    withCountertop: z.ZodDefault<z.ZodBoolean>;
    material: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        preset: z.ZodOptional<z.ZodCatch<z.ZodEnum<{
            custom: "custom";
            white: "white";
            brick: "brick";
            concrete: "concrete";
            wood: "wood";
            glass: "glass";
            metal: "metal";
            plaster: "plaster";
            tile: "tile";
            marble: "marble";
        }>>>;
        properties: z.ZodOptional<z.ZodObject<{
            color: z.ZodDefault<z.ZodString>;
            roughness: z.ZodDefault<z.ZodNumber>;
            metalness: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            transparent: z.ZodDefault<z.ZodBoolean>;
            side: z.ZodDefault<z.ZodEnum<{
                front: "front";
                back: "back";
                double: "double";
            }>>;
        }, z.core.$strip>>;
        texture: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            repeat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            scale: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    materialPreset: z.ZodOptional<z.ZodString>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    stack: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"shelf">;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"drawer">;
        drawerCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"door">;
        doorType: z.ZodOptional<z.ZodEnum<{
            glass: "glass";
            double: "double";
            "single-left": "single-left";
            "single-right": "single-right";
        }>>;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sink">;
        sinkLayout: z.ZodOptional<z.ZodEnum<{
            double: "double";
            single: "single";
            "double-offset": "double-offset";
        }>>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"oven">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"microwave">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"dishwasher">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        cooktopLayout: z.ZodOptional<z.ZodEnum<{
            "gas-2burner": "gas-2burner";
            "gas-4burner": "gas-4burner";
            "gas-5burner-wok": "gas-5burner-wok";
            "gas-6burner": "gas-6burner";
        }>>;
        cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
        cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
        type: z.ZodLiteral<"cooktop-gas">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        cooktopLayout: z.ZodOptional<z.ZodEnum<{
            "induction-2zone": "induction-2zone";
            "induction-4zone": "induction-4zone";
        }>>;
        cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
        cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
        type: z.ZodLiteral<"cooktop-induction">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"pull-out-pantry">;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        pantryRackStyle: z.ZodOptional<z.ZodEnum<{
            glass: "glass";
            wire: "wire";
            tray: "tray";
        }>>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-single">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-double">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-top-freezer">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-bottom-freezer">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"hood-pyramid">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"hood-curved-glass">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "type">>>;
    id: z.ZodDefault<z.ZodTemplateLiteral<`cabinet-module_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"cabinet-module">>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    cabinetType: z.ZodDefault<z.ZodEnum<{
        base: "base";
        tall: "tall";
    }>>;
    moduleKind: z.ZodDefault<z.ZodEnum<{
        standard: "standard";
        "corner-filler": "corner-filler";
    }>>;
    openSide: z.ZodOptional<z.ZodEnum<{
        right: "right";
        left: "left";
    }>>;
    cornerShelf: z.ZodOptional<z.ZodBoolean>;
    topFinish: z.ZodDefault<z.ZodEnum<{
        trim: "trim";
        none: "none";
        "top-cabinet": "top-cabinet";
    }>>;
    topFinishHeight: z.ZodDefault<z.ZodNumber>;
    topFinishDepth: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type CabinetNode = z.infer<typeof CabinetNode>;
export type CabinetModuleNode = z.infer<typeof CabinetModuleNode>;
export {};
//# sourceMappingURL=cabinet.d.ts.map