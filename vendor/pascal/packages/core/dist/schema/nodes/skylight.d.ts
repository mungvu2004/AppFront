import { z } from 'zod';
export declare const SkylightMaterialRole: z.ZodEnum<{
    glass: "glass";
    frame: "frame";
}>;
export type SkylightMaterialRole = z.infer<typeof SkylightMaterialRole>;
export declare const SKYLIGHT_TYPE_ORDER: readonly ["flat", "walk-on", "lantern", "opening", "sliding"];
export declare const SkylightType: z.ZodEnum<{
    flat: "flat";
    sliding: "sliding";
    opening: "opening";
    "walk-on": "walk-on";
    lantern: "lantern";
}>;
export type SkylightType = (typeof SKYLIGHT_TYPE_ORDER)[number];
export declare const SkylightOpeningSide: z.ZodEnum<{
    top: "top";
    right: "right";
    left: "left";
    bottom: "bottom";
}>;
export type SkylightOpeningSide = z.infer<typeof SkylightOpeningSide>;
export declare const SkylightSlideDirection: z.ZodEnum<{
    x: "x";
    z: "z";
}>;
export type SkylightSlideDirection = z.infer<typeof SkylightSlideDirection>;
export type SkylightTypePreset = {
    label: string;
    width: number;
    height: number;
    frameThickness: number;
    frameDepth: number;
    glassThickness: number;
    curb: boolean;
    curbHeight: number;
    cutoutOffset: number;
    lanternHeight: number;
    lanternTopScale: number;
    openingAngle: number;
    openingSide: SkylightOpeningSide;
    operationState: number;
    motorHousing: boolean;
    slideFraction: number;
    slideDirection: SkylightSlideDirection;
    trackWidth: number;
    motorHousingSize: number;
};
export declare const SKYLIGHT_TYPE_PRESETS: {
    readonly flat: {
        readonly label: "Flat roof skylight";
        readonly width: 0.9;
        readonly height: 1.2;
        readonly frameThickness: 0.055;
        readonly frameDepth: 0.08;
        readonly glassThickness: 0.012;
        readonly curb: true;
        readonly curbHeight: 0.08;
        readonly cutoutOffset: 0;
        readonly lanternHeight: 0.25;
        readonly lanternTopScale: 0;
        readonly openingAngle: 0;
        readonly openingSide: "top";
        readonly operationState: 0;
        readonly motorHousing: false;
        readonly slideFraction: 0;
        readonly slideDirection: "z";
        readonly trackWidth: 0.04;
        readonly motorHousingSize: 0.08;
    };
    readonly 'walk-on': {
        readonly label: "Walk-on rooflight";
        readonly width: 1.2;
        readonly height: 1.8;
        readonly frameThickness: 0.035;
        readonly frameDepth: 0.045;
        readonly glassThickness: 0.04;
        readonly curb: false;
        readonly curbHeight: 0;
        readonly cutoutOffset: 0;
        readonly lanternHeight: 0.25;
        readonly lanternTopScale: 0;
        readonly openingAngle: 0;
        readonly openingSide: "top";
        readonly operationState: 0;
        readonly motorHousing: false;
        readonly slideFraction: 0;
        readonly slideDirection: "z";
        readonly trackWidth: 0.04;
        readonly motorHousingSize: 0.08;
    };
    readonly lantern: {
        readonly label: "Roof lantern";
        readonly width: 1.4;
        readonly height: 1.4;
        readonly frameThickness: 0.06;
        readonly frameDepth: 0.08;
        readonly glassThickness: 0.012;
        readonly curb: true;
        readonly curbHeight: 0.16;
        readonly cutoutOffset: 0;
        readonly lanternHeight: 0.45;
        readonly lanternTopScale: 0;
        readonly openingAngle: 0;
        readonly openingSide: "top";
        readonly operationState: 0;
        readonly motorHousing: false;
        readonly slideFraction: 0;
        readonly slideDirection: "z";
        readonly trackWidth: 0.04;
        readonly motorHousingSize: 0.08;
    };
    readonly opening: {
        readonly label: "Opening skylight";
        readonly width: 0.9;
        readonly height: 1.2;
        readonly frameThickness: 0.06;
        readonly frameDepth: 0.035;
        readonly glassThickness: 0.014;
        readonly curb: true;
        readonly curbHeight: 0.1;
        readonly cutoutOffset: 0;
        readonly lanternHeight: 0.25;
        readonly lanternTopScale: 0;
        readonly openingAngle: number;
        readonly openingSide: "top";
        readonly operationState: 1;
        readonly motorHousing: false;
        readonly slideFraction: 0;
        readonly slideDirection: "z";
        readonly trackWidth: 0.04;
        readonly motorHousingSize: 0.08;
    };
    readonly sliding: {
        readonly label: "Sliding skylight";
        readonly width: 1.4;
        readonly height: 1.1;
        readonly frameThickness: 0.055;
        readonly frameDepth: 0.08;
        readonly glassThickness: 0.012;
        readonly curb: true;
        readonly curbHeight: 0.08;
        readonly cutoutOffset: 0;
        readonly lanternHeight: 0.25;
        readonly lanternTopScale: 0;
        readonly openingAngle: 0;
        readonly openingSide: "top";
        readonly operationState: 0.35;
        readonly motorHousing: false;
        readonly slideFraction: 0.35;
        readonly slideDirection: "x";
        readonly trackWidth: 0.045;
        readonly motorHousingSize: 0.08;
    };
};
export declare const SkylightNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`skylight_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"skylight">>;
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
    glassMaterial: z.ZodOptional<z.ZodObject<{
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
    glassMaterialPreset: z.ZodOptional<z.ZodString>;
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    frameThickness: z.ZodDefault<z.ZodNumber>;
    frameDepth: z.ZodDefault<z.ZodNumber>;
    skylightType: z.ZodDefault<z.ZodEnum<{
        flat: "flat";
        sliding: "sliding";
        opening: "opening";
        "walk-on": "walk-on";
        lantern: "lantern";
    }>>;
    glassThickness: z.ZodDefault<z.ZodNumber>;
    lanternHeight: z.ZodDefault<z.ZodNumber>;
    lanternTopScale: z.ZodDefault<z.ZodNumber>;
    openingAngle: z.ZodDefault<z.ZodNumber>;
    openingSide: z.ZodDefault<z.ZodEnum<{
        top: "top";
        right: "right";
        left: "left";
        bottom: "bottom";
    }>>;
    operationState: z.ZodDefault<z.ZodNumber>;
    motorHousing: z.ZodDefault<z.ZodBoolean>;
    slideFraction: z.ZodDefault<z.ZodNumber>;
    slideDirection: z.ZodDefault<z.ZodEnum<{
        x: "x";
        z: "z";
    }>>;
    trackWidth: z.ZodDefault<z.ZodNumber>;
    motorHousingSize: z.ZodDefault<z.ZodNumber>;
    curb: z.ZodDefault<z.ZodBoolean>;
    curbHeight: z.ZodDefault<z.ZodNumber>;
    cutoutOffset: z.ZodDefault<z.ZodNumber>;
    surfaceNormal: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strip>;
export type SkylightNode = z.infer<typeof SkylightNode>;
//# sourceMappingURL=skylight.d.ts.map