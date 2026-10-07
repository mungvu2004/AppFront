import { z } from 'zod';
export declare const MaterialPreset: z.ZodEnum<{
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
}>;
export type MaterialPreset = z.infer<typeof MaterialPreset>;
export declare const MaterialProperties: z.ZodObject<{
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
}, z.core.$strip>;
export type MaterialProperties = z.infer<typeof MaterialProperties>;
export declare const MaterialSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type MaterialSchema = z.infer<typeof MaterialSchema>;
export declare const MaterialTarget: z.ZodEnum<{
    wall: "wall";
    roof: "roof";
    "roof-segment": "roof-segment";
    stair: "stair";
    "stair-segment": "stair-segment";
    fence: "fence";
    column: "column";
    slab: "slab";
    ceiling: "ceiling";
    door: "door";
    window: "window";
    shelf: "shelf";
    cabinet: "cabinet";
    chimney: "chimney";
    skylight: "skylight";
    dormer: "dormer";
    "box-vent": "box-vent";
    "ridge-vent": "ridge-vent";
    "turbine-vent": "turbine-vent";
    cupola: "cupola";
    "eyebrow-vent": "eyebrow-vent";
    gutter: "gutter";
    downspout: "downspout";
}>;
export type MaterialTarget = z.infer<typeof MaterialTarget>;
export declare const TextureWrapMode: z.ZodEnum<{
    Repeat: "Repeat";
    ClampToEdge: "ClampToEdge";
    MirroredRepeat: "MirroredRepeat";
}>;
export type TextureWrapMode = z.infer<typeof TextureWrapMode>;
export declare const MaterialMapsSchema: z.ZodObject<{
    albedoMap: z.ZodOptional<z.ZodString>;
    metalnessMap: z.ZodOptional<z.ZodString>;
    roughnessMap: z.ZodOptional<z.ZodString>;
    normalMap: z.ZodOptional<z.ZodString>;
    displacementMap: z.ZodOptional<z.ZodString>;
    aoMap: z.ZodOptional<z.ZodString>;
    emissiveMap: z.ZodOptional<z.ZodString>;
    bumpMap: z.ZodOptional<z.ZodString>;
    alphaMap: z.ZodOptional<z.ZodString>;
    lightMap: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type MaterialMaps = z.infer<typeof MaterialMapsSchema>;
export declare const MaterialMapPropertiesSchema: z.ZodObject<{
    color: z.ZodDefault<z.ZodString>;
    roughness: z.ZodDefault<z.ZodNumber>;
    metalness: z.ZodDefault<z.ZodNumber>;
    repeatX: z.ZodDefault<z.ZodNumber>;
    repeatY: z.ZodDefault<z.ZodNumber>;
    rotation: z.ZodDefault<z.ZodNumber>;
    wrapS: z.ZodDefault<z.ZodEnum<{
        Repeat: "Repeat";
        ClampToEdge: "ClampToEdge";
        MirroredRepeat: "MirroredRepeat";
    }>>;
    wrapT: z.ZodDefault<z.ZodEnum<{
        Repeat: "Repeat";
        ClampToEdge: "ClampToEdge";
        MirroredRepeat: "MirroredRepeat";
    }>>;
    normalScaleX: z.ZodDefault<z.ZodNumber>;
    normalScaleY: z.ZodDefault<z.ZodNumber>;
    emissiveIntensity: z.ZodDefault<z.ZodNumber>;
    displacementScale: z.ZodDefault<z.ZodNumber>;
    transparent: z.ZodDefault<z.ZodBoolean>;
    flipY: z.ZodDefault<z.ZodBoolean>;
    bumpScale: z.ZodDefault<z.ZodNumber>;
    emissiveColor: z.ZodDefault<z.ZodString>;
    aoMapIntensity: z.ZodDefault<z.ZodNumber>;
    side: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    lightMapIntensity: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type MaterialMapProperties = z.infer<typeof MaterialMapPropertiesSchema>;
export declare const MaterialPresetPayloadSchema: z.ZodObject<{
    maps: z.ZodObject<{
        albedoMap: z.ZodOptional<z.ZodString>;
        metalnessMap: z.ZodOptional<z.ZodString>;
        roughnessMap: z.ZodOptional<z.ZodString>;
        normalMap: z.ZodOptional<z.ZodString>;
        displacementMap: z.ZodOptional<z.ZodString>;
        aoMap: z.ZodOptional<z.ZodString>;
        emissiveMap: z.ZodOptional<z.ZodString>;
        bumpMap: z.ZodOptional<z.ZodString>;
        alphaMap: z.ZodOptional<z.ZodString>;
        lightMap: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    mapProperties: z.ZodObject<{
        color: z.ZodDefault<z.ZodString>;
        roughness: z.ZodDefault<z.ZodNumber>;
        metalness: z.ZodDefault<z.ZodNumber>;
        repeatX: z.ZodDefault<z.ZodNumber>;
        repeatY: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
        wrapS: z.ZodDefault<z.ZodEnum<{
            Repeat: "Repeat";
            ClampToEdge: "ClampToEdge";
            MirroredRepeat: "MirroredRepeat";
        }>>;
        wrapT: z.ZodDefault<z.ZodEnum<{
            Repeat: "Repeat";
            ClampToEdge: "ClampToEdge";
            MirroredRepeat: "MirroredRepeat";
        }>>;
        normalScaleX: z.ZodDefault<z.ZodNumber>;
        normalScaleY: z.ZodDefault<z.ZodNumber>;
        emissiveIntensity: z.ZodDefault<z.ZodNumber>;
        displacementScale: z.ZodDefault<z.ZodNumber>;
        transparent: z.ZodDefault<z.ZodBoolean>;
        flipY: z.ZodDefault<z.ZodBoolean>;
        bumpScale: z.ZodDefault<z.ZodNumber>;
        emissiveColor: z.ZodDefault<z.ZodString>;
        aoMapIntensity: z.ZodDefault<z.ZodNumber>;
        side: z.ZodDefault<z.ZodNumber>;
        opacity: z.ZodDefault<z.ZodNumber>;
        lightMapIntensity: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type MaterialPresetPayload = z.infer<typeof MaterialPresetPayloadSchema>;
export declare const DEFAULT_MATERIALS: Record<MaterialPreset, MaterialProperties>;
export declare function resolveMaterial(material?: MaterialSchema): MaterialProperties;
//# sourceMappingURL=material.d.ts.map