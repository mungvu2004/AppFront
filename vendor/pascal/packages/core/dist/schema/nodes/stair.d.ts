import { z } from 'zod';
import type { MaterialSchema as MaterialSchemaType } from '../material.js';
export declare const StairRailingMode: z.ZodEnum<{
    right: "right";
    left: "left";
    none: "none";
    both: "both";
}>;
/**
 * How a straight flight's guard is built: 'balusters' — the round baluster
 * at every nosing with two round rails (the original); 'post-and-rail' —
 * the way a deck stair is built: 4x4 posts no more than 4 ft apart (two on a
 * short flight), a top rail and a bottom rail following the flight, 1½ in
 * pickets between them at a 4 in-sphere gap (IRC R312.1.3); 'cable' — the
 * same posts as 2 in slim posts, a flat cap rail, and ½ in cables 3 in apart
 * running with the flight (the modern deck's cable rail).
 */
export declare const StairRailingStyle: z.ZodEnum<{
    balusters: "balusters";
    cable: "cable";
    boards: "boards";
    "post-and-rail": "post-and-rail";
}>;
export declare const StairType: z.ZodEnum<{
    straight: "straight";
    spiral: "spiral";
    curved: "curved";
}>;
export declare const StairTopLandingMode: z.ZodEnum<{
    none: "none";
    integrated: "integrated";
}>;
export declare const StairSlabOpeningMode: z.ZodEnum<{
    none: "none";
    destination: "destination";
}>;
export type StairRailingMode = z.infer<typeof StairRailingMode>;
export type StairRailingStyle = z.infer<typeof StairRailingStyle>;
export type StairType = z.infer<typeof StairType>;
export type StairTopLandingMode = z.infer<typeof StairTopLandingMode>;
export type StairSlabOpeningMode = z.infer<typeof StairSlabOpeningMode>;
export type StairSurfaceMaterialRole = 'railing' | 'tread' | 'side';
export type StairSurfaceMaterialSpec = {
    material?: MaterialSchemaType;
    materialPreset?: string;
};
export declare const StairNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`stair_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"stair">>;
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
    railingMaterial: z.ZodOptional<z.ZodObject<{
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
    railingMaterialPreset: z.ZodOptional<z.ZodString>;
    treadMaterial: z.ZodOptional<z.ZodObject<{
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
    treadMaterialPreset: z.ZodOptional<z.ZodString>;
    sideMaterial: z.ZodOptional<z.ZodObject<{
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
    sideMaterialPreset: z.ZodOptional<z.ZodString>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    stairType: z.ZodDefault<z.ZodEnum<{
        straight: "straight";
        spiral: "spiral";
        curved: "curved";
    }>>;
    fromLevelId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    toLevelId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    deckSlabId: z.ZodOptional<z.ZodString>;
    slabOpeningMode: z.ZodDefault<z.ZodEnum<{
        none: "none";
        destination: "destination";
    }>>;
    openingOffset: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    totalRise: z.ZodOptional<z.ZodNumber>;
    stepCount: z.ZodDefault<z.ZodNumber>;
    thickness: z.ZodDefault<z.ZodNumber>;
    fillToFloor: z.ZodDefault<z.ZodBoolean>;
    innerRadius: z.ZodDefault<z.ZodNumber>;
    sweepAngle: z.ZodDefault<z.ZodNumber>;
    topLandingMode: z.ZodDefault<z.ZodEnum<{
        none: "none";
        integrated: "integrated";
    }>>;
    topLandingDepth: z.ZodDefault<z.ZodNumber>;
    showCenterColumn: z.ZodDefault<z.ZodBoolean>;
    showStepSupports: z.ZodDefault<z.ZodBoolean>;
    railingMode: z.ZodDefault<z.ZodEnum<{
        right: "right";
        left: "left";
        none: "none";
        both: "both";
    }>>;
    railingHeight: z.ZodDefault<z.ZodNumber>;
    railingStyle: z.ZodOptional<z.ZodEnum<{
        balusters: "balusters";
        cable: "cable";
        boards: "boards";
        "post-and-rail": "post-and-rail";
    }>>;
    railingTopPost: z.ZodOptional<z.ZodBoolean>;
    railingTopReach: z.ZodOptional<z.ZodNumber>;
    railingPostThrough: z.ZodOptional<z.ZodBoolean>;
    children: z.ZodDefault<z.ZodArray<z.ZodDefault<z.ZodTemplateLiteral<`sseg_${string}`>>>>;
}, z.core.$strip>;
export type StairNode = z.infer<typeof StairNode>;
export declare function getEffectiveStairSurfaceMaterial(node: StairNode, role: StairSurfaceMaterialRole): StairSurfaceMaterialSpec;
//# sourceMappingURL=stair.d.ts.map