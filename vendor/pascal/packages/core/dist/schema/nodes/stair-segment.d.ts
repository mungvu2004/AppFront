import { z } from 'zod';
export declare const StairSegmentType: z.ZodEnum<{
    stair: "stair";
    landing: "landing";
}>;
export type StairSegmentType = z.infer<typeof StairSegmentType>;
export declare const AttachmentSide: z.ZodEnum<{
    front: "front";
    right: "right";
    left: "left";
}>;
export type AttachmentSide = z.infer<typeof AttachmentSide>;
export declare const StairSegmentNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`sseg_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"stair-segment">>;
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
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    segmentType: z.ZodDefault<z.ZodEnum<{
        stair: "stair";
        landing: "landing";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    length: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    stepCount: z.ZodDefault<z.ZodNumber>;
    attachmentSide: z.ZodDefault<z.ZodEnum<{
        front: "front";
        right: "right";
        left: "left";
    }>>;
    fillToFloor: z.ZodDefault<z.ZodBoolean>;
    thickness: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type StairSegmentNode = z.infer<typeof StairSegmentNode>;
//# sourceMappingURL=stair-segment.d.ts.map