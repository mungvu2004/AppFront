import { z } from 'zod';
export declare const MeasurementPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
export declare const MeasurementFeatureParameter: z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>;
export declare const MeasurementFeatureReference: z.ZodObject<{
    nodeId: z.ZodString;
    featureId: z.ZodString;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
}, z.core.$strip>;
export declare const MeasurementFeatureAnchor: z.ZodObject<{
    kind: z.ZodLiteral<"feature">;
    reference: z.ZodObject<{
        nodeId: z.ZodString;
        featureId: z.ZodString;
        parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
    }, z.core.$strip>;
    fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
}, z.core.$strip>;
/** A tuple is a free anchor and remains the compact legacy representation. */
export declare const MeasurementAnchor: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>, z.ZodObject<{
    kind: z.ZodLiteral<"feature">;
    reference: z.ZodObject<{
        nodeId: z.ZodString;
        featureId: z.ZodString;
        parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean, z.ZodNumber]>>>;
    }, z.core.$strip>;
    fallback: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
}, z.core.$strip>]>;
export declare const DistanceMeasurement: z.ZodObject<{
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
}, z.core.$strip>;
export declare const AngleMeasurement: z.ZodObject<{
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
}, z.core.$strip>;
export declare const AreaMeasurement: z.ZodObject<{
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
}, z.core.$strip>;
export declare const PerimeterMeasurement: z.ZodObject<{
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
}, z.core.$strip>;
export declare const VolumeMeasurement: z.ZodObject<{
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
}, z.core.$strip>;
export declare const MeasurementPayload: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
export declare const MeasurementNode: z.ZodObject<{
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
}, z.core.$strip>;
export type MeasurementPoint = z.infer<typeof MeasurementPoint>;
export type MeasurementFeatureParameter = z.infer<typeof MeasurementFeatureParameter>;
export type MeasurementFeatureReference = z.infer<typeof MeasurementFeatureReference>;
export type MeasurementFeatureAnchor = z.infer<typeof MeasurementFeatureAnchor>;
export type MeasurementAnchor = z.infer<typeof MeasurementAnchor>;
export type DistanceMeasurement = z.infer<typeof DistanceMeasurement>;
export type AngleMeasurement = z.infer<typeof AngleMeasurement>;
export type AreaMeasurement = z.infer<typeof AreaMeasurement>;
export type PerimeterMeasurement = z.infer<typeof PerimeterMeasurement>;
export type VolumeMeasurement = z.infer<typeof VolumeMeasurement>;
export type MeasurementPayload = z.infer<typeof MeasurementPayload>;
export type MeasurementNode = z.infer<typeof MeasurementNode>;
//# sourceMappingURL=measurement.d.ts.map