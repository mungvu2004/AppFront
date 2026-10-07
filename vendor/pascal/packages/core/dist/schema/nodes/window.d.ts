import { z } from 'zod';
export declare const WindowType: z.ZodEnum<{
    fixed: "fixed";
    sliding: "sliding";
    casement: "casement";
    awning: "awning";
    hopper: "hopper";
    "single-hung": "single-hung";
    "double-hung": "double-hung";
    bay: "bay";
    bow: "bow";
    louvered: "louvered";
}>;
export type WindowType = z.infer<typeof WindowType>;
export declare const WindowConstructionType: z.ZodEnum<{
    framed: "framed";
    masonry: "masonry";
}>;
export declare const WindowDimensionReference: z.ZodEnum<{
    nominal: "nominal";
    "rough-opening": "rough-opening";
    "masonry-opening": "masonry-opening";
    "finish-opening": "finish-opening";
}>;
export type WindowConstructionType = z.infer<typeof WindowConstructionType>;
export type WindowDimensionReference = z.infer<typeof WindowDimensionReference>;
export declare const WindowNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`window_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"window">>;
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
    dormerId: z.ZodOptional<z.ZodString>;
    dormerFace: z.ZodOptional<z.ZodEnum<{
        front: "front";
        back: "back";
        right: "right";
        left: "left";
    }>>;
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
    openingKind: z.ZodDefault<z.ZodEnum<{
        window: "window";
        opening: "opening";
    }>>;
    windowType: z.ZodDefault<z.ZodEnum<{
        fixed: "fixed";
        sliding: "sliding";
        casement: "casement";
        awning: "awning";
        hopper: "hopper";
        "single-hung": "single-hung";
        "double-hung": "double-hung";
        bay: "bay";
        bow: "bow";
        louvered: "louvered";
    }>>;
    operationState: z.ZodDefault<z.ZodNumber>;
    awningDirection: z.ZodDefault<z.ZodEnum<{
        up: "up";
        down: "down";
    }>>;
    casementStyle: z.ZodDefault<z.ZodEnum<{
        french: "french";
        single: "single";
    }>>;
    hingesSide: z.ZodDefault<z.ZodEnum<{
        right: "right";
        left: "left";
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
    openingCornerRadii: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    cornerRadius: z.ZodDefault<z.ZodNumber>;
    archHeight: z.ZodDefault<z.ZodNumber>;
    openingRevealRadius: z.ZodDefault<z.ZodNumber>;
    frameThickness: z.ZodDefault<z.ZodNumber>;
    frameDepth: z.ZodDefault<z.ZodNumber>;
    columnRatios: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
    rowRatios: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
    columnDividerThickness: z.ZodDefault<z.ZodNumber>;
    rowDividerThickness: z.ZodDefault<z.ZodNumber>;
    sill: z.ZodDefault<z.ZodBoolean>;
    sillDepth: z.ZodDefault<z.ZodNumber>;
    sillThickness: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type WindowNode = z.infer<typeof WindowNode>;
//# sourceMappingURL=window.d.ts.map