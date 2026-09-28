import { z } from 'zod';
export declare const CaptureSessionLocatorSchema: z.ZodObject<{
    sessionId: z.ZodString;
    manifestUrl: z.ZodOptional<z.ZodString>;
    schemaVersion: z.ZodOptional<z.ZodNumber>;
    revisionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DeviceMotionSampleSchema: z.ZodObject<{
    segment: z.ZodNumber;
    timestamp: z.ZodNumber;
    transform: z.ZodArray<z.ZodNumber>;
}, z.core.$strip>;
export declare const DeviceMotionTrajectorySchema: z.ZodObject<{
    coordinateSystem: z.ZodString;
    samples: z.ZodArray<z.ZodObject<{
        segment: z.ZodNumber;
        timestamp: z.ZodNumber;
        transform: z.ZodArray<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ArkitDeviceMotionTrajectorySchema: z.ZodObject<{
    samples: z.ZodArray<z.ZodObject<{
        segment: z.ZodNumber;
        timestamp: z.ZodNumber;
        transform: z.ZodArray<z.ZodNumber>;
    }, z.core.$strip>>;
    coordinateSystem: z.ZodLiteral<"arkit-world">;
}, z.core.$strip>;
export declare const PointCloudPayloadSchema: z.ZodObject<{
    coordinateSystem: z.ZodString;
    positions: z.ZodArray<z.ZodNumber>;
    colors: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
}, z.core.$strip>;
export declare const ArkitPointCloudPayloadSchema: z.ZodObject<{
    positions: z.ZodArray<z.ZodNumber>;
    colors: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    coordinateSystem: z.ZodLiteral<"arkit-world">;
}, z.core.$strip>;
export declare const SurfaceMeshPayloadSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    coordinateSystem: z.ZodString;
    representation: z.ZodLiteral<"quantized-indexed-triangle-mesh">;
    appearance: z.ZodLiteral<"camera-vertex-color">;
    vertexCount: z.ZodNumber;
    faceCount: z.ZodNumber;
    boundsMin: z.ZodArray<z.ZodNumber>;
    boundsMax: z.ZodArray<z.ZodNumber>;
    positionEncoding: z.ZodLiteral<"uint16x3-base64-little-endian">;
    colorEncoding: z.ZodLiteral<"uint8x3-base64-srgb">;
    indexEncoding: z.ZodLiteral<"uint16x3-base64-little-endian">;
    positions: z.ZodString;
    colors: z.ZodString;
    indices: z.ZodString;
}, z.core.$strip>;
export declare const ArkitSurfaceMeshPayloadSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    representation: z.ZodLiteral<"quantized-indexed-triangle-mesh">;
    appearance: z.ZodLiteral<"camera-vertex-color">;
    vertexCount: z.ZodNumber;
    faceCount: z.ZodNumber;
    boundsMin: z.ZodArray<z.ZodNumber>;
    boundsMax: z.ZodArray<z.ZodNumber>;
    positionEncoding: z.ZodLiteral<"uint16x3-base64-little-endian">;
    colorEncoding: z.ZodLiteral<"uint8x3-base64-srgb">;
    indexEncoding: z.ZodLiteral<"uint16x3-base64-little-endian">;
    positions: z.ZodString;
    colors: z.ZodString;
    indices: z.ZodString;
    coordinateSystem: z.ZodLiteral<"arkit-world">;
}, z.core.$strip>;
export declare const CaptureTimeRangeSchema: z.ZodObject<{
    start: z.ZodNumber;
    end: z.ZodNumber;
}, z.core.$strip>;
export declare const CaptureArtifactReferenceSchema: z.ZodObject<{
    id: z.ZodString;
    uri: z.ZodOptional<z.ZodString>;
    mediaType: z.ZodString;
    byteLength: z.ZodOptional<z.ZodNumber>;
    sha256: z.ZodOptional<z.ZodString>;
    frameId: z.ZodOptional<z.ZodString>;
    timeRange: z.ZodOptional<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const CaptureStreamDescriptorSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodString;
    role: z.ZodOptional<z.ZodString>;
    availability: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        live: "live";
        ready: "ready";
        failed: "failed";
    }>>;
    frameId: z.ZodOptional<z.ZodString>;
    clockId: z.ZodOptional<z.ZodString>;
    artifact: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        uri: z.ZodOptional<z.ZodString>;
        mediaType: z.ZodString;
        byteLength: z.ZodOptional<z.ZodNumber>;
        sha256: z.ZodOptional<z.ZodString>;
        frameId: z.ZodOptional<z.ZodString>;
        timeRange: z.ZodOptional<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.core.$strip>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    inline: z.ZodOptional<z.ZodUnknown>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const CaptureClockSchema: z.ZodObject<{
    id: z.ZodString;
    timebase: z.ZodEnum<{
        seconds: "seconds";
        milliseconds: "milliseconds";
        microseconds: "microseconds";
        nanoseconds: "nanoseconds";
    }>;
    epoch: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const CaptureCoordinateFrameSchema: z.ZodObject<{
    id: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
    convention: z.ZodString;
    transform: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
}, z.core.$strip>;
export declare const CaptureSessionManifestV1Schema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    sessionId: z.ZodString;
    projectId: z.ZodString;
    streams: z.ZodObject<{
        roomModel: z.ZodOptional<z.ZodObject<{
            kind: z.ZodLiteral<"room-model">;
            mediaType: z.ZodLiteral<"model/vnd.usdz+zip">;
            url: z.ZodString;
        }, z.core.$strip>>;
        deviceMotion: z.ZodOptional<z.ZodObject<{
            kind: z.ZodLiteral<"device-motion">;
            trajectory: z.ZodObject<{
                samples: z.ZodArray<z.ZodObject<{
                    segment: z.ZodNumber;
                    timestamp: z.ZodNumber;
                    transform: z.ZodArray<z.ZodNumber>;
                }, z.core.$strip>>;
                coordinateSystem: z.ZodLiteral<"arkit-world">;
            }, z.core.$strip>;
        }, z.core.$strip>>;
        pointCloud: z.ZodOptional<z.ZodObject<{
            kind: z.ZodLiteral<"point-cloud">;
            points: z.ZodObject<{
                positions: z.ZodArray<z.ZodNumber>;
                colors: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
                coordinateSystem: z.ZodLiteral<"arkit-world">;
            }, z.core.$strip>;
        }, z.core.$strip>>;
        surfaceMesh: z.ZodOptional<z.ZodObject<{
            kind: z.ZodLiteral<"surface-mesh">;
            mesh: z.ZodObject<{
                version: z.ZodLiteral<1>;
                representation: z.ZodLiteral<"quantized-indexed-triangle-mesh">;
                appearance: z.ZodLiteral<"camera-vertex-color">;
                vertexCount: z.ZodNumber;
                faceCount: z.ZodNumber;
                boundsMin: z.ZodArray<z.ZodNumber>;
                boundsMax: z.ZodArray<z.ZodNumber>;
                positionEncoding: z.ZodLiteral<"uint16x3-base64-little-endian">;
                colorEncoding: z.ZodLiteral<"uint8x3-base64-srgb">;
                indexEncoding: z.ZodLiteral<"uint16x3-base64-little-endian">;
                positions: z.ZodString;
                colors: z.ZodString;
                indices: z.ZodString;
                coordinateSystem: z.ZodLiteral<"arkit-world">;
            }, z.core.$strip>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CaptureSessionManifestV2Schema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<2>;
    sessionId: z.ZodString;
    projectId: z.ZodOptional<z.ZodString>;
    revisionId: z.ZodOptional<z.ZodString>;
    state: z.ZodDefault<z.ZodEnum<{
        live: "live";
        ready: "ready";
        failed: "failed";
        finalizing: "finalizing";
    }>>;
    clocks: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        timebase: z.ZodEnum<{
            seconds: "seconds";
            milliseconds: "milliseconds";
            microseconds: "microseconds";
            nanoseconds: "nanoseconds";
        }>;
        epoch: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    coordinateFrames: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        parentId: z.ZodOptional<z.ZodString>;
        convention: z.ZodString;
        transform: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>>;
    streams: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodString;
        role: z.ZodOptional<z.ZodString>;
        availability: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            live: "live";
            ready: "ready";
            failed: "failed";
        }>>;
        frameId: z.ZodOptional<z.ZodString>;
        clockId: z.ZodOptional<z.ZodString>;
        artifact: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            uri: z.ZodOptional<z.ZodString>;
            mediaType: z.ZodString;
            byteLength: z.ZodOptional<z.ZodNumber>;
            sha256: z.ZodOptional<z.ZodString>;
            frameId: z.ZodOptional<z.ZodString>;
            timeRange: z.ZodOptional<z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, z.core.$strip>>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        inline: z.ZodOptional<z.ZodUnknown>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const CaptureSessionManifestSchema: z.ZodUnion<readonly [z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    sessionId: z.ZodString;
    projectId: z.ZodString;
    streams: z.ZodObject<{
        roomModel: z.ZodOptional<z.ZodObject<{
            kind: z.ZodLiteral<"room-model">;
            mediaType: z.ZodLiteral<"model/vnd.usdz+zip">;
            url: z.ZodString;
        }, z.core.$strip>>;
        deviceMotion: z.ZodOptional<z.ZodObject<{
            kind: z.ZodLiteral<"device-motion">;
            trajectory: z.ZodObject<{
                samples: z.ZodArray<z.ZodObject<{
                    segment: z.ZodNumber;
                    timestamp: z.ZodNumber;
                    transform: z.ZodArray<z.ZodNumber>;
                }, z.core.$strip>>;
                coordinateSystem: z.ZodLiteral<"arkit-world">;
            }, z.core.$strip>;
        }, z.core.$strip>>;
        pointCloud: z.ZodOptional<z.ZodObject<{
            kind: z.ZodLiteral<"point-cloud">;
            points: z.ZodObject<{
                positions: z.ZodArray<z.ZodNumber>;
                colors: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
                coordinateSystem: z.ZodLiteral<"arkit-world">;
            }, z.core.$strip>;
        }, z.core.$strip>>;
        surfaceMesh: z.ZodOptional<z.ZodObject<{
            kind: z.ZodLiteral<"surface-mesh">;
            mesh: z.ZodObject<{
                version: z.ZodLiteral<1>;
                representation: z.ZodLiteral<"quantized-indexed-triangle-mesh">;
                appearance: z.ZodLiteral<"camera-vertex-color">;
                vertexCount: z.ZodNumber;
                faceCount: z.ZodNumber;
                boundsMin: z.ZodArray<z.ZodNumber>;
                boundsMax: z.ZodArray<z.ZodNumber>;
                positionEncoding: z.ZodLiteral<"uint16x3-base64-little-endian">;
                colorEncoding: z.ZodLiteral<"uint8x3-base64-srgb">;
                indexEncoding: z.ZodLiteral<"uint16x3-base64-little-endian">;
                positions: z.ZodString;
                colors: z.ZodString;
                indices: z.ZodString;
                coordinateSystem: z.ZodLiteral<"arkit-world">;
            }, z.core.$strip>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<2>;
    sessionId: z.ZodString;
    projectId: z.ZodOptional<z.ZodString>;
    revisionId: z.ZodOptional<z.ZodString>;
    state: z.ZodDefault<z.ZodEnum<{
        live: "live";
        ready: "ready";
        failed: "failed";
        finalizing: "finalizing";
    }>>;
    clocks: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        timebase: z.ZodEnum<{
            seconds: "seconds";
            milliseconds: "milliseconds";
            microseconds: "microseconds";
            nanoseconds: "nanoseconds";
        }>;
        epoch: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    coordinateFrames: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        parentId: z.ZodOptional<z.ZodString>;
        convention: z.ZodString;
        transform: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>>;
    streams: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodString;
        role: z.ZodOptional<z.ZodString>;
        availability: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            live: "live";
            ready: "ready";
            failed: "failed";
        }>>;
        frameId: z.ZodOptional<z.ZodString>;
        clockId: z.ZodOptional<z.ZodString>;
        artifact: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            uri: z.ZodOptional<z.ZodString>;
            mediaType: z.ZodString;
            byteLength: z.ZodOptional<z.ZodNumber>;
            sha256: z.ZodOptional<z.ZodString>;
            frameId: z.ZodOptional<z.ZodString>;
            timeRange: z.ZodOptional<z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, z.core.$strip>>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        inline: z.ZodOptional<z.ZodUnknown>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>]>;
export declare const CaptureSessionDescriptorSchema: z.ZodObject<{
    schemaVersion: z.ZodNumber;
    sessionId: z.ZodString;
    projectId: z.ZodOptional<z.ZodString>;
    revisionId: z.ZodOptional<z.ZodString>;
    state: z.ZodEnum<{
        live: "live";
        ready: "ready";
        failed: "failed";
        finalizing: "finalizing";
    }>;
    clocks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        timebase: z.ZodEnum<{
            seconds: "seconds";
            milliseconds: "milliseconds";
            microseconds: "microseconds";
            nanoseconds: "nanoseconds";
        }>;
        epoch: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    coordinateFrames: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        parentId: z.ZodOptional<z.ZodString>;
        convention: z.ZodString;
        transform: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>;
    streams: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodString;
        role: z.ZodOptional<z.ZodString>;
        availability: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            live: "live";
            ready: "ready";
            failed: "failed";
        }>>;
        frameId: z.ZodOptional<z.ZodString>;
        clockId: z.ZodOptional<z.ZodString>;
        artifact: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            uri: z.ZodOptional<z.ZodString>;
            mediaType: z.ZodString;
            byteLength: z.ZodOptional<z.ZodNumber>;
            sha256: z.ZodOptional<z.ZodString>;
            frameId: z.ZodOptional<z.ZodString>;
            timeRange: z.ZodOptional<z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, z.core.$strip>>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        inline: z.ZodOptional<z.ZodUnknown>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type CaptureArtifactReference = z.infer<typeof CaptureArtifactReferenceSchema>;
export type CaptureClock = z.infer<typeof CaptureClockSchema>;
export type CaptureCoordinateFrame = z.infer<typeof CaptureCoordinateFrameSchema>;
export type CaptureSessionDescriptor = z.infer<typeof CaptureSessionDescriptorSchema>;
export type CaptureSessionLocator = z.infer<typeof CaptureSessionLocatorSchema>;
export type CaptureSessionManifest = z.infer<typeof CaptureSessionManifestSchema>;
export type CaptureSessionManifestV1 = z.infer<typeof CaptureSessionManifestV1Schema>;
export type CaptureSessionManifestV2 = z.infer<typeof CaptureSessionManifestV2Schema>;
export type CaptureStreamDescriptor = z.infer<typeof CaptureStreamDescriptorSchema>;
export type DeviceMotionTrajectoryPayload = z.infer<typeof DeviceMotionTrajectorySchema>;
export type PointCloudPayload = z.infer<typeof PointCloudPayloadSchema>;
export type SurfaceMeshPayload = z.infer<typeof SurfaceMeshPayloadSchema>;
export declare function normalizeCaptureSessionManifest(value: unknown): CaptureSessionDescriptor;
export declare function captureLayerKey(stream: CaptureStreamDescriptor): string;
export declare function captureStreamLabel(stream: CaptureStreamDescriptor): string;
//# sourceMappingURL=schema.d.ts.map