import { z } from 'zod';
export declare const ElevatorDoorStyle: z.ZodEnum<{
    "center-opening": "center-opening";
    "single-left": "single-left";
    "single-right": "single-right";
}>;
export declare const ElevatorDoorPanelStyle: z.ZodEnum<{
    "glass-frame": "glass-frame";
    "solid-panel": "solid-panel";
    "segmented-panel": "segmented-panel";
}>;
export declare const ElevatorShaftStyle: z.ZodEnum<{
    glass: "glass";
    solid: "solid";
}>;
export type ElevatorDoorPanelStyle = z.infer<typeof ElevatorDoorPanelStyle>;
export type ElevatorDoorStyle = z.infer<typeof ElevatorDoorStyle>;
export type ElevatorShaftStyle = z.infer<typeof ElevatorShaftStyle>;
export declare const ElevatorNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`elevator_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"elevator">>;
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
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    shaftWidth: z.ZodOptional<z.ZodNumber>;
    shaftDepth: z.ZodOptional<z.ZodNumber>;
    shaftWallThickness: z.ZodDefault<z.ZodNumber>;
    shaftStyle: z.ZodDefault<z.ZodEnum<{
        glass: "glass";
        solid: "solid";
    }>>;
    cabHeight: z.ZodDefault<z.ZodNumber>;
    doorWidth: z.ZodDefault<z.ZodNumber>;
    doorHeight: z.ZodDefault<z.ZodNumber>;
    doorStyle: z.ZodDefault<z.ZodEnum<{
        "center-opening": "center-opening";
        "single-left": "single-left";
        "single-right": "single-right";
    }>>;
    doorPanelStyle: z.ZodDefault<z.ZodEnum<{
        "glass-frame": "glass-frame";
        "solid-panel": "solid-panel";
        "segmented-panel": "segmented-panel";
    }>>;
    fromLevelId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    toLevelId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    servedLevelIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    disabledLevelIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    serviceOnlyLevelIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    defaultLevelId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    speed: z.ZodDefault<z.ZodNumber>;
    doorDurationMs: z.ZodDefault<z.ZodNumber>;
    dwellMs: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type ElevatorNode = z.infer<typeof ElevatorNode>;
//# sourceMappingURL=elevator.d.ts.map