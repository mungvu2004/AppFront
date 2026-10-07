import { z } from 'zod';
export declare const ChimneyMaterialRole: z.ZodEnum<{
    body: "body";
    top: "top";
}>;
export type ChimneyMaterialRole = z.infer<typeof ChimneyMaterialRole>;
export declare const ChimneyNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`chimney_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"chimney">>;
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
    topMaterial: z.ZodOptional<z.ZodObject<{
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
    topMaterialPreset: z.ZodOptional<z.ZodString>;
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    bodyShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        square: "square";
    }>>;
    bodyHollowDepth: z.ZodDefault<z.ZodNumber>;
    bodyHollowMargin: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    heightAboveRidge: z.ZodDefault<z.ZodNumber>;
    cutoutOffset: z.ZodDefault<z.ZodNumber>;
    cornerBevel: z.ZodDefault<z.ZodNumber>;
    cap: z.ZodDefault<z.ZodBoolean>;
    capShape: z.ZodDefault<z.ZodEnum<{
        flat: "flat";
        none: "none";
        stepped: "stepped";
        sloped: "sloped";
    }>>;
    capOverhang: z.ZodDefault<z.ZodNumber>;
    capThickness: z.ZodDefault<z.ZodNumber>;
    flueCount: z.ZodDefault<z.ZodNumber>;
    flueShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        square: "square";
    }>>;
    flueHeight: z.ZodDefault<z.ZodNumber>;
    flueDiameter: z.ZodDefault<z.ZodNumber>;
    flueSpacing: z.ZodDefault<z.ZodNumber>;
    flueWallThickness: z.ZodDefault<z.ZodNumber>;
    shoulderStyle: z.ZodDefault<z.ZodEnum<{
        tapered: "tapered";
        none: "none";
        corbeled: "corbeled";
    }>>;
    shoulderHeight: z.ZodDefault<z.ZodNumber>;
    shoulderExtent: z.ZodDefault<z.ZodNumber>;
    bandStyle: z.ZodDefault<z.ZodEnum<{
        double: "double";
        none: "none";
        single: "single";
    }>>;
    bandHeight: z.ZodDefault<z.ZodNumber>;
    bandExtent: z.ZodDefault<z.ZodNumber>;
    bandOffset: z.ZodDefault<z.ZodNumber>;
    cricketStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        simple: "simple";
    }>>;
    cricketLength: z.ZodDefault<z.ZodNumber>;
    cricketHeight: z.ZodDefault<z.ZodNumber>;
    cricketSide: z.ZodDefault<z.ZodEnum<{
        front: "front";
        back: "back";
    }>>;
    panelStyle: z.ZodDefault<z.ZodEnum<{
        rectangular: "rectangular";
        none: "none";
    }>>;
    panelDepth: z.ZodDefault<z.ZodNumber>;
    panelHeight: z.ZodDefault<z.ZodNumber>;
    panelOffsetTop: z.ZodDefault<z.ZodNumber>;
    panelMargin: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type ChimneyNode = z.infer<typeof ChimneyNode>;
//# sourceMappingURL=chimney.d.ts.map