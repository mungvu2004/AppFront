import { z } from 'zod';
import type { MaterialSchema as MaterialSchemaType } from '../material.js';
export type RoofSurfaceMaterialRole = 'top' | 'edge' | 'wall';
export type RoofSurfaceMaterialSpec = {
    material?: MaterialSchemaType;
    materialPreset?: string;
};
export declare const RoofSupport: z.ZodDefault<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"level">;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"walls">;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"roof">;
    roofSegmentId: z.ZodDefault<z.ZodTemplateLiteral<`rseg_${string}`>>;
    localPosition: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    curbHeight: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>], "kind">>;
export type RoofSupport = z.infer<typeof RoofSupport>;
export declare const RoofNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`roof_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"roof">>;
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
    edgeMaterial: z.ZodOptional<z.ZodObject<{
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
    edgeMaterialPreset: z.ZodOptional<z.ZodString>;
    wallMaterial: z.ZodOptional<z.ZodObject<{
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
    wallMaterialPreset: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    support: z.ZodDefault<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"level">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"walls">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"roof">;
        roofSegmentId: z.ZodDefault<z.ZodTemplateLiteral<`rseg_${string}`>>;
        localPosition: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        curbHeight: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>], "kind">>;
    assembly: z.ZodOptional<z.ZodObject<{
        layers: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            role: z.ZodEnum<{
                fill: "fill";
                finish: "finish";
                lining: "lining";
                substrate: "substrate";
                sheathing: "sheathing";
                membrane: "membrane";
                underlay: "underlay";
                insulation: "insulation";
                air: "air";
                furring: "furring";
                structure: "structure";
                deck: "deck";
                covering: "covering";
                shell: "shell";
                glazing: "glazing";
            }>;
            thickness: z.ZodNumber;
            core: z.ZodOptional<z.ZodLiteral<true>>;
            material: z.ZodOptional<z.ZodString>;
            slot: z.ZodOptional<z.ZodString>;
            returns: z.ZodOptional<z.ZodBoolean>;
            display: z.ZodOptional<z.ZodEnum<{
                construction: "construction";
                finished: "finished";
            }>>;
            inset: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            lift: z.ZodOptional<z.ZodNumber>;
            src: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        backing: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            role: z.ZodEnum<{
                fill: "fill";
                finish: "finish";
                lining: "lining";
                substrate: "substrate";
                sheathing: "sheathing";
                membrane: "membrane";
                underlay: "underlay";
                insulation: "insulation";
                air: "air";
                furring: "furring";
                structure: "structure";
                deck: "deck";
                covering: "covering";
                shell: "shell";
                glazing: "glazing";
            }>;
            thickness: z.ZodNumber;
            core: z.ZodOptional<z.ZodLiteral<true>>;
            material: z.ZodOptional<z.ZodString>;
            slot: z.ZodOptional<z.ZodString>;
            returns: z.ZodOptional<z.ZodBoolean>;
            display: z.ZodOptional<z.ZodEnum<{
                construction: "construction";
                finished: "finished";
            }>>;
            inset: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            lift: z.ZodOptional<z.ZodNumber>;
            src: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        face: z.ZodOptional<z.ZodEnum<{
            front: "front";
            exterior: "exterior";
        }>>;
        presetId: z.ZodOptional<z.ZodString>;
        cavityInsulation: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    children: z.ZodDefault<z.ZodArray<z.ZodDefault<z.ZodTemplateLiteral<`rseg_${string}`>>>>;
}, z.core.$strip>;
export type RoofNode = z.infer<typeof RoofNode>;
export declare function getEffectiveRoofSurfaceMaterial(node: RoofNode, role: RoofSurfaceMaterialRole): RoofSurfaceMaterialSpec;
//# sourceMappingURL=roof.d.ts.map