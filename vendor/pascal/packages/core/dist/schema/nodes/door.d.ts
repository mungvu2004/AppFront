import { z } from 'zod';
export declare const DoorSegment: z.ZodObject<{
    type: z.ZodEnum<{
        glass: "glass";
        empty: "empty";
        panel: "panel";
    }>;
    heightRatio: z.ZodNumber;
    columnRatios: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
    dividerThickness: z.ZodDefault<z.ZodNumber>;
    panelDepth: z.ZodDefault<z.ZodNumber>;
    panelInset: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type DoorSegment = z.infer<typeof DoorSegment>;
export declare const DoorCategory: z.ZodEnum<{
    interior: "interior";
    garage: "garage";
}>;
export declare const OpeningConstructionType: z.ZodEnum<{
    framed: "framed";
    masonry: "masonry";
}>;
export declare const OpeningDimensionReference: z.ZodEnum<{
    nominal: "nominal";
    "rough-opening": "rough-opening";
    "masonry-opening": "masonry-opening";
    "finish-opening": "finish-opening";
}>;
export declare const DoorType: z.ZodEnum<{
    double: "double";
    hinged: "hinged";
    french: "french";
    folding: "folding";
    pocket: "pocket";
    barn: "barn";
    sliding: "sliding";
    "garage-sectional": "garage-sectional";
    "garage-rollup": "garage-rollup";
    "garage-tiltup": "garage-tiltup";
}>;
export declare const DoorTrackStyle: z.ZodEnum<{
    visible: "visible";
    none: "none";
    pocket: "pocket";
    overhead: "overhead";
}>;
export type DoorCategory = z.infer<typeof DoorCategory>;
export type OpeningConstructionType = z.infer<typeof OpeningConstructionType>;
export type OpeningDimensionReference = z.infer<typeof OpeningDimensionReference>;
export type DoorType = z.infer<typeof DoorType>;
export type DoorTrackStyle = z.infer<typeof DoorTrackStyle>;
export declare const DoorNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`door_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"door">>;
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
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    side: z.ZodOptional<z.ZodEnum<{
        front: "front";
        back: "back";
    }>>;
    wallId: z.ZodOptional<z.ZodString>;
    roofSegmentId: z.ZodOptional<z.ZodString>;
    roofFace: z.ZodOptional<z.ZodEnum<{
        front: "front";
        back: "back";
        right: "right";
        left: "left";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    mark: z.ZodOptional<z.ZodString>;
    constructionType: z.ZodDefault<z.ZodEnum<{
        framed: "framed";
        masonry: "masonry";
    }>>;
    dimensionReference: z.ZodDefault<z.ZodEnum<{
        nominal: "nominal";
        "rough-opening": "rough-opening";
        "masonry-opening": "masonry-opening";
        "finish-opening": "finish-opening";
    }>>;
    roughOpeningWidth: z.ZodOptional<z.ZodNumber>;
    roughOpeningHeight: z.ZodOptional<z.ZodNumber>;
    masonryOpeningWidth: z.ZodOptional<z.ZodNumber>;
    masonryOpeningHeight: z.ZodOptional<z.ZodNumber>;
    finishOpeningWidth: z.ZodOptional<z.ZodNumber>;
    finishOpeningHeight: z.ZodOptional<z.ZodNumber>;
    doorCategory: z.ZodDefault<z.ZodEnum<{
        interior: "interior";
        garage: "garage";
    }>>;
    doorType: z.ZodDefault<z.ZodEnum<{
        double: "double";
        hinged: "hinged";
        french: "french";
        folding: "folding";
        pocket: "pocket";
        barn: "barn";
        sliding: "sliding";
        "garage-sectional": "garage-sectional";
        "garage-rollup": "garage-rollup";
        "garage-tiltup": "garage-tiltup";
    }>>;
    leafCount: z.ZodDefault<z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>>;
    operationState: z.ZodDefault<z.ZodNumber>;
    slideDirection: z.ZodDefault<z.ZodEnum<{
        right: "right";
        left: "left";
    }>>;
    trackStyle: z.ZodDefault<z.ZodEnum<{
        visible: "visible";
        none: "none";
        pocket: "pocket";
        overhead: "overhead";
    }>>;
    garagePanelCount: z.ZodDefault<z.ZodNumber>;
    openingKind: z.ZodDefault<z.ZodEnum<{
        door: "door";
        opening: "opening";
    }>>;
    openingShape: z.ZodDefault<z.ZodEnum<{
        rectangle: "rectangle";
        rounded: "rounded";
        arch: "arch";
    }>>;
    openingRadiusMode: z.ZodDefault<z.ZodEnum<{
        all: "all";
        individual: "individual";
    }>>;
    openingTopRadii: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    cornerRadius: z.ZodDefault<z.ZodNumber>;
    archHeight: z.ZodDefault<z.ZodNumber>;
    openingRevealRadius: z.ZodDefault<z.ZodNumber>;
    frameThickness: z.ZodDefault<z.ZodNumber>;
    frameDepth: z.ZodDefault<z.ZodNumber>;
    threshold: z.ZodDefault<z.ZodBoolean>;
    thresholdHeight: z.ZodDefault<z.ZodNumber>;
    hingesSide: z.ZodDefault<z.ZodEnum<{
        right: "right";
        left: "left";
    }>>;
    swingDirection: z.ZodDefault<z.ZodEnum<{
        inward: "inward";
        outward: "outward";
    }>>;
    swingAngle: z.ZodDefault<z.ZodNumber>;
    segments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            glass: "glass";
            empty: "empty";
            panel: "panel";
        }>;
        heightRatio: z.ZodNumber;
        columnRatios: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
        dividerThickness: z.ZodDefault<z.ZodNumber>;
        panelDepth: z.ZodDefault<z.ZodNumber>;
        panelInset: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>>;
    handle: z.ZodDefault<z.ZodBoolean>;
    handleHeight: z.ZodDefault<z.ZodNumber>;
    handleSide: z.ZodDefault<z.ZodEnum<{
        right: "right";
        left: "left";
    }>>;
    contentPadding: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    doorCloser: z.ZodDefault<z.ZodBoolean>;
    panicBar: z.ZodDefault<z.ZodBoolean>;
    panicBarHeight: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type DoorNode = z.infer<typeof DoorNode>;
//# sourceMappingURL=door.d.ts.map