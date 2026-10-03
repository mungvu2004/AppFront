import { z } from 'zod';
declare const toggleControlSchema: z.ZodObject<{
    kind: z.ZodLiteral<"toggle">;
    label: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
declare const sliderControlSchema: z.ZodObject<{
    kind: z.ZodLiteral<"slider">;
    label: z.ZodString;
    min: z.ZodNumber;
    max: z.ZodNumber;
    step: z.ZodDefault<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    displayMode: z.ZodDefault<z.ZodEnum<{
        slider: "slider";
        stepper: "stepper";
        dial: "dial";
    }>>;
    default: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
declare const temperatureControlSchema: z.ZodObject<{
    kind: z.ZodLiteral<"temperature">;
    label: z.ZodDefault<z.ZodString>;
    min: z.ZodDefault<z.ZodNumber>;
    max: z.ZodDefault<z.ZodNumber>;
    unit: z.ZodDefault<z.ZodEnum<{
        C: "C";
        F: "F";
    }>>;
    default: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
declare const controlSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"toggle">;
    label: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"slider">;
    label: z.ZodString;
    min: z.ZodNumber;
    max: z.ZodNumber;
    step: z.ZodDefault<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    displayMode: z.ZodDefault<z.ZodEnum<{
        slider: "slider";
        stepper: "stepper";
        dial: "dial";
    }>>;
    default: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"temperature">;
    label: z.ZodDefault<z.ZodString>;
    min: z.ZodDefault<z.ZodNumber>;
    max: z.ZodDefault<z.ZodNumber>;
    unit: z.ZodDefault<z.ZodEnum<{
        C: "C";
        F: "F";
    }>>;
    default: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>], "kind">;
declare const animationEffectSchema: z.ZodObject<{
    kind: z.ZodLiteral<"animation">;
    clips: z.ZodObject<{
        on: z.ZodOptional<z.ZodString>;
        off: z.ZodOptional<z.ZodString>;
        loop: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
declare const lightEffectSchema: z.ZodObject<{
    kind: z.ZodLiteral<"light">;
    color: z.ZodDefault<z.ZodString>;
    intensityRange: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    distance: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strip>;
declare const effectSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"animation">;
    clips: z.ZodObject<{
        on: z.ZodOptional<z.ZodString>;
        off: z.ZodOptional<z.ZodString>;
        loop: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"light">;
    color: z.ZodDefault<z.ZodString>;
    intensityRange: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    distance: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strip>], "kind">;
declare const interactiveSchema: z.ZodObject<{
    controls: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"toggle">;
        label: z.ZodOptional<z.ZodString>;
        default: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"slider">;
        label: z.ZodString;
        min: z.ZodNumber;
        max: z.ZodNumber;
        step: z.ZodDefault<z.ZodNumber>;
        unit: z.ZodOptional<z.ZodString>;
        displayMode: z.ZodDefault<z.ZodEnum<{
            slider: "slider";
            stepper: "stepper";
            dial: "dial";
        }>>;
        default: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"temperature">;
        label: z.ZodDefault<z.ZodString>;
        min: z.ZodDefault<z.ZodNumber>;
        max: z.ZodDefault<z.ZodNumber>;
        unit: z.ZodDefault<z.ZodEnum<{
            C: "C";
            F: "F";
        }>>;
        default: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "kind">>>;
    effects: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"animation">;
        clips: z.ZodObject<{
            on: z.ZodOptional<z.ZodString>;
            off: z.ZodOptional<z.ZodString>;
            loop: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"light">;
        color: z.ZodDefault<z.ZodString>;
        intensityRange: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        distance: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strip>], "kind">>>;
}, z.core.$strip>;
export type ToggleControl = z.infer<typeof toggleControlSchema>;
export type SliderControl = z.infer<typeof sliderControlSchema>;
export type TemperatureControl = z.infer<typeof temperatureControlSchema>;
export type Control = z.infer<typeof controlSchema>;
export type AnimationEffect = z.infer<typeof animationEffectSchema>;
export type LightEffect = z.infer<typeof lightEffectSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type Interactive = z.infer<typeof interactiveSchema>;
declare const assetSchema: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodString;
    name: z.ZodString;
    thumbnail: z.ZodString;
    floorPlanUrl: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        library: "library";
        community: "community";
        mine: "mine";
    }>>;
    isDraft: z.ZodOptional<z.ZodBoolean>;
    src: z.ZodString;
    dimensions: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    attachTo: z.ZodOptional<z.ZodEnum<{
        wall: "wall";
        ceiling: "ceiling";
        "wall-side": "wall-side";
    }>>;
    recessed: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    functionTags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    offset: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    scale: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    surface: z.ZodOptional<z.ZodObject<{
        height: z.ZodNumber;
    }, z.core.$strip>>;
    interactive: z.ZodOptional<z.ZodObject<{
        controls: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"toggle">;
            label: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"slider">;
            label: z.ZodString;
            min: z.ZodNumber;
            max: z.ZodNumber;
            step: z.ZodDefault<z.ZodNumber>;
            unit: z.ZodOptional<z.ZodString>;
            displayMode: z.ZodDefault<z.ZodEnum<{
                slider: "slider";
                stepper: "stepper";
                dial: "dial";
            }>>;
            default: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"temperature">;
            label: z.ZodDefault<z.ZodString>;
            min: z.ZodDefault<z.ZodNumber>;
            max: z.ZodDefault<z.ZodNumber>;
            unit: z.ZodDefault<z.ZodEnum<{
                C: "C";
                F: "F";
            }>>;
            default: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>], "kind">>>;
        effects: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"animation">;
            clips: z.ZodObject<{
                on: z.ZodOptional<z.ZodString>;
                off: z.ZodOptional<z.ZodString>;
                loop: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"light">;
            color: z.ZodDefault<z.ZodString>;
            intensityRange: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
            distance: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        }, z.core.$strip>], "kind">>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AssetInput = z.input<typeof assetSchema>;
export type Asset = z.infer<typeof assetSchema>;
export declare const ItemNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`item_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"item">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    scale: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    side: z.ZodOptional<z.ZodEnum<{
        front: "front";
        back: "back";
    }>>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    wallId: z.ZodOptional<z.ZodString>;
    wallT: z.ZodOptional<z.ZodNumber>;
    roofSegmentId: z.ZodOptional<z.ZodString>;
    roofFace: z.ZodOptional<z.ZodEnum<{
        front: "front";
        back: "back";
        right: "right";
        left: "left";
    }>>;
    blockFaceId: z.ZodOptional<z.ZodString>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    collectionIds: z.ZodOptional<z.ZodArray<z.ZodCustom<`collection_${string}`, `collection_${string}`>>>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    asset: z.ZodObject<{
        id: z.ZodString;
        category: z.ZodString;
        name: z.ZodString;
        thumbnail: z.ZodString;
        floorPlanUrl: z.ZodOptional<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<{
            library: "library";
            community: "community";
            mine: "mine";
        }>>;
        isDraft: z.ZodOptional<z.ZodBoolean>;
        src: z.ZodString;
        dimensions: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        attachTo: z.ZodOptional<z.ZodEnum<{
            wall: "wall";
            ceiling: "ceiling";
            "wall-side": "wall-side";
        }>>;
        recessed: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        functionTags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        offset: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        scale: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        surface: z.ZodOptional<z.ZodObject<{
            height: z.ZodNumber;
        }, z.core.$strip>>;
        interactive: z.ZodOptional<z.ZodObject<{
            controls: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"toggle">;
                label: z.ZodOptional<z.ZodString>;
                default: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"slider">;
                label: z.ZodString;
                min: z.ZodNumber;
                max: z.ZodNumber;
                step: z.ZodDefault<z.ZodNumber>;
                unit: z.ZodOptional<z.ZodString>;
                displayMode: z.ZodDefault<z.ZodEnum<{
                    slider: "slider";
                    stepper: "stepper";
                    dial: "dial";
                }>>;
                default: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"temperature">;
                label: z.ZodDefault<z.ZodString>;
                min: z.ZodDefault<z.ZodNumber>;
                max: z.ZodDefault<z.ZodNumber>;
                unit: z.ZodDefault<z.ZodEnum<{
                    C: "C";
                    F: "F";
                }>>;
                default: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>], "kind">>>;
            effects: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                kind: z.ZodLiteral<"animation">;
                clips: z.ZodObject<{
                    on: z.ZodOptional<z.ZodString>;
                    off: z.ZodOptional<z.ZodString>;
                    loop: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
            }, z.core.$strip>, z.ZodObject<{
                kind: z.ZodLiteral<"light">;
                color: z.ZodDefault<z.ZodString>;
                intensityRange: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
                distance: z.ZodOptional<z.ZodNumber>;
                offset: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
            }, z.core.$strip>], "kind">>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ItemNode = z.infer<typeof ItemNode>;
export declare const LOW_PROFILE_ITEM_SURFACE_MAX_HEIGHT = 0.1;
/**
 * Low, floor-resting items like rugs and parking mats can receive items visually,
 * but should not become item parents or block normal floor placement.
 */
export declare function isLowProfileItemSurface(item: ItemNode): boolean;
/**
 * Returns the effective world-space dimensions of an item after applying its scale.
 * Use this everywhere item.asset.dimensions is used for spatial calculations.
 */
export declare function getScaledDimensions(item: ItemNode): [number, number, number];
export {};
//# sourceMappingURL=item.d.ts.map