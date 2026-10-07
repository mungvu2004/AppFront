import z from 'zod';
/** A node schema as authored: `type` is a literal wrapped by `nodeType()`'s `.default()`. */
type NodeMember = z.ZodObject<{
    type: z.ZodDefault<z.ZodLiteral<string>>;
} & z.core.$ZodLooseShape>;
/** The same schema with the discriminator narrowed back to its bare literal. */
type BareDiscriminator<T extends NodeMember> = z.ZodObject<Omit<T['shape'], 'type'> & {
    type: ReturnType<T['shape']['type']['unwrap']>;
}>;
/**
 * Assembles the node union on discriminators that claim exactly one value.
 *
 * `nodeType()` defaults the literal so a per-kind schema can fill `type` in
 * (`WallNode.parse({ start, end })`), but a `.default()`-wrapped discriminator
 * also claims `undefined` from zod 4.5 on (upstream #6432). With 48 members
 * doing it, the union's lazily-built discriminator map collides on
 * `undefined` and throws `Duplicate discriminator value` — as a plain Error,
 * so it escapes `safeParse` and surfaces as a crash at the first parse.
 *
 * Each member is therefore projected to a clone whose `type` is the bare
 * literal. Per-kind schemas keep their default; only the union's view of the
 * discriminator narrows. `safeExtend` retains member refinements, including
 * procedural recipe/parameter validation. Metadata lives in zod's global registry keyed by
 * instance, so `.describe()` text has to be carried over to the clone by hand.
 */
export declare const nodeUnion: <const T extends readonly [NodeMember, ...NodeMember[]]>(members: T) => z.ZodDiscriminatedUnion<{ [K in keyof T]: BareDiscriminator<T[K]>; }, "type">;
export declare const AnyNode: z.ZodDiscriminatedUnion<readonly [BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`site_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"site">>;
    polygon: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        type: z.ZodLiteral<"polygon">;
        points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strip>>>;
    terrain: z.ZodOptional<z.ZodObject<{
        type: z.ZodLiteral<"heightfield">;
        origin: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        spacing: z.ZodNumber;
        cols: z.ZodNumber;
        rows: z.ZodNumber;
        step: z.ZodNumber;
        heights: z.ZodString;
    }, z.core.$strip>>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zip: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    parcel: z.ZodOptional<z.ZodObject<{
        apn: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodString>;
        county: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        lotAreaSqFt: z.ZodOptional<z.ZodNumber>;
        originLngLat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        resolvedAt: z.ZodOptional<z.ZodString>;
        layer: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    setbacks: z.ZodOptional<z.ZodObject<{
        front: z.ZodNumber;
        side: z.ZodNumber;
        rear: z.ZodNumber;
        left: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        streetSide: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    setbacksSource: z.ZodOptional<z.ZodString>;
    zone: z.ZodOptional<z.ZodString>;
    frontEdge: z.ZodOptional<z.ZodNumber>;
    streetEdges: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    sightTriangleFt: z.ZodOptional<z.ZodNumber>;
    northRotation: z.ZodOptional<z.ZodNumber>;
    dossier: z.ZodOptional<z.ZodObject<{
        provider: z.ZodString;
        asOf: z.ZodString;
        point: z.ZodOptional<z.ZodObject<{
            lat: z.ZodOptional<z.ZodNumber>;
            lng: z.ZodOptional<z.ZodNumber>;
            source: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        address: z.ZodOptional<z.ZodObject<{
            formatted: z.ZodOptional<z.ZodString>;
            precision: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        sections: z.ZodRecord<z.ZodString, z.ZodObject<{
            status: z.ZodString;
            summary: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodObject<{
                name: z.ZodOptional<z.ZodString>;
                kind: z.ZodOptional<z.ZodString>;
                vintage: z.ZodOptional<z.ZodString>;
                attribution: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>;
        parcel: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        flood: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        codeBasis: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        zoning: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        utilities: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        soils: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        wetlands: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        structures: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        elevation: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        boundaries: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$loose>>;
    contourIntervalIn: z.ZodOptional<z.ZodNumber>;
    contours3d: z.ZodOptional<z.ZodBoolean>;
    terrainContours: z.ZodOptional<z.ZodObject<{
        datum: z.ZodString;
        intervalFt: z.ZodNumber;
        source: z.ZodOptional<z.ZodString>;
        lines: z.ZodArray<z.ZodObject<{
            elevationFt: z.ZodNumber;
            points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`building_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"building">>;
    children: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodDefault<z.ZodTemplateLiteral<`level_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`elevator_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`unit_${string}`>>]>>>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`elevator_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"elevator">>;
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
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    shaftWidth: z.ZodOptional<z.ZodNumber>;
    shaftDepth: z.ZodOptional<z.ZodNumber>;
    shaftWallThickness: z.ZodDefault<z.ZodNumber>;
    shaftStyle: z.ZodDefault<z.ZodEnum<{
        glass: "glass";
        solid: "solid";
    }>>;
    cabHeight: z.ZodDefault<z.ZodNumber>;
    doorWidth: z.ZodDefault<z.ZodNumber>;
    doorHeight: z.ZodDefault<z.ZodNumber>;
    doorStyle: z.ZodDefault<z.ZodEnum<{
        "center-opening": "center-opening";
        "single-left": "single-left";
        "single-right": "single-right";
    }>>;
    doorPanelStyle: z.ZodDefault<z.ZodEnum<{
        "glass-frame": "glass-frame";
        "solid-panel": "solid-panel";
        "segmented-panel": "segmented-panel";
    }>>;
    fromLevelId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    toLevelId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    servedLevelIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    disabledLevelIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    serviceOnlyLevelIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    defaultLevelId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    speed: z.ZodDefault<z.ZodNumber>;
    doorDurationMs: z.ZodDefault<z.ZodNumber>;
    dwellMs: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
    object: z.ZodDefault<z.ZodLiteral<"node">>;
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`unit_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"unit">>;
    name: z.ZodDefault<z.ZodString>;
    kind: z.ZodDefault<z.ZodEnum<{
        apartment: "apartment";
        "hotel-room": "hotel-room";
        commercial: "commercial";
        common: "common";
    }>>;
    members: z.ZodDefault<z.ZodArray<z.ZodDefault<z.ZodTemplateLiteral<`zone_${string}`>>>>;
    color: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`level_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"level">>;
    children: z.ZodDefault<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<`block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `roof_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `zone_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`, string>>>>;
    level: z.ZodDefault<z.ZodNumber>;
    baseElevation: z.ZodDefault<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`leanto_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"lean-to-extension">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    children: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodDefault<z.ZodTemplateLiteral<`column_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`roof_${string}`>>]>>>;
    canopyForm: z.ZodDefault<z.ZodEnum<{
        gable: "gable";
        mono: "mono";
        butterfly: "butterfly";
    }>>;
    hostKind: z.ZodDefault<z.ZodEnum<{
        wall: "wall";
        "slab-edge": "slab-edge";
        freestanding: "freestanding";
        "conical-roof": "conical-roof";
    }>>;
    hostHeightOffset: z.ZodDefault<z.ZodNumber>;
    hostSlabId: z.ZodOptional<z.ZodDefault<z.ZodTemplateLiteral<`slab_${string}`>>>;
    hostSlabEdgeIndex: z.ZodOptional<z.ZodNumber>;
    hostSlabEdgeT: z.ZodOptional<z.ZodNumber>;
    span: z.ZodDefault<z.ZodNumber>;
    autoSpan: z.ZodDefault<z.ZodBoolean>;
    projection: z.ZodDefault<z.ZodNumber>;
    spanArcCenterZ: z.ZodOptional<z.ZodNumber>;
    spanArcRadius: z.ZodOptional<z.ZodNumber>;
    highEdgeHeight: z.ZodDefault<z.ZodNumber>;
    lowEdgeHeight: z.ZodDefault<z.ZodNumber>;
    pitch: z.ZodDefault<z.ZodNumber>;
    resizeLock: z.ZodDefault<z.ZodEnum<{
        "preserve-high-edge": "preserve-high-edge";
        "preserve-low-edge": "preserve-low-edge";
        "preserve-pitch": "preserve-pitch";
    }>>;
    leftEndCondition: z.ZodDefault<z.ZodEnum<{
        open: "open";
        "wall-abutment": "wall-abutment";
        joined: "joined";
    }>>;
    rightEndCondition: z.ZodDefault<z.ZodEnum<{
        open: "open";
        "wall-abutment": "wall-abutment";
        joined: "joined";
    }>>;
    autoMiterCorners: z.ZodDefault<z.ZodBoolean>;
    sideFlashing: z.ZodDefault<z.ZodBoolean>;
    flashingProjection: z.ZodDefault<z.ZodNumber>;
    flashingHeight: z.ZodDefault<z.ZodNumber>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    highSideMode: z.ZodDefault<z.ZodEnum<{
        "wall-ledger": "wall-ledger";
        "independent-high-beam": "independent-high-beam";
    }>>;
    ledgerVerticalOffset: z.ZodDefault<z.ZodNumber>;
    lowBeamInset: z.ZodDefault<z.ZodNumber>;
    gutterEnabled: z.ZodDefault<z.ZodBoolean>;
    gutterProfile: z.ZodDefault<z.ZodEnum<{
        box: "box";
        "k-style": "k-style";
        "half-round": "half-round";
    }>>;
    gutterSize: z.ZodDefault<z.ZodNumber>;
    downspoutEnabled: z.ZodDefault<z.ZodBoolean>;
    downspoutPosition: z.ZodDefault<z.ZodNumber>;
    connectionMode: z.ZodDefault<z.ZodEnum<{
        manual: "manual";
        auto: "auto";
    }>>;
    hostRoofId: z.ZodOptional<z.ZodDefault<z.ZodTemplateLiteral<`roof_${string}`>>>;
    hostRoofSegmentId: z.ZodOptional<z.ZodString>;
    hostRoofEdge: z.ZodOptional<z.ZodEnum<{
        "+X": "+X";
        "-X": "-X";
        "+Z": "+Z";
        "-Z": "-Z";
    }>>;
    hostRoofEdgeRange: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    connectionOffset: z.ZodDefault<z.ZodNumber>;
    connectionInset: z.ZodDefault<z.ZodNumber>;
    matchHostRoofMaterial: z.ZodDefault<z.ZodBoolean>;
    matchHostRoofStructure: z.ZodDefault<z.ZodBoolean>;
    roofThickness: z.ZodDefault<z.ZodNumber>;
    shingleThickness: z.ZodDefault<z.ZodNumber>;
    highOverhang: z.ZodDefault<z.ZodNumber>;
    lowOverhang: z.ZodDefault<z.ZodNumber>;
    leftOverhang: z.ZodDefault<z.ZodNumber>;
    rightOverhang: z.ZodDefault<z.ZodNumber>;
    coveringType: z.ZodDefault<z.ZodEnum<{
        generic: "generic";
        shingle: "shingle";
        "metal-panel": "metal-panel";
    }>>;
    beamWidth: z.ZodDefault<z.ZodNumber>;
    beamHeight: z.ZodDefault<z.ZodNumber>;
    ledgerDepth: z.ZodDefault<z.ZodNumber>;
    ledgerHeight: z.ZodDefault<z.ZodNumber>;
    rafterWidth: z.ZodDefault<z.ZodNumber>;
    rafterHeight: z.ZodDefault<z.ZodNumber>;
    rafterSpacing: z.ZodDefault<z.ZodNumber>;
    rafterEndInset: z.ZodDefault<z.ZodNumber>;
    framingStrategy: z.ZodDefault<z.ZodEnum<{
        hidden: "hidden";
        rafters: "rafters";
        purlins: "purlins";
        "covering-specific": "covering-specific";
    }>>;
    purlinWidth: z.ZodDefault<z.ZodNumber>;
    purlinHeight: z.ZodDefault<z.ZodNumber>;
    purlinSpacing: z.ZodDefault<z.ZodNumber>;
    postWidth: z.ZodDefault<z.ZodNumber>;
    postDepth: z.ZodDefault<z.ZodNumber>;
    postCount: z.ZodDefault<z.ZodNumber>;
    postLayoutMode: z.ZodDefault<z.ZodEnum<{
        count: "count";
        "target-spacing": "target-spacing";
    }>>;
    postSpacing: z.ZodDefault<z.ZodNumber>;
    postInset: z.ZodDefault<z.ZodNumber>;
    omittedPostSlots: z.ZodDefault<z.ZodArray<z.ZodObject<{
        side: z.ZodEnum<{
            low: "low";
            high: "high";
        }>;
        index: z.ZodNumber;
        layoutCount: z.ZodNumber;
    }, z.core.$strip>>>;
    postBracing: z.ZodDefault<z.ZodEnum<{
        none: "none";
        knee: "knee";
    }>>;
    footingStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        "base-plate": "base-plate";
        "concrete-pad": "concrete-pad";
    }>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`column_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"column">>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    style: z.ZodDefault<z.ZodEnum<{
        plain: "plain";
        faceted: "faceted";
        fluted: "fluted";
        "lathe-turned": "lathe-turned";
        "dravidian-carved": "dravidian-carved";
        cluster: "cluster";
    }>>;
    crossSection: z.ZodDefault<z.ZodEnum<{
        round: "round";
        square: "square";
        rectangular: "rectangular";
        octagonal: "octagonal";
        "sixteen-sided": "sixteen-sided";
    }>>;
    height: z.ZodDefault<z.ZodNumber>;
    radius: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    edgeSoftness: z.ZodDefault<z.ZodNumber>;
    baseHeight: z.ZodDefault<z.ZodNumber>;
    capitalHeight: z.ZodDefault<z.ZodNumber>;
    shaftProfile: z.ZodDefault<z.ZodEnum<{
        straight: "straight";
        tapered: "tapered";
        bulged: "bulged";
        baluster: "baluster";
        hourglass: "hourglass";
    }>>;
    shaftTaper: z.ZodDefault<z.ZodNumber>;
    shaftBulge: z.ZodDefault<z.ZodNumber>;
    shaftStartScale: z.ZodDefault<z.ZodNumber>;
    shaftEndScale: z.ZodDefault<z.ZodNumber>;
    shaftSegmentCount: z.ZodDefault<z.ZodNumber>;
    shaftTwistStep: z.ZodDefault<z.ZodNumber>;
    shaftCornerRadius: z.ZodDefault<z.ZodNumber>;
    shaftDetail: z.ZodDefault<z.ZodEnum<{
        fluted: "fluted";
        "lathe-turned": "lathe-turned";
        none: "none";
        spiral: "spiral";
        panelled: "panelled";
    }>>;
    baseStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        "simple-square": "simple-square";
        "round-rings": "round-rings";
        "square-plinth": "square-plinth";
        "stepped-square": "stepped-square";
        lotus: "lotus";
        "ribbed-lotus": "ribbed-lotus";
        "panelled-pedestal": "panelled-pedestal";
    }>>;
    baseWidthScale: z.ZodDefault<z.ZodNumber>;
    baseDepthScale: z.ZodDefault<z.ZodNumber>;
    baseTierCount: z.ZodDefault<z.ZodNumber>;
    baseStepSpread: z.ZodDefault<z.ZodNumber>;
    basePlinthHeightRatio: z.ZodDefault<z.ZodNumber>;
    baseRoundBandScale: z.ZodDefault<z.ZodNumber>;
    baseNeckScale: z.ZodDefault<z.ZodNumber>;
    baseRoundBandCount: z.ZodDefault<z.ZodNumber>;
    baseRibCount: z.ZodDefault<z.ZodNumber>;
    baseCarvingLevel: z.ZodDefault<z.ZodNumber>;
    basePanelInset: z.ZodDefault<z.ZodNumber>;
    capitalStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        simple: "simple";
        "simple-slab": "simple-slab";
        rounded: "rounded";
        stepped: "stepped";
        doric: "doric";
        volute: "volute";
        "ionic-volute": "ionic-volute";
        "leaf-carved": "leaf-carved";
        "corinthian-leaf": "corinthian-leaf";
        "south-indian-bracket": "south-indian-bracket";
        "wood-bracket": "wood-bracket";
    }>>;
    capitalWidthScale: z.ZodDefault<z.ZodNumber>;
    capitalDepthScale: z.ZodDefault<z.ZodNumber>;
    capitalTierCount: z.ZodDefault<z.ZodNumber>;
    capitalStepSpread: z.ZodDefault<z.ZodNumber>;
    capitalBandCount: z.ZodDefault<z.ZodNumber>;
    voluteSize: z.ZodDefault<z.ZodNumber>;
    voluteCount: z.ZodDefault<z.ZodNumber>;
    leafCount: z.ZodDefault<z.ZodNumber>;
    leafRows: z.ZodDefault<z.ZodNumber>;
    bracketDepth: z.ZodDefault<z.ZodNumber>;
    bracketTierCount: z.ZodDefault<z.ZodNumber>;
    pendantCount: z.ZodDefault<z.ZodNumber>;
    capitalCarvingLevel: z.ZodDefault<z.ZodNumber>;
    ringCount: z.ZodDefault<z.ZodNumber>;
    ringPlacement: z.ZodDefault<z.ZodEnum<{
        top: "top";
        ends: "ends";
        even: "even";
        bottom: "bottom";
    }>>;
    ringThickness: z.ZodDefault<z.ZodNumber>;
    ringSpread: z.ZodDefault<z.ZodNumber>;
    fluteCount: z.ZodDefault<z.ZodNumber>;
    fluteDepth: z.ZodDefault<z.ZodNumber>;
    fluteWidth: z.ZodDefault<z.ZodNumber>;
    spiralTwist: z.ZodDefault<z.ZodNumber>;
    spiralRibCount: z.ZodDefault<z.ZodNumber>;
    panelCount: z.ZodDefault<z.ZodNumber>;
    panelInsetDepth: z.ZodDefault<z.ZodNumber>;
    panelShape: z.ZodDefault<z.ZodEnum<{
        rectangle: "rectangle";
        arched: "arched";
        diamond: "diamond";
    }>>;
    latheRingCount: z.ZodDefault<z.ZodNumber>;
    latheRingSpacing: z.ZodDefault<z.ZodEnum<{
        top: "top";
        ends: "ends";
        even: "even";
        bottom: "bottom";
    }>>;
    carvingLevel: z.ZodDefault<z.ZodNumber>;
    carvingPlacement: z.ZodDefault<z.ZodEnum<{
        base: "base";
        shaft: "shaft";
        capital: "capital";
        all: "all";
    }>>;
    lowerBandEnabled: z.ZodDefault<z.ZodBoolean>;
    lowerBandHeight: z.ZodDefault<z.ZodNumber>;
    lowerBandCarvingLevel: z.ZodDefault<z.ZodNumber>;
    dentilCount: z.ZodDefault<z.ZodNumber>;
    beadCount: z.ZodDefault<z.ZodNumber>;
    supportStyle: z.ZodDefault<z.ZodEnum<{
        vertical: "vertical";
        "a-frame": "a-frame";
        "y-frame": "y-frame";
        "v-frame": "v-frame";
        "x-brace": "x-brace";
        "k-brace": "k-brace";
        "single-strut": "single-strut";
        tripod: "tripod";
        trestle: "trestle";
        "portal-frame": "portal-frame";
        "box-frame": "box-frame";
    }>>;
    braceWidth: z.ZodDefault<z.ZodNumber>;
    braceDepth: z.ZodDefault<z.ZodNumber>;
    braceBottomSpread: z.ZodDefault<z.ZodNumber>;
    braceTopSpread: z.ZodDefault<z.ZodNumber>;
    bracePlateEnabled: z.ZodDefault<z.ZodBoolean>;
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`construction-dimension_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"construction-dimension">>;
    anchors: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
        kind: z.ZodLiteral<"feature">;
        reference: z.ZodObject<{
            nodeId: z.ZodString;
            featureId: z.ZodString;
            parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
        }, z.core.$strip>;
        fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    }, z.core.$strip>]>>>;
    baseline: z.ZodDefault<z.ZodObject<{
        origin: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        direction: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strip>>;
    chainMode: z.ZodDefault<z.ZodEnum<{
        "point-to-point": "point-to-point";
        continuous: "continuous";
    }>>;
    mode: z.ZodDefault<z.ZodEnum<{
        radius: "radius";
        linear: "linear";
        diameter: "diameter";
        "center-mark": "center-mark";
        chord: "chord";
        "arc-length": "arc-length";
        angular: "angular";
        coordinate: "coordinate";
    }>>;
    featureCount: z.ZodDefault<z.ZodNumber>;
    showCenterMark: z.ZodDefault<z.ZodBoolean>;
    prefix: z.ZodDefault<z.ZodString>;
    suffix: z.ZodDefault<z.ZodString>;
    textOverride: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    datumPolicy: z.ZodDefault<z.ZodEnum<{
        centerline: "centerline";
        "wall-face": "wall-face";
        "structural-face": "structural-face";
        "finish-face": "finish-face";
    }>>;
    terminator: z.ZodDefault<z.ZodEnum<{
        "architectural-tick": "architectural-tick";
        "filled-arrow": "filled-arrow";
        "open-arrow": "open-arrow";
        dot: "dot";
    }>>;
    textPosition: z.ZodDefault<z.ZodEnum<{
        above: "above";
        centered: "centered";
    }>>;
    imperialPrecision: z.ZodDefault<z.ZodEnum<{
        1: "1";
        "1/2": "1/2";
        "1/4": "1/4";
        "1/8": "1/8";
        "1/16": "1/16";
    }>>;
    metricNotation: z.ZodDefault<z.ZodEnum<{
        meters: "meters";
        millimeters: "millimeters";
    }>>;
    extensionStartGap: z.ZodDefault<z.ZodNumber>;
    extensionOvershoot: z.ZodDefault<z.ZodNumber>;
    drawingType: z.ZodDefault<z.ZodEnum<{
        "floor-plan": "floor-plan";
        "foundation-plan": "foundation-plan";
        "reflected-ceiling-plan": "reflected-ceiling-plan";
        "roof-plan": "roof-plan";
        "site-plan": "site-plan";
    }>>;
    drawingOverrides: z.ZodDefault<z.ZodArray<z.ZodObject<{
        drawingType: z.ZodEnum<{
            "floor-plan": "floor-plan";
            "foundation-plan": "foundation-plan";
            "reflected-ceiling-plan": "reflected-ceiling-plan";
            "roof-plan": "roof-plan";
            "site-plan": "site-plan";
        }>;
        presentation: z.ZodEnum<{
            shown: "shown";
            omit: "omit";
            controlled: "controlled";
        }>;
        suppressedSegmentIndexes: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>>;
    controllingDimensionId: z.ZodDefault<z.ZodNullable<z.ZodDefault<z.ZodTemplateLiteral<`construction-dimension_${string}`>>>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`block_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"block">>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    topology: z.ZodDefault<z.ZodObject<{
        vertices: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>>;
        edges: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            vertexIds: z.ZodTuple<[z.ZodString, z.ZodString], null>;
        }, z.core.$strip>>;
        faces: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            vertexIds: z.ZodArray<z.ZodString>;
            materialSlot: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    slots: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    slotNames: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`structural-grid_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"structural-grid">>;
    start: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    end: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    label: z.ZodDefault<z.ZodString>;
    showStartBubble: z.ZodDefault<z.ZodBoolean>;
    showEndBubble: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`wall_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"wall">>;
    wallType: z.ZodOptional<z.ZodEnum<{
        standard: "standard";
        curtain: "curtain";
    }>>;
    curtainWall: z.ZodOptional<z.ZodObject<{
        construction: z.ZodDefault<z.ZodEnum<{
            stick: "stick";
            unitized: "unitized";
        }>>;
        framing: z.ZodDefault<z.ZodEnum<{
            capped: "capped";
            "vertical-caps": "vertical-caps";
            "horizontal-caps": "horizontal-caps";
            "structural-glazing": "structural-glazing";
        }>>;
        columns: z.ZodPrefault<z.ZodObject<{
            layout: z.ZodDefault<z.ZodEnum<{
                count: "count";
                "maximum-spacing": "maximum-spacing";
                "fixed-spacing": "fixed-spacing";
            }>>;
            count: z.ZodDefault<z.ZodNumber>;
            spacing: z.ZodDefault<z.ZodNumber>;
            alignment: z.ZodDefault<z.ZodEnum<{
                center: "center";
                start: "start";
                end: "end";
            }>>;
        }, z.core.$strip>>;
        rows: z.ZodPrefault<z.ZodObject<{
            layout: z.ZodDefault<z.ZodEnum<{
                count: "count";
                "maximum-spacing": "maximum-spacing";
                "fixed-spacing": "fixed-spacing";
            }>>;
            count: z.ZodDefault<z.ZodNumber>;
            spacing: z.ZodDefault<z.ZodNumber>;
            alignment: z.ZodDefault<z.ZodEnum<{
                center: "center";
                start: "start";
                end: "end";
            }>>;
        }, z.core.$strip>>;
        mullionWidth: z.ZodDefault<z.ZodNumber>;
        transomWidth: z.ZodDefault<z.ZodNumber>;
        perimeterWidth: z.ZodDefault<z.ZodNumber>;
        jointWidth: z.ZodDefault<z.ZodNumber>;
        glassThickness: z.ZodDefault<z.ZodNumber>;
        panelType: z.ZodDefault<z.ZodEnum<{
            glass: "glass";
            solid: "solid";
            empty: "empty";
        }>>;
        spandrel: z.ZodDefault<z.ZodEnum<{
            top: "top";
            none: "none";
            bottom: "bottom";
        }>>;
        frameColor: z.ZodDefault<z.ZodString>;
        glassColor: z.ZodDefault<z.ZodString>;
        solidColor: z.ZodDefault<z.ZodString>;
        glassOpacity: z.ZodDefault<z.ZodNumber>;
        glassRoughness: z.ZodDefault<z.ZodNumber>;
        panels: z.ZodDefault<z.ZodArray<z.ZodObject<{
            column: z.ZodNumber;
            row: z.ZodNumber;
            type: z.ZodEnum<{
                glass: "glass";
                solid: "solid";
                empty: "empty";
            }>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    children: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodDefault<z.ZodTemplateLiteral<`item_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`procedural-item_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`door_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`window_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`leanto_${string}`>>]>>>;
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
    interiorMaterial: z.ZodOptional<z.ZodObject<{
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
    interiorMaterialPreset: z.ZodOptional<z.ZodString>;
    exteriorMaterial: z.ZodOptional<z.ZodObject<{
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
    exteriorMaterialPreset: z.ZodOptional<z.ZodString>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    thickness: z.ZodOptional<z.ZodNumber>;
    assembly: z.ZodOptional<z.ZodObject<{
        preset: z.ZodOptional<z.ZodString>;
        exterior: z.ZodOptional<z.ZodObject<{
            finish: z.ZodEnum<{
                brick: "brick";
                none: "none";
                siding: "siding";
                stucco: "stucco";
                stone: "stone";
                "fiber-cement": "fiber-cement";
            }>;
            thickness: z.ZodNumber;
        }, z.core.$strip>>;
        sheathing: z.ZodOptional<z.ZodObject<{
            material: z.ZodEnum<{
                none: "none";
                osb: "osb";
                plywood: "plywood";
                gypsum: "gypsum";
            }>;
            thickness: z.ZodNumber;
        }, z.core.$strip>>;
        framing: z.ZodObject<{
            kind: z.ZodEnum<{
                wood: "wood";
                lgs: "lgs";
                cmu: "cmu";
                icf: "icf";
            }>;
            depth: z.ZodNumber;
        }, z.core.$strip>;
        interior: z.ZodOptional<z.ZodObject<{
            finish: z.ZodEnum<{
                plaster: "plaster";
                none: "none";
                drywall: "drywall";
            }>;
            thickness: z.ZodNumber;
        }, z.core.$strip>>;
        cavityInsulation: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    height: z.ZodOptional<z.ZodNumber>;
    curveOffset: z.ZodOptional<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    supportOffset: z.ZodOptional<z.ZodNumber>;
    fillToTerrain: z.ZodOptional<z.ZodBoolean>;
    underpinning: z.ZodOptional<z.ZodObject<{
        rim: z.ZodNumber;
        stem: z.ZodNumber;
        openings: z.ZodOptional<z.ZodArray<z.ZodObject<{
            u: z.ZodNumber;
            width: z.ZodNumber;
            top: z.ZodNumber;
            bottom: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    faceBands: z.ZodOptional<z.ZodPreprocess<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        count: z.ZodDefault<z.ZodNumber>;
        lowerHeight: z.ZodDefault<z.ZodNumber>;
        middleHeight: z.ZodDefault<z.ZodNumber>;
        upperHeight: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, unknown>>;
    skirting: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        sides: z.ZodDefault<z.ZodEnum<{
            interior: "interior";
            exterior: "exterior";
            both: "both";
        }>>;
        height: z.ZodDefault<z.ZodNumber>;
        proud: z.ZodDefault<z.ZodNumber>;
        profile: z.ZodDefault<z.ZodEnum<{
            flat: "flat";
            bevel: "bevel";
            triangle: "triangle";
            cove: "cove";
            bullnose: "bullnose";
            "base-modern": "base-modern";
            "base-colonial": "base-colonial";
            "base-shoe": "base-shoe";
            "base-ogee": "base-ogee";
            "crown-cove": "crown-cove";
            "crown-ogee": "crown-ogee";
            "crown-craftsman": "crown-craftsman";
            "crown-layered": "crown-layered";
            "rail-rounded": "rail-rounded";
            "rail-ogee": "rail-ogee";
            "rail-picture": "rail-picture";
            "rail-stepped": "rail-stepped";
        }>>;
        offsetY: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    crown: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        sides: z.ZodDefault<z.ZodEnum<{
            interior: "interior";
            exterior: "exterior";
            both: "both";
        }>>;
        height: z.ZodDefault<z.ZodNumber>;
        proud: z.ZodDefault<z.ZodNumber>;
        profile: z.ZodDefault<z.ZodEnum<{
            flat: "flat";
            bevel: "bevel";
            triangle: "triangle";
            cove: "cove";
            bullnose: "bullnose";
            "base-modern": "base-modern";
            "base-colonial": "base-colonial";
            "base-shoe": "base-shoe";
            "base-ogee": "base-ogee";
            "crown-cove": "crown-cove";
            "crown-ogee": "crown-ogee";
            "crown-craftsman": "crown-craftsman";
            "crown-layered": "crown-layered";
            "rail-rounded": "rail-rounded";
            "rail-ogee": "rail-ogee";
            "rail-picture": "rail-picture";
            "rail-stepped": "rail-stepped";
        }>>;
        offsetY: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    chairRail: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        sides: z.ZodDefault<z.ZodEnum<{
            interior: "interior";
            exterior: "exterior";
            both: "both";
        }>>;
        height: z.ZodDefault<z.ZodNumber>;
        proud: z.ZodDefault<z.ZodNumber>;
        profile: z.ZodDefault<z.ZodEnum<{
            flat: "flat";
            bevel: "bevel";
            triangle: "triangle";
            cove: "cove";
            bullnose: "bullnose";
            "base-modern": "base-modern";
            "base-colonial": "base-colonial";
            "base-shoe": "base-shoe";
            "base-ogee": "base-ogee";
            "crown-cove": "crown-cove";
            "crown-ogee": "crown-ogee";
            "crown-craftsman": "crown-craftsman";
            "crown-layered": "crown-layered";
            "rail-rounded": "rail-rounded";
            "rail-ogee": "rail-ogee";
            "rail-picture": "rail-picture";
            "rail-stepped": "rail-stepped";
        }>>;
        offsetY: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    start: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    end: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    frontSide: z.ZodDefault<z.ZodEnum<{
        unknown: "unknown";
        interior: "interior";
        exterior: "exterior";
    }>>;
    backSide: z.ZodDefault<z.ZodEnum<{
        unknown: "unknown";
        interior: "interior";
        exterior: "exterior";
    }>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    carcassHeight: z.ZodDefault<z.ZodNumber>;
    operationState: z.ZodDefault<z.ZodNumber>;
    plinthHeight: z.ZodDefault<z.ZodNumber>;
    toeKickDepth: z.ZodDefault<z.ZodNumber>;
    boardThickness: z.ZodDefault<z.ZodNumber>;
    countertopThickness: z.ZodDefault<z.ZodNumber>;
    countertopOverhang: z.ZodDefault<z.ZodNumber>;
    countertopBackOverhang: z.ZodDefault<z.ZodNumber>;
    withFinishedBack: z.ZodDefault<z.ZodBoolean>;
    frontThickness: z.ZodDefault<z.ZodNumber>;
    frontGap: z.ZodDefault<z.ZodNumber>;
    frontStyle: z.ZodDefault<z.ZodEnum<{
        slab: "slab";
        shaker: "shaker";
        "raised-arch": "raised-arch";
    }>>;
    panelReady: z.ZodDefault<z.ZodBoolean>;
    handleStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        bar: "bar";
        cutout: "cutout";
        hole: "hole";
        knob: "knob";
    }>>;
    handlePosition: z.ZodDefault<z.ZodEnum<{
        center: "center";
        top: "top";
        auto: "auto";
    }>>;
    frontOverlay: z.ZodDefault<z.ZodEnum<{
        inset: "inset";
        full: "full";
    }>>;
    withBottomPanel: z.ZodDefault<z.ZodBoolean>;
    showPlinth: z.ZodDefault<z.ZodBoolean>;
    withCountertop: z.ZodDefault<z.ZodBoolean>;
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
    stack: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"shelf">;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"drawer">;
        drawerCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"door">;
        doorType: z.ZodOptional<z.ZodEnum<{
            glass: "glass";
            double: "double";
            "single-left": "single-left";
            "single-right": "single-right";
        }>>;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sink">;
        sinkLayout: z.ZodOptional<z.ZodEnum<{
            double: "double";
            single: "single";
            "double-offset": "double-offset";
        }>>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"oven">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"microwave">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"dishwasher">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        cooktopLayout: z.ZodOptional<z.ZodEnum<{
            "gas-2burner": "gas-2burner";
            "gas-4burner": "gas-4burner";
            "gas-5burner-wok": "gas-5burner-wok";
            "gas-6burner": "gas-6burner";
        }>>;
        cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
        cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
        type: z.ZodLiteral<"cooktop-gas">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        cooktopLayout: z.ZodOptional<z.ZodEnum<{
            "induction-2zone": "induction-2zone";
            "induction-4zone": "induction-4zone";
        }>>;
        cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
        cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
        type: z.ZodLiteral<"cooktop-induction">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"pull-out-pantry">;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        pantryRackStyle: z.ZodOptional<z.ZodEnum<{
            glass: "glass";
            wire: "wire";
            tray: "tray";
        }>>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-single">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-double">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-top-freezer">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-bottom-freezer">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"hood-pyramid">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"hood-curved-glass">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "type">>>;
    id: z.ZodDefault<z.ZodTemplateLiteral<`cabinet_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"cabinet">>;
    runTier: z.ZodDefault<z.ZodEnum<{
        wall: "wall";
        base: "base";
        tall: "tall";
    }>>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    barLedge: z.ZodOptional<z.ZodObject<{
        edge: z.ZodDefault<z.ZodEnum<{
            back: "back";
            right: "right";
            left: "left";
        }>>;
        height: z.ZodDefault<z.ZodNumber>;
        depth: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    withWaterfall: z.ZodDefault<z.ZodBoolean>;
    withFinishedEnds: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    carcassHeight: z.ZodDefault<z.ZodNumber>;
    operationState: z.ZodDefault<z.ZodNumber>;
    plinthHeight: z.ZodDefault<z.ZodNumber>;
    toeKickDepth: z.ZodDefault<z.ZodNumber>;
    boardThickness: z.ZodDefault<z.ZodNumber>;
    countertopThickness: z.ZodDefault<z.ZodNumber>;
    countertopOverhang: z.ZodDefault<z.ZodNumber>;
    countertopBackOverhang: z.ZodDefault<z.ZodNumber>;
    withFinishedBack: z.ZodDefault<z.ZodBoolean>;
    frontThickness: z.ZodDefault<z.ZodNumber>;
    frontGap: z.ZodDefault<z.ZodNumber>;
    frontStyle: z.ZodDefault<z.ZodEnum<{
        slab: "slab";
        shaker: "shaker";
        "raised-arch": "raised-arch";
    }>>;
    panelReady: z.ZodDefault<z.ZodBoolean>;
    handleStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        bar: "bar";
        cutout: "cutout";
        hole: "hole";
        knob: "knob";
    }>>;
    handlePosition: z.ZodDefault<z.ZodEnum<{
        center: "center";
        top: "top";
        auto: "auto";
    }>>;
    frontOverlay: z.ZodDefault<z.ZodEnum<{
        inset: "inset";
        full: "full";
    }>>;
    withBottomPanel: z.ZodDefault<z.ZodBoolean>;
    showPlinth: z.ZodDefault<z.ZodBoolean>;
    withCountertop: z.ZodDefault<z.ZodBoolean>;
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
    stack: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"shelf">;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"drawer">;
        drawerCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"door">;
        doorType: z.ZodOptional<z.ZodEnum<{
            glass: "glass";
            double: "double";
            "single-left": "single-left";
            "single-right": "single-right";
        }>>;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sink">;
        sinkLayout: z.ZodOptional<z.ZodEnum<{
            double: "double";
            single: "single";
            "double-offset": "double-offset";
        }>>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"oven">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"microwave">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"dishwasher">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        cooktopLayout: z.ZodOptional<z.ZodEnum<{
            "gas-2burner": "gas-2burner";
            "gas-4burner": "gas-4burner";
            "gas-5burner-wok": "gas-5burner-wok";
            "gas-6burner": "gas-6burner";
        }>>;
        cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
        cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
        type: z.ZodLiteral<"cooktop-gas">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        cooktopLayout: z.ZodOptional<z.ZodEnum<{
            "induction-2zone": "induction-2zone";
            "induction-4zone": "induction-4zone";
        }>>;
        cooktopBurnersOn: z.ZodOptional<z.ZodBoolean>;
        cooktopActiveBurners: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopKnobProgress: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        cooktopShowGrate: z.ZodOptional<z.ZodBoolean>;
        type: z.ZodLiteral<"cooktop-induction">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"pull-out-pantry">;
        shelfCount: z.ZodOptional<z.ZodNumber>;
        pantryRackStyle: z.ZodOptional<z.ZodEnum<{
            glass: "glass";
            wire: "wire";
            tray: "tray";
        }>>;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-single">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-double">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-top-freezer">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"fridge-bottom-freezer">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"hood-pyramid">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"hood-curved-glass">;
        id: z.ZodString;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "type">>>;
    id: z.ZodDefault<z.ZodTemplateLiteral<`cabinet-module_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"cabinet-module">>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    cabinetType: z.ZodDefault<z.ZodEnum<{
        base: "base";
        tall: "tall";
    }>>;
    moduleKind: z.ZodDefault<z.ZodEnum<{
        standard: "standard";
        "corner-filler": "corner-filler";
    }>>;
    openSide: z.ZodOptional<z.ZodEnum<{
        right: "right";
        left: "left";
    }>>;
    cornerShelf: z.ZodOptional<z.ZodBoolean>;
    topFinish: z.ZodDefault<z.ZodEnum<{
        trim: "trim";
        none: "none";
        "top-cabinet": "top-cabinet";
    }>>;
    topFinishHeight: z.ZodDefault<z.ZodNumber>;
    topFinishDepth: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`procedural-item_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"procedural-item">>;
    recipe: z.ZodPipe<z.ZodCustom<{
        version: 1;
        name: string;
        description: string;
        parameters: {
            id: string;
            label: string;
            default: number;
            min: number;
            max: number;
            step: number;
            unit: "count" | "m" | "rad" | "s";
            part?: string | undefined;
            axis?: "x" | "y" | "z" | undefined;
        }[];
        slots: {
            id: string;
            label: string;
            color: string;
            finish?: "wood" | "glass" | "metal" | undefined;
        }[];
        parts: {
            id: string;
            label: string;
            count: import("../procedural-items/index.js").Expr;
            shapes: {
                id: string;
                primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
                slot: string;
                size: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                rotation?: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr] | undefined;
                radius?: import("../procedural-items/index.js").Expr | undefined;
                topScale?: import("../procedural-items/index.js").Expr | undefined;
                support?: boolean | undefined;
            }[];
            motion?: {
                kind: "hinge";
                pivot: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                angle: import("../procedural-items/index.js").Expr;
                delay?: import("../procedural-items/index.js").Expr | undefined;
                duration?: import("../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "slide";
                axis: "x" | "y" | "z";
                distance: import("../procedural-items/index.js").Expr;
                delay?: import("../procedural-items/index.js").Expr | undefined;
                duration?: import("../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "spin";
                pivot: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                radiansPerSecond: import("../procedural-items/index.js").Expr;
            } | undefined;
            light?: {
                position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                color: string;
                intensity?: number | undefined;
                distance?: number | undefined;
                emissiveSlot?: string | undefined;
            } | undefined;
        }[];
        constraints: {
            left: import("../procedural-items/index.js").Expr;
            relation: "lte" | "gte";
            right: import("../procedural-items/index.js").Expr;
            message: string;
        }[];
        classification?: {
            category: string;
            functionTags: string[];
            tags: string[];
        } | undefined;
        mounting?: {
            attachTo: "ceiling" | "wall-side";
            reference: string;
        } | undefined;
        surfaces?: {
            id: string;
            label: string;
            position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
            size: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
            part?: string | undefined;
            rotation?: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr] | undefined;
        }[] | undefined;
    }, {
        version: 1;
        name: string;
        description: string;
        parameters: {
            id: string;
            label: string;
            default: number;
            min: number;
            max: number;
            step: number;
            unit: "count" | "m" | "rad" | "s";
            part?: string | undefined;
            axis?: "x" | "y" | "z" | undefined;
        }[];
        slots: {
            id: string;
            label: string;
            color: string;
            finish?: "wood" | "glass" | "metal" | undefined;
        }[];
        parts: {
            id: string;
            label: string;
            count: import("../procedural-items/index.js").Expr;
            shapes: {
                id: string;
                primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
                slot: string;
                size: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                rotation?: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr] | undefined;
                radius?: import("../procedural-items/index.js").Expr | undefined;
                topScale?: import("../procedural-items/index.js").Expr | undefined;
                support?: boolean | undefined;
            }[];
            motion?: {
                kind: "hinge";
                pivot: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                angle: import("../procedural-items/index.js").Expr;
                delay?: import("../procedural-items/index.js").Expr | undefined;
                duration?: import("../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "slide";
                axis: "x" | "y" | "z";
                distance: import("../procedural-items/index.js").Expr;
                delay?: import("../procedural-items/index.js").Expr | undefined;
                duration?: import("../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "spin";
                pivot: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                radiansPerSecond: import("../procedural-items/index.js").Expr;
            } | undefined;
            light?: {
                position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                color: string;
                intensity?: number | undefined;
                distance?: number | undefined;
                emissiveSlot?: string | undefined;
            } | undefined;
        }[];
        constraints: {
            left: import("../procedural-items/index.js").Expr;
            relation: "lte" | "gte";
            right: import("../procedural-items/index.js").Expr;
            message: string;
        }[];
        classification?: {
            category: string;
            functionTags: string[];
            tags: string[];
        } | undefined;
        mounting?: {
            attachTo: "ceiling" | "wall-side";
            reference: string;
        } | undefined;
        surfaces?: {
            id: string;
            label: string;
            position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
            size: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
            part?: string | undefined;
            rotation?: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr] | undefined;
        }[] | undefined;
    }>, z.ZodTransform<{
        version: 1;
        name: string;
        description: string;
        parameters: {
            id: string;
            label: string;
            default: number;
            min: number;
            max: number;
            step: number;
            unit: "count" | "m" | "rad" | "s";
            part?: string | undefined;
            axis?: "x" | "y" | "z" | undefined;
        }[];
        slots: {
            id: string;
            label: string;
            color: string;
            finish?: "wood" | "glass" | "metal" | undefined;
        }[];
        parts: {
            id: string;
            label: string;
            count: import("../procedural-items/index.js").Expr;
            shapes: {
                id: string;
                primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
                slot: string;
                size: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                rotation?: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr] | undefined;
                radius?: import("../procedural-items/index.js").Expr | undefined;
                topScale?: import("../procedural-items/index.js").Expr | undefined;
                support?: boolean | undefined;
            }[];
            motion?: {
                kind: "hinge";
                pivot: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                angle: import("../procedural-items/index.js").Expr;
                delay?: import("../procedural-items/index.js").Expr | undefined;
                duration?: import("../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "slide";
                axis: "x" | "y" | "z";
                distance: import("../procedural-items/index.js").Expr;
                delay?: import("../procedural-items/index.js").Expr | undefined;
                duration?: import("../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "spin";
                pivot: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                radiansPerSecond: import("../procedural-items/index.js").Expr;
            } | undefined;
            light?: {
                position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                color: string;
                intensity?: number | undefined;
                distance?: number | undefined;
                emissiveSlot?: string | undefined;
            } | undefined;
        }[];
        constraints: {
            left: import("../procedural-items/index.js").Expr;
            relation: "lte" | "gte";
            right: import("../procedural-items/index.js").Expr;
            message: string;
        }[];
        classification?: {
            category: string;
            functionTags: string[];
            tags: string[];
        } | undefined;
        mounting?: {
            attachTo: "ceiling" | "wall-side";
            reference: string;
        } | undefined;
        surfaces?: {
            id: string;
            label: string;
            position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
            size: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
            part?: string | undefined;
            rotation?: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr] | undefined;
        }[] | undefined;
    }, {
        version: 1;
        name: string;
        description: string;
        parameters: {
            id: string;
            label: string;
            default: number;
            min: number;
            max: number;
            step: number;
            unit: "count" | "m" | "rad" | "s";
            part?: string | undefined;
            axis?: "x" | "y" | "z" | undefined;
        }[];
        slots: {
            id: string;
            label: string;
            color: string;
            finish?: "wood" | "glass" | "metal" | undefined;
        }[];
        parts: {
            id: string;
            label: string;
            count: import("../procedural-items/index.js").Expr;
            shapes: {
                id: string;
                primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
                slot: string;
                size: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                rotation?: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr] | undefined;
                radius?: import("../procedural-items/index.js").Expr | undefined;
                topScale?: import("../procedural-items/index.js").Expr | undefined;
                support?: boolean | undefined;
            }[];
            motion?: {
                kind: "hinge";
                pivot: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                angle: import("../procedural-items/index.js").Expr;
                delay?: import("../procedural-items/index.js").Expr | undefined;
                duration?: import("../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "slide";
                axis: "x" | "y" | "z";
                distance: import("../procedural-items/index.js").Expr;
                delay?: import("../procedural-items/index.js").Expr | undefined;
                duration?: import("../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "spin";
                pivot: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                radiansPerSecond: import("../procedural-items/index.js").Expr;
            } | undefined;
            light?: {
                position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
                color: string;
                intensity?: number | undefined;
                distance?: number | undefined;
                emissiveSlot?: string | undefined;
            } | undefined;
        }[];
        constraints: {
            left: import("../procedural-items/index.js").Expr;
            relation: "lte" | "gte";
            right: import("../procedural-items/index.js").Expr;
            message: string;
        }[];
        classification?: {
            category: string;
            functionTags: string[];
            tags: string[];
        } | undefined;
        mounting?: {
            attachTo: "ceiling" | "wall-side";
            reference: string;
        } | undefined;
        surfaces?: {
            id: string;
            label: string;
            position: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
            size: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr];
            part?: string | undefined;
            rotation?: [import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr, import("../procedural-items/index.js").Expr] | undefined;
        }[] | undefined;
    }>>;
    parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    slots: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    wallId: z.ZodOptional<z.ZodString>;
    side: z.ZodOptional<z.ZodEnum<{
        front: "front";
        back: "back";
    }>>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    attachments: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`imesh_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"imported-mesh">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    primitives: z.ZodDefault<z.ZodArray<z.ZodObject<{
        positions: z.ZodArray<z.ZodNumber>;
        normals: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        indices: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
        color: z.ZodDefault<z.ZodString>;
        opacity: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
    object: z.ZodDefault<z.ZodLiteral<"node">>;
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`zone_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"zone">>;
    name: z.ZodString;
    polygon: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    autoFromWalls: z.ZodDefault<z.ZodBoolean>;
    boundaryWallIds: z.ZodDefault<z.ZodArray<z.ZodDefault<z.ZodTemplateLiteral<`wall_${string}`>>>>;
    spaceRole: z.ZodDefault<z.ZodEnum<{
        generic: "generic";
        room: "room";
    }>>;
    roomNumber: z.ZodDefault<z.ZodString>;
    enclosureStatus: z.ZodDefault<z.ZodEnum<{
        auto: "auto";
        open: "open";
        enclosed: "enclosed";
    }>>;
    floorFinish: z.ZodDefault<z.ZodString>;
    wallFinish: z.ZodDefault<z.ZodString>;
    ceilingFinish: z.ZodDefault<z.ZodString>;
    ceilingHeight: z.ZodDefault<z.ZodNumber>;
    occupancy: z.ZodDefault<z.ZodString>;
    clearDimensionPolicy: z.ZodDefault<z.ZodEnum<{
        none: "none";
        "inside-faces": "inside-faces";
        "finish-faces": "finish-faces";
    }>>;
    color: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`slab_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"slab">>;
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
    polygon: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    holes: z.ZodDefault<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>>>;
    holeMetadata: z.ZodDefault<z.ZodArray<z.ZodObject<{
        source: z.ZodDefault<z.ZodEnum<{
            stair: "stair";
            elevator: "elevator";
            manual: "manual";
        }>>;
        stairId: z.ZodOptional<z.ZodString>;
        elevatorId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    elevation: z.ZodDefault<z.ZodNumber>;
    thickness: z.ZodDefault<z.ZodNumber>;
    recessed: z.ZodDefault<z.ZodBoolean>;
    recessedRimElevation: z.ZodOptional<z.ZodNumber>;
    fillToTerrain: z.ZodOptional<z.ZodBoolean>;
    autoFromWalls: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`ceiling_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"ceiling">>;
    children: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodDefault<z.ZodTemplateLiteral<`item_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`procedural-item_${string}`>>]>>>;
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
    polygon: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    holes: z.ZodDefault<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>>>;
    holeMetadata: z.ZodDefault<z.ZodArray<z.ZodObject<{
        source: z.ZodDefault<z.ZodEnum<{
            stair: "stair";
            elevator: "elevator";
            manual: "manual";
        }>>;
        stairId: z.ZodOptional<z.ZodString>;
        elevatorId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    height: z.ZodOptional<z.ZodNumber>;
    autoFromWalls: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`rseg_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"roof-segment">>;
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
    roofType: z.ZodDefault<z.ZodEnum<{
        flat: "flat";
        hip: "hip";
        gable: "gable";
        shed: "shed";
        gambrel: "gambrel";
        dutch: "dutch";
        mansard: "mansard";
        conical: "conical";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    conicalStartAngle: z.ZodOptional<z.ZodNumber>;
    conicalSweepAngle: z.ZodOptional<z.ZodNumber>;
    conicalFullCircle: z.ZodOptional<z.ZodBoolean>;
    trim: z.ZodDefault<z.ZodObject<{
        left: z.ZodDefault<z.ZodNumber>;
        right: z.ZodDefault<z.ZodNumber>;
        front: z.ZodDefault<z.ZodNumber>;
        back: z.ZodDefault<z.ZodNumber>;
        frontLeft: z.ZodDefault<z.ZodNumber>;
        frontRight: z.ZodDefault<z.ZodNumber>;
        backLeft: z.ZodDefault<z.ZodNumber>;
        backRight: z.ZodDefault<z.ZodNumber>;
        frontLeftX: z.ZodDefault<z.ZodNumber>;
        frontLeftZ: z.ZodDefault<z.ZodNumber>;
        frontRightX: z.ZodDefault<z.ZodNumber>;
        frontRightZ: z.ZodDefault<z.ZodNumber>;
        backLeftX: z.ZodDefault<z.ZodNumber>;
        backLeftZ: z.ZodDefault<z.ZodNumber>;
        backRightX: z.ZodDefault<z.ZodNumber>;
        backRightZ: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    wallHeight: z.ZodDefault<z.ZodNumber>;
    pitch: z.ZodDefault<z.ZodNumber>;
    wallThickness: z.ZodDefault<z.ZodNumber>;
    deckThickness: z.ZodDefault<z.ZodNumber>;
    overhang: z.ZodDefault<z.ZodNumber>;
    shingleThickness: z.ZodDefault<z.ZodNumber>;
    arc: z.ZodOptional<z.ZodObject<{
        centerX: z.ZodNumber;
        centerZ: z.ZodNumber;
        radius: z.ZodNumber;
    }, z.core.$strip>>;
    shedSideInfillSpan: z.ZodOptional<z.ZodNumber>;
    shedSideInfillMinX: z.ZodOptional<z.ZodNumber>;
    shedSideInfillMaxX: z.ZodOptional<z.ZodNumber>;
    shedFootprintPieces: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>>>;
    shedOpenEndSides: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        right: "right";
        left: "left";
    }>>>;
    shedJointFrame: z.ZodOptional<z.ZodObject<{
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        rotation: z.ZodNumber;
    }, z.core.$strip>>;
    shedJointOwnerId: z.ZodOptional<z.ZodString>;
    shedJointNeighborIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    shedJointScopeId: z.ZodOptional<z.ZodString>;
    managedByParent: z.ZodDefault<z.ZodBoolean>;
    wallShell: z.ZodDefault<z.ZodEnum<{
        omit: "omit";
        auto: "auto";
        include: "include";
    }>>;
    shedInsetEndPanels: z.ZodDefault<z.ZodBoolean>;
    fascia: z.ZodOptional<z.ZodBoolean>;
    fasciaHighEdge: z.ZodOptional<z.ZodBoolean>;
    gambrelLowerWidthRatio: z.ZodDefault<z.ZodNumber>;
    gambrelLowerHeightRatio: z.ZodDefault<z.ZodNumber>;
    mansardSteepWidthRatio: z.ZodDefault<z.ZodNumber>;
    mansardSteepHeightRatio: z.ZodDefault<z.ZodNumber>;
    dutchHipWidthRatio: z.ZodDefault<z.ZodNumber>;
    dutchHipHeightRatio: z.ZodDefault<z.ZodNumber>;
    dutchWaistLengthRatio: z.ZodDefault<z.ZodNumber>;
    dutchGabletRake: z.ZodDefault<z.ZodNumber>;
    dutchTopRakeThickness: z.ZodDefault<z.ZodNumber>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`shelf_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"shelf">>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    thickness: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    style: z.ZodDefault<z.ZodEnum<{
        "wall-shelf": "wall-shelf";
        bookshelf: "bookshelf";
        "open-rack": "open-rack";
        cubby: "cubby";
    }>>;
    rows: z.ZodDefault<z.ZodNumber>;
    columns: z.ZodDefault<z.ZodNumber>;
    withBack: z.ZodDefault<z.ZodBoolean>;
    withSides: z.ZodDefault<z.ZodBoolean>;
    withBottom: z.ZodDefault<z.ZodBoolean>;
    bracketStyle: z.ZodDefault<z.ZodEnum<{
        hidden: "hidden";
        minimal: "minimal";
        industrial: "industrial";
    }>>;
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`scan_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"scan">>;
    url: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    captureSession: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        sessionId: z.ZodString;
        schemaVersion: z.ZodOptional<z.ZodNumber>;
        revisionId: z.ZodOptional<z.ZodString>;
        manifestUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    layers: z.ZodPipe<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodBoolean>>, z.ZodTransform<Record<string, boolean>, Record<string, boolean>>>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    scale: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`guide_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"guide">>;
    url: z.ZodString;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    scale: z.ZodDefault<z.ZodNumber>;
    opacity: z.ZodDefault<z.ZodNumber>;
    scaleReference: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        start: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        end: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        realLengthMeters: z.ZodNumber;
        measuredLengthUnits: z.ZodNumber;
        metersPerUnit: z.ZodNumber;
        label: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`measurement_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"measurement">>;
    measurement: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"distance">;
        points: z.ZodTuple<[z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            kind: z.ZodLiteral<"feature">;
            reference: z.ZodObject<{
                nodeId: z.ZodString;
                featureId: z.ZodString;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
            }, z.core.$strip>;
            fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>]>, z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            kind: z.ZodLiteral<"feature">;
            reference: z.ZodObject<{
                nodeId: z.ZodString;
                featureId: z.ZodString;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
            }, z.core.$strip>;
            fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>]>], null>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"angle">;
        points: z.ZodTuple<[z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            kind: z.ZodLiteral<"feature">;
            reference: z.ZodObject<{
                nodeId: z.ZodString;
                featureId: z.ZodString;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
            }, z.core.$strip>;
            fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>]>, z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            kind: z.ZodLiteral<"feature">;
            reference: z.ZodObject<{
                nodeId: z.ZodString;
                featureId: z.ZodString;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
            }, z.core.$strip>;
            fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>]>, z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            kind: z.ZodLiteral<"feature">;
            reference: z.ZodObject<{
                nodeId: z.ZodString;
                featureId: z.ZodString;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
            }, z.core.$strip>;
            fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>]>], null>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"area">;
        base: z.ZodArray<z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            kind: z.ZodLiteral<"feature">;
            reference: z.ZodObject<{
                nodeId: z.ZodString;
                featureId: z.ZodString;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
            }, z.core.$strip>;
            fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>]>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"perimeter">;
        base: z.ZodArray<z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            kind: z.ZodLiteral<"feature">;
            reference: z.ZodObject<{
                nodeId: z.ZodString;
                featureId: z.ZodString;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
            }, z.core.$strip>;
            fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>]>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"volume">;
        base: z.ZodArray<z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
            kind: z.ZodLiteral<"feature">;
            reference: z.ZodObject<{
                nodeId: z.ZodString;
                featureId: z.ZodString;
                parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
            }, z.core.$strip>;
            fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>]>>;
        extrusion: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    }, z.core.$strip>], "kind">;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`spawn_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"spawn">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`bvent_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"box-vent">>;
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
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    hoodOverhang: z.ZodDefault<z.ZodNumber>;
    topTaper: z.ZodDefault<z.ZodNumber>;
    capHeight: z.ZodDefault<z.ZodNumber>;
    capGap: z.ZodDefault<z.ZodNumber>;
    domeCurvature: z.ZodDefault<z.ZodNumber>;
    baseInset: z.ZodDefault<z.ZodNumber>;
    baseHeight: z.ZodDefault<z.ZodNumber>;
    cornerBevel: z.ZodDefault<z.ZodNumber>;
    style: z.ZodPreprocess<z.ZodDefault<z.ZodEnum<{
        box: "box";
        cap: "cap";
        dome: "dome";
    }>>, unknown>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`rvent_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"ridge-vent">>;
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
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    length: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    style: z.ZodDefault<z.ZodEnum<{
        metal: "metal";
        standard: "standard";
        shingled: "shingled";
    }>>;
    endCaps: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`tvent_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"turbine-vent">>;
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
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    diameter: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    neckHeight: z.ZodDefault<z.ZodNumber>;
    baseOverhang: z.ZodDefault<z.ZodNumber>;
    vaneCount: z.ZodDefault<z.ZodNumber>;
    spinSpeed: z.ZodDefault<z.ZodNumber>;
    style: z.ZodDefault<z.ZodEnum<{
        cylinder: "cylinder";
        globe: "globe";
    }>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`cupola_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"cupola">>;
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
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    roofStyle: z.ZodDefault<z.ZodEnum<{
        dome: "dome";
        pyramid: "pyramid";
    }>>;
    finial: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`eyebrow-vent_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"eyebrow-vent">>;
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
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    style: z.ZodDefault<z.ZodEnum<{
        "half-round": "half-round";
        scoop: "scoop";
        "slant-box": "slant-box";
    }>>;
    louverCount: z.ZodDefault<z.ZodNumber>;
    backRatio: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`gutter_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"gutter">>;
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
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    length: z.ZodDefault<z.ZodNumber>;
    arc: z.ZodOptional<z.ZodObject<{
        centerX: z.ZodNumber;
        centerZ: z.ZodNumber;
        radius: z.ZodNumber;
    }, z.core.$strip>>;
    size: z.ZodDefault<z.ZodNumber>;
    thickness: z.ZodDefault<z.ZodNumber>;
    profile: z.ZodDefault<z.ZodEnum<{
        box: "box";
        "k-style": "k-style";
        "half-round": "half-round";
    }>>;
    endCapLeft: z.ZodDefault<z.ZodBoolean>;
    endCapRight: z.ZodDefault<z.ZodBoolean>;
    hangerStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        strap: "strap";
    }>>;
    hangerSpacing: z.ZodDefault<z.ZodNumber>;
    outlets: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        offset: z.ZodDefault<z.ZodNumber>;
        diameter: z.ZodDefault<z.ZodNumber>;
        generatedBy: z.ZodOptional<z.ZodLiteral<"default-downspout">>;
    }, z.core.$strip>>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`chimney_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"chimney">>;
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
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    bodyShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        square: "square";
    }>>;
    bodyHollowDepth: z.ZodDefault<z.ZodNumber>;
    bodyHollowMargin: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    heightAboveRidge: z.ZodDefault<z.ZodNumber>;
    cutoutOffset: z.ZodDefault<z.ZodNumber>;
    cornerBevel: z.ZodDefault<z.ZodNumber>;
    cap: z.ZodDefault<z.ZodBoolean>;
    capShape: z.ZodDefault<z.ZodEnum<{
        flat: "flat";
        none: "none";
        stepped: "stepped";
        sloped: "sloped";
    }>>;
    capOverhang: z.ZodDefault<z.ZodNumber>;
    capThickness: z.ZodDefault<z.ZodNumber>;
    flueCount: z.ZodDefault<z.ZodNumber>;
    flueShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        square: "square";
    }>>;
    flueHeight: z.ZodDefault<z.ZodNumber>;
    flueDiameter: z.ZodDefault<z.ZodNumber>;
    flueSpacing: z.ZodDefault<z.ZodNumber>;
    flueWallThickness: z.ZodDefault<z.ZodNumber>;
    shoulderStyle: z.ZodDefault<z.ZodEnum<{
        tapered: "tapered";
        none: "none";
        corbeled: "corbeled";
    }>>;
    shoulderHeight: z.ZodDefault<z.ZodNumber>;
    shoulderExtent: z.ZodDefault<z.ZodNumber>;
    bandStyle: z.ZodDefault<z.ZodEnum<{
        double: "double";
        none: "none";
        single: "single";
    }>>;
    bandHeight: z.ZodDefault<z.ZodNumber>;
    bandExtent: z.ZodDefault<z.ZodNumber>;
    bandOffset: z.ZodDefault<z.ZodNumber>;
    cricketStyle: z.ZodDefault<z.ZodEnum<{
        none: "none";
        simple: "simple";
    }>>;
    cricketLength: z.ZodDefault<z.ZodNumber>;
    cricketHeight: z.ZodDefault<z.ZodNumber>;
    cricketSide: z.ZodDefault<z.ZodEnum<{
        front: "front";
        back: "back";
    }>>;
    panelStyle: z.ZodDefault<z.ZodEnum<{
        rectangular: "rectangular";
        none: "none";
    }>>;
    panelDepth: z.ZodDefault<z.ZodNumber>;
    panelHeight: z.ZodDefault<z.ZodNumber>;
    panelOffsetTop: z.ZodDefault<z.ZodNumber>;
    panelMargin: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`solarpanel_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"solar-panel">>;
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
    panelMaterial: z.ZodOptional<z.ZodObject<{
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
    panelMaterialPreset: z.ZodOptional<z.ZodString>;
    panelTypePreset: z.ZodOptional<z.ZodEnum<{
        residential: "residential";
        "residential-large": "residential-large";
        compact: "compact";
        frameless: "frameless";
    }>>;
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    rows: z.ZodDefault<z.ZodNumber>;
    columns: z.ZodDefault<z.ZodNumber>;
    panelWidth: z.ZodDefault<z.ZodNumber>;
    panelHeight: z.ZodDefault<z.ZodNumber>;
    gapX: z.ZodDefault<z.ZodNumber>;
    gapY: z.ZodDefault<z.ZodNumber>;
    mountingType: z.ZodDefault<z.ZodEnum<{
        flush: "flush";
        tilted: "tilted";
    }>>;
    tiltAngle: z.ZodDefault<z.ZodNumber>;
    standoffHeight: z.ZodDefault<z.ZodNumber>;
    frameThickness: z.ZodDefault<z.ZodNumber>;
    frameDepth: z.ZodDefault<z.ZodNumber>;
    surfaceNormal: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`dormer_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"dormer">>;
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
    roofSegmentId: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    roofType: z.ZodDefault<z.ZodEnum<{
        flat: "flat";
        hip: "hip";
        gable: "gable";
        shed: "shed";
        gambrel: "gambrel";
        dutch: "dutch";
        mansard: "mansard";
        conical: "conical";
    }>>;
    roofHeight: z.ZodDefault<z.ZodNumber>;
    shedHighSide: z.ZodDefault<z.ZodEnum<{
        front: "front";
        back: "back";
    }>>;
    wallSkirtHeight: z.ZodDefault<z.ZodNumber>;
    windowWidth: z.ZodDefault<z.ZodNumber>;
    windowHeight: z.ZodDefault<z.ZodNumber>;
    windowOffsetX: z.ZodDefault<z.ZodNumber>;
    windowOffsetY: z.ZodDefault<z.ZodNumber>;
    windowFrameThickness: z.ZodDefault<z.ZodNumber>;
    windowFrameDepth: z.ZodDefault<z.ZodNumber>;
    windowColumns: z.ZodDefault<z.ZodNumber>;
    windowRows: z.ZodDefault<z.ZodNumber>;
    windowDividerThickness: z.ZodDefault<z.ZodNumber>;
    windowShape: z.ZodDefault<z.ZodEnum<{
        rectangle: "rectangle";
        rounded: "rounded";
        arch: "arch";
    }>>;
    windowArchHeight: z.ZodDefault<z.ZodNumber>;
    windowCornerRadii: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    windowSill: z.ZodDefault<z.ZodBoolean>;
    windowSillDepth: z.ZodDefault<z.ZodNumber>;
    windowSillThickness: z.ZodDefault<z.ZodNumber>;
    children: z.ZodDefault<z.ZodArray<z.ZodDefault<z.ZodTemplateLiteral<`window_${string}`>>>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`duct-segment_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"duct-segment">>;
    path: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    autoHangers: z.ZodOptional<z.ZodBoolean>;
    hangerOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        fraction: z.ZodOptional<z.ZodNumber>;
        skipped: z.ZodOptional<z.ZodBoolean>;
        hostId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    hangerStyle: z.ZodOptional<z.ZodEnum<{
        double: "double";
        single: "single";
    }>>;
    hangerSpacing: z.ZodOptional<z.ZodNumber>;
    hangerMaxReach: z.ZodOptional<z.ZodNumber>;
    wallAttachment: z.ZodOptional<z.ZodObject<{
        wallId: z.ZodDefault<z.ZodTemplateLiteral<`wall_${string}`>>;
        side: z.ZodEnum<{
            front: "front";
            back: "back";
        }>;
        startUV: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        endUV: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        offset: z.ZodNumber;
    }, z.core.$strip>>;
    shape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    diameter: z.ZodDefault<z.ZodNumber>;
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    roll: z.ZodDefault<z.ZodNumber>;
    ductMaterial: z.ZodDefault<z.ZodEnum<{
        spiral: "spiral";
        "sheet-metal": "sheet-metal";
        flex: "flex";
        "duct-board": "duct-board";
    }>>;
    seamDetail: z.ZodDefault<z.ZodBoolean>;
    insulated: z.ZodDefault<z.ZodBoolean>;
    insulationR: z.ZodDefault<z.ZodNumber>;
    system: z.ZodDefault<z.ZodEnum<{
        supply: "supply";
        return: "return";
    }>>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`duct-fitting_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"duct-fitting">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    fittingType: z.ZodDefault<z.ZodEnum<{
        elbow: "elbow";
        tee: "tee";
        cross: "cross";
        reducer: "reducer";
        transition: "transition";
        "end-cap": "end-cap";
        damper: "damper";
        "access-panel": "access-panel";
        coupling: "coupling";
    }>>;
    shape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    inletShape: z.ZodOptional<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    outletShape: z.ZodOptional<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    shape2: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    width2: z.ZodDefault<z.ZodNumber>;
    height2: z.ZodDefault<z.ZodNumber>;
    angle: z.ZodDefault<z.ZodNumber>;
    branchAngle: z.ZodDefault<z.ZodNumber>;
    diameter: z.ZodDefault<z.ZodNumber>;
    diameter2: z.ZodDefault<z.ZodNumber>;
    ductMaterial: z.ZodDefault<z.ZodEnum<{
        "sheet-metal": "sheet-metal";
        flex: "flex";
        "duct-board": "duct-board";
    }>>;
    system: z.ZodDefault<z.ZodEnum<{
        supply: "supply";
        return: "return";
    }>>;
    damperAngle: z.ZodDefault<z.ZodNumber>;
    panelWidth: z.ZodDefault<z.ZodNumber>;
    panelHeight: z.ZodDefault<z.ZodNumber>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`duct-terminal_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"duct-terminal">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    terminalType: z.ZodDefault<z.ZodEnum<{
        "supply-register": "supply-register";
        diffuser: "diffuser";
        "return-grille": "return-grille";
    }>>;
    mount: z.ZodDefault<z.ZodEnum<{
        wall: "wall";
        ceiling: "ceiling";
        floor: "floor";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    collarShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    collarDiameter: z.ZodDefault<z.ZodNumber>;
    collarWidth: z.ZodDefault<z.ZodNumber>;
    collarHeight: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`hvac-equipment_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"hvac-equipment">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    equipmentType: z.ZodDefault<z.ZodEnum<{
        furnace: "furnace";
        "air-handler": "air-handler";
        condenser: "condenser";
    }>>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    supplyShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    returnShape: z.ZodDefault<z.ZodEnum<{
        round: "round";
        rect: "rect";
        oval: "oval";
    }>>;
    supplyDiameter: z.ZodDefault<z.ZodNumber>;
    returnDiameter: z.ZodDefault<z.ZodNumber>;
    supplyWidth: z.ZodDefault<z.ZodNumber>;
    supplyHeight: z.ZodDefault<z.ZodNumber>;
    returnWidth: z.ZodDefault<z.ZodNumber>;
    returnHeight: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`lineset_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"lineset">>;
    path: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    suctionDiameter: z.ZodDefault<z.ZodNumber>;
    liquidDiameter: z.ZodDefault<z.ZodNumber>;
    insulated: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`liquid-line_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"liquid-line">>;
    path: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    diameter: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`pipe-segment_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"pipe-segment">>;
    path: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    autoHangers: z.ZodOptional<z.ZodBoolean>;
    hangerOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        fraction: z.ZodOptional<z.ZodNumber>;
        skipped: z.ZodOptional<z.ZodBoolean>;
        hostId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    hangerStyle: z.ZodOptional<z.ZodEnum<{
        double: "double";
        single: "single";
    }>>;
    hangerSpacing: z.ZodOptional<z.ZodNumber>;
    hangerMaxReach: z.ZodOptional<z.ZodNumber>;
    wallAttachment: z.ZodOptional<z.ZodObject<{
        wallId: z.ZodDefault<z.ZodTemplateLiteral<`wall_${string}`>>;
        side: z.ZodEnum<{
            front: "front";
            back: "back";
        }>;
        startUV: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        endUV: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        offset: z.ZodNumber;
    }, z.core.$strip>>;
    diameter: z.ZodDefault<z.ZodNumber>;
    pipeMaterial: z.ZodDefault<z.ZodEnum<{
        abs: "abs";
        pvc: "pvc";
        "cast-iron": "cast-iron";
    }>>;
    system: z.ZodDefault<z.ZodEnum<{
        waste: "waste";
        vent: "vent";
    }>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`pipe-fitting_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"pipe-fitting">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    fittingType: z.ZodDefault<z.ZodEnum<{
        elbow: "elbow";
        cross: "cross";
        reducer: "reducer";
        "end-cap": "end-cap";
        coupling: "coupling";
        wye: "wye";
        "sanitary-tee": "sanitary-tee";
        cleanout: "cleanout";
    }>>;
    angle: z.ZodDefault<z.ZodNumber>;
    diameter: z.ZodDefault<z.ZodNumber>;
    diameter2: z.ZodDefault<z.ZodNumber>;
    cleanoutStyle: z.ZodDefault<z.ZodEnum<{
        end: "end";
        inline: "inline";
    }>>;
    pipeMaterial: z.ZodDefault<z.ZodEnum<{
        abs: "abs";
        pvc: "pvc";
        "cast-iron": "cast-iron";
    }>>;
    system: z.ZodDefault<z.ZodEnum<{
        waste: "waste";
        vent: "vent";
    }>>;
}, z.core.$strip>>, BareDiscriminator<z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`pipe-trap_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"pipe-trap">>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodNumber>;
    diameter: z.ZodDefault<z.ZodNumber>;
    pipeMaterial: z.ZodDefault<z.ZodEnum<{
        abs: "abs";
        pvc: "pvc";
        "cast-iron": "cast-iron";
    }>>;
    armLengthM: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>>], "type">;
export type AnyNode = z.infer<typeof AnyNode>;
export type AnyNodeType = AnyNode['type'];
export type AnyNodeId = AnyNode['id'];
/** One member schema of `AnyNode`, discriminator already projected to a bare literal. */
export type AnyNodeOption = (typeof AnyNode)['options'][number];
/** The node kind a union member accepts, read off its bare-literal discriminator. */
export declare const nodeKindOf: (option: AnyNodeOption) => AnyNodeType;
/** A plan-or-surface 2-vector in metres. */
export type FidelityV2 = readonly [number, number];
/** A 3-vector in metres, in the frame the owning field names. */
export type FidelityV3 = readonly [number, number, number];
/**
 * Identity of a generated part within its owner (F3):
 * `${generatorId}/${role}/${station}[/${sub}]`. A spacing station is its
 * integer lattice index `s<k>`, k = round((at − origin) / spacing), so a key
 * survives reload, split and extension. The owner node is implicit.
 */
export type PartKey = `${string}/${string}/${string}`;
/**
 * One finite surface patch of a host (F5a). Never names a family of faces.
 * `riser:<zoneId>/<boundaryKey>[/<k>]` replaces the retired `riser:<zoneId>`.
 * Wider recipe surface ids stay plain `SurfaceId` strings.
 */
export type SurfacePatchId = 'front' | 'back' | 'top' | 'underside' | 'bearing' | `cladding:${string}` | `riser:${string}/${string}` | `facet:${string}:covering` | `facet:${string}:underside` | `edge:${string}` | `face:${string}`;
/** What an anchor does when its patch or part splits, merges or vanishes. Absent = follow. */
export type AnchorPolicy = 'follow' | 'freeze';
/**
 * A point on one host patch (F5a): `Mount.surface` when `host` is `surface`.
 *
 * Chart (frozen): `point = [u, v, offset]` in metres. u is the patch frame's
 * local +X, offset runs along its outward normal (local +Y, the
 * `SurfaceFrame.normal`), and v = normal × u, so (u, v, normal) is
 * right-handed. In frame-local coordinates that is (x = u, y = offset,
 * z = −v); a `SurfaceRegion` point [x, z] is [u, −v]. On a wall's front patch
 * u runs along the wall and v up the face.
 */
export type SurfaceAnchor = {
    nodeId: string;
    partKey?: PartKey;
    surfaceId: string;
    point: FidelityV3;
    /** Part anchors: the part's station when written; > 1 mm drift = unresolved. */
    at?: number;
    policy?: AnchorPolicy;
};
/**
 * The contact enum (F6), stored as the node's own `anchor` field (items,
 * devices), never inside `Mount`: which envelope height sits on the mount
 * point. No default: a node without `anchor` keeps its legacy pose meaning.
 */
export type Anchor = 'bottom' | 'center' | 'top';
export type WallMountDatum = 'floor' | 'wall-base' | 'wall-top' | 'ceiling';
/** Orientation only. A normal never elects a height. */
export type MountAlign = 'normal' | 'plumb';
/**
 * The placement intent (F6); the stored pose is only a fallback.
 *
 * Frames (frozen):
 * - Horizontal hosts (`ceiling`, `floor`): `x`, `z` are level-local plan
 *   metres from the level origin, +Y up. The height is the evaluated host
 *   surface at (x, z); the envelope's footprint centre sits on (x, z).
 * - Vertical hosts (`wall`, and `surface` on a vertical patch): the node's
 *   local +Z is the finished face's outward normal and its local z = 0 plane
 *   (the envelope's back) lies on the finished face: the body face at
 *   ±thickness/2 where bare, a cladding's outer face where clad. `along` is
 *   measured on the face, `height` above `datum` (default `floor`: the
 *   finished floor on that side).
 * - The node's `anchor` names the envelope height (local +Y) that sits on
 *   the mount point. `align` orients the node; it never changes the elected
 *   height.
 */
export type Mount = {
    host: 'wall';
    wallId: string;
    side: 'front' | 'back';
    along: number;
    from?: 'start' | 'end' | 'opening';
    ref?: string;
    height: number;
    datum?: WallMountDatum;
} | {
    host: 'ceiling';
    ceilingId: string;
    x: number;
    z: number;
    align?: MountAlign;
} | {
    host: 'floor';
    x: number;
    z: number;
    supportSlabId?: string;
} | {
    host: 'surface';
    surface: SurfaceAnchor;
} | {
    host: 'free';
};
export type MountHost = Mount['host'];
/** A fit target for walls and service spaces (F5a); generalises `roofFit`. */
export type FitTarget = {
    source: 'roof' | 'ceiling' | 'slab';
    ids?: string[];
    datum?: 'underside' | 'top';
    offset?: number;
};
/**
 * A pinned definition (F1, F6 §Definitions are pinned). A saved scene names the
 * exact version or content hash it used, or carries the resolved payload
 * itself, so it resolves offline and a library correction never moves saved
 * geometry. Never a mutable global id or an account lookup. Exactly one arm:
 * a pin is a version or a hash, never both.
 *
 * `hash` is `sha256:` + lowercase hex SHA-256 of the UTF-8 bytes of the
 * resolved definition serialized with RFC 8785 JSON Canonicalization (JCS):
 * object keys sorted by UTF-16 code units, no whitespace, ECMAScript number
 * and string serialization. Key order in the source never changes the hash.
 */
export type DefinitionPin = {
    id: string;
    v: number;
    hash?: never;
} | {
    hash: `sha256:${string}`;
    id?: never;
    v?: never;
};
export type SectionFamily = 'I' | 'C' | 'L' | 'T' | 'Z' | 'rect-tube';
/** One section (F1). Metres; section x = across, y = up. */
export type SectionProfile = {
    kind: 'rectangle';
    width: number;
    depth: number;
    corner?: number;
} | {
    kind: 'round';
    radius: number;
    wall?: number;
} | {
    kind: 'oval';
    width: number;
    depth: number;
} | {
    kind: 'section';
    family: SectionFamily;
    width: number;
    depth: number;
    web: number;
    flange: number;
} | {
    kind: 'polygon';
    outer: FidelityV2[];
    holes?: FidelityV2[][];
} | {
    kind: 'ref';
    id: string;
    v: number;
    scale?: FidelityV2;
};
/** A section with its geometry inline: what a `ref` resolves to. */
export type ResolvedSectionProfile = Exclude<SectionProfile, {
    kind: 'ref';
}>;
/**
 * Section library (owner decision O4, frozen): a small immutable, versioned
 * core baseline (`source: 'core'`: rectangles, rounds, nominal lumber mapped
 * to actual sizes, standard steel shapes) plus portable presets
 * (`source: 'preset'`: casings, mouldings, fascia and gutter sections,
 * handrails, regional catalogues) that a scene pins by `{ id, v }` or content
 * hash and can carry with the project. An entry never changes once published.
 */
export type SectionLibraryEntry = {
    id: string;
    v: number;
    source: 'core' | 'preset';
    profile: ResolvedSectionProfile;
    /** The section point that rides the path, in section metres. */
    ride: FidelityV2;
};
/**
 * A member end cut (R §D2) as the sweep builder consumes it (F1). The cut
 * plane has `normal` (the path's frame; normalised before use) and crosses
 * the path `offset` metres beyond its end along the end tangent (negative
 * trims). The builder moves the swept end vertex by `offset` and passes
 * `normal` as `SweepEndSpec.cut.normal`; the persisted path never moves.
 * |n̂ · t| < 0.1 is a validation finding.
 */
export type EndCut = {
    normal: FidelityV3;
    offset: number;
};
/** A sweep end (F1): a planar cut through the end vertex and an optional cap. */
export type SweepEndSpec = {
    cut?: {
        normal: FidelityV3;
    };
    cap?: boolean;
};
export type MaterialPatternType = 'running-bond' | 'stack' | 'herringbone' | 'french' | 'plank' | 'lap' | 'seam' | 'grid' | 'mesh';
/**
 * One portable pattern parameter set (SI-R2, versioned). Lengths are metres in
 * UV space, where 1 UV unit = 1 m. `grid` (openings of `unit` between bars
 * `joint` wide) and `mesh` (wire of diameter `wire` at pitch `unit`) also
 * emit an alpha mask whose open fraction equals the geometric one; masks are
 * alpha-tested at 0.5, never blended, and reach the GLB as a texture. The other
 * types are opaque and emit no mask.
 */
export type MaterialPattern = {
    v: 1;
    type: MaterialPatternType;
    unit: FidelityV2;
    joint: number;
    jointColor?: string;
    bevel?: number;
    variation?: number;
    seed?: number;
    wire?: number;
};
export type DisplayMode = 'finished' | 'construction' | 'systems';
/** What a physical part is, for display and export (F4). A missing tag reads as `finish`. */
export type DisplayFamily = 'finish' | 'exposed-structure' | 'framing' | 'masonry' | 'sheathing' | 'insulation' | 'membrane' | 'fill' | 'foundation' | 'service-space' | 'device' | 'run' | 'inspection';
export type Discipline = 'mechanical' | 'plumbing' | 'electrical' | 'low-voltage' | 'fire';
/**
 * The project's saved look on the `site` node (owner decision O3, frozen), never
 * a scene-root key. `display` is the saved default for the personal display
 * state; SI-R5 adds `theme`, `sun`, `exposure`, `edges` and `shading` beside
 * it. Precedence: explicit local viewer toggles > `site.presentation` >
 * theme defaults. The canonical bake ignores it.
 */
export type SitePresentation = {
    display?: {
        mode?: DisplayMode;
        families?: Partial<Record<DisplayFamily, boolean>>;
        disciplines?: Partial<Record<Discipline, boolean>>;
        xray?: boolean;
        colorBy?: 'material' | 'service';
    };
};
export {};
//# sourceMappingURL=types.d.ts.map