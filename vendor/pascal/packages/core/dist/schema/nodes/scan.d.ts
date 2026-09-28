import { z } from 'zod';
export declare const CaptureSessionReference: z.ZodObject<{
    sessionId: z.ZodString;
    schemaVersion: z.ZodOptional<z.ZodNumber>;
    revisionId: z.ZodOptional<z.ZodString>;
    manifestUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ScanLayerVisibility: z.ZodPipe<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodBoolean>>, z.ZodTransform<Record<string, boolean>, Record<string, boolean>>>;
export declare const ScanNode: z.ZodObject<{
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
}, z.core.$strip>;
export type CaptureSessionReference = z.infer<typeof CaptureSessionReference>;
export type CaptureSessionReferenceInput = z.input<typeof CaptureSessionReference>;
export type ScanLayerVisibility = z.infer<typeof ScanLayerVisibility>;
export type ScanNode = z.infer<typeof ScanNode>;
//# sourceMappingURL=scan.d.ts.map