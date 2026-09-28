import { z } from 'zod';
/**
 * 'guard' — a deck guard built the way the AWC's Deck Construction Guide
 * (DCA 6) draws one: 4x4 posts no more than `postSpacing` apart, a 2x6 cap
 * rail flat on top, a 2x4 top rail on edge under it, and the infill
 * `guardInfill` chooses — 2x2 balusters on a 2x4 bottom rail at a ≤ 4 in
 * clear gap (IRC R312.1.3), ½ in cables `slatGap` apart, or horizontal
 * boards `slatGap` apart. `startPost` / `endPost` false leave that end's
 * post out so the rails die into a post already standing there (a porch's
 * 6x6); `postThrough` runs the posts past the cap with a cap of their own.
 */
export declare const FenceStyle: z.ZodEnum<{
    slat: "slat";
    rail: "rail";
    privacy: "privacy";
    horizontal: "horizontal";
    guard: "guard";
}>;
export declare const FenceGuardInfill: z.ZodEnum<{
    balusters: "balusters";
    cable: "cable";
    boards: "boards";
}>;
/**
 * 'grounded' — a kickboard on the ground; 'floating' — no base, the panel
 * held `groundClearance` up on posts that reach the ground; 'raised' — the
 * base is a BOTTOM RAIL held `groundClearance` above the ground with the
 * infill ending on it, the posts to the ground: a deck guard (IRC R312 —
 * pickets between a top and a bottom rail, the gap under the rail below 4 in).
 */
export declare const FenceBaseStyle: z.ZodEnum<{
    floating: "floating";
    grounded: "grounded";
    raised: "raised";
}>;
export declare const FencePostCap: z.ZodEnum<{
    flat: "flat";
    none: "none";
    pyramid: "pyramid";
}>;
export declare const FenceNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`fence_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"fence">>;
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
    start: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    end: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    path: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>>;
    tangents: z.ZodOptional<z.ZodArray<z.ZodNullable<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>>>;
    height: z.ZodDefault<z.ZodNumber>;
    thickness: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    supportOffset: z.ZodOptional<z.ZodNumber>;
    curveOffset: z.ZodOptional<z.ZodNumber>;
    baseHeight: z.ZodDefault<z.ZodNumber>;
    postSpacing: z.ZodDefault<z.ZodNumber>;
    postSize: z.ZodDefault<z.ZodNumber>;
    topRailHeight: z.ZodDefault<z.ZodNumber>;
    groundClearance: z.ZodDefault<z.ZodNumber>;
    edgeInset: z.ZodDefault<z.ZodNumber>;
    slatGap: z.ZodDefault<z.ZodNumber>;
    postCap: z.ZodDefault<z.ZodEnum<{
        flat: "flat";
        none: "none";
        pyramid: "pyramid";
    }>>;
    baseStyle: z.ZodDefault<z.ZodEnum<{
        floating: "floating";
        grounded: "grounded";
        raised: "raised";
    }>>;
    showInfill: z.ZodDefault<z.ZodBoolean>;
    guardInfill: z.ZodOptional<z.ZodEnum<{
        balusters: "balusters";
        cable: "cable";
        boards: "boards";
    }>>;
    startPost: z.ZodOptional<z.ZodBoolean>;
    endPost: z.ZodOptional<z.ZodBoolean>;
    postThrough: z.ZodOptional<z.ZodBoolean>;
    color: z.ZodDefault<z.ZodString>;
    style: z.ZodDefault<z.ZodEnum<{
        slat: "slat";
        rail: "rail";
        privacy: "privacy";
        horizontal: "horizontal";
        guard: "guard";
    }>>;
}, z.core.$strip>;
export type FenceGuardInfill = z.infer<typeof FenceGuardInfill>;
export type FenceNode = z.infer<typeof FenceNode>;
//# sourceMappingURL=fence.d.ts.map