import { z } from 'zod';
export declare const DownspoutNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`downspout_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"downspout">>;
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
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    materialPreset: z.ZodDefault<z.ZodString>;
    gutterId: z.ZodOptional<z.ZodString>;
    outletId: z.ZodOptional<z.ZodString>;
    length: z.ZodDefault<z.ZodNumber>;
    lengthMode: z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        "to-ground": "to-ground";
    }>>;
    diameter: z.ZodDefault<z.ZodNumber>;
    standoff: z.ZodDefault<z.ZodNumber>;
    shape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        auto: "auto";
        rect: "rect";
    }>>;
    strapStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        band: "band";
    }>>;
    strapSpacing: z.ZodDefault<z.ZodNumber>;
    terminal: z.ZodDefault<z.ZodEnum<{
        straight: "straight";
        splash: "splash";
        kickout: "kickout";
    }>>;
}, z.core.$strip>;
export type DownspoutNode = z.infer<typeof DownspoutNode>;
export declare function defaultDownspoutMetadata(): {
    generatedBy: string;
};
export declare function isDefaultDownspoutNode(node: unknown, gutterId?: string): node is DownspoutNode;
export declare function usesAutomaticDownspoutLength(node: DownspoutNode): boolean;
//# sourceMappingURL=downspout.d.ts.map