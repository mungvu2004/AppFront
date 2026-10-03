import { z } from 'zod';
export declare const LeanToConnectionMode: z.ZodEnum<{
    manual: "manual";
    auto: "auto";
}>;
export declare const LeanToCanopyForm: z.ZodEnum<{
    gable: "gable";
    mono: "mono";
    butterfly: "butterfly";
}>;
export declare const LeanToHostKind: z.ZodEnum<{
    wall: "wall";
    "slab-edge": "slab-edge";
    freestanding: "freestanding";
    "conical-roof": "conical-roof";
}>;
export declare const LeanToRoofEdge: z.ZodEnum<{
    "+X": "+X";
    "-X": "-X";
    "+Z": "+Z";
    "-Z": "-Z";
}>;
export declare const LeanToResizeLock: z.ZodEnum<{
    "preserve-high-edge": "preserve-high-edge";
    "preserve-low-edge": "preserve-low-edge";
    "preserve-pitch": "preserve-pitch";
}>;
export declare const LeanToEndCondition: z.ZodEnum<{
    open: "open";
    "wall-abutment": "wall-abutment";
    joined: "joined";
}>;
export declare const LeanToFramingStrategy: z.ZodEnum<{
    hidden: "hidden";
    rafters: "rafters";
    purlins: "purlins";
    "covering-specific": "covering-specific";
}>;
export declare const LeanToHighSideMode: z.ZodEnum<{
    "wall-ledger": "wall-ledger";
    "independent-high-beam": "independent-high-beam";
}>;
export declare const LeanToPostLayoutMode: z.ZodEnum<{
    count: "count";
    "target-spacing": "target-spacing";
}>;
export declare const LeanToFootingStyle: z.ZodEnum<{
    none: "none";
    "base-plate": "base-plate";
    "concrete-pad": "concrete-pad";
}>;
export declare const LeanToCoveringType: z.ZodEnum<{
    generic: "generic";
    shingle: "shingle";
    "metal-panel": "metal-panel";
}>;
export type LeanToConnectionMode = z.infer<typeof LeanToConnectionMode>;
export type LeanToCanopyForm = z.infer<typeof LeanToCanopyForm>;
export type LeanToRoofEdge = z.infer<typeof LeanToRoofEdge>;
export declare const LeanToExtensionNode: z.ZodObject<{
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
}, z.core.$strip>;
export type LeanToExtensionNode = z.infer<typeof LeanToExtensionNode>;
//# sourceMappingURL=lean-to-extension.d.ts.map