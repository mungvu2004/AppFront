import { z } from 'zod';
/**
 * Mailing / civic address the lot was resolved from. Every field is optional —
 * a hand-drawn site has no address and must still parse.
 */
export declare const SiteAddress: z.ZodObject<{
    street: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    zip: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SiteAddress = z.infer<typeof SiteAddress>;
/**
 * Provenance of the lot ring. Written by the site panel's "Find parcel" action
 * from the host's parcel service. `originLngLat` is the geocoded point the polygon
 * origin sits on (polygon points are metres, x east, z south).
 */
export declare const SiteParcel: z.ZodObject<{
    apn: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    county: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    lotAreaSqFt: z.ZodOptional<z.ZodNumber>;
    originLngLat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    resolvedAt: z.ZodOptional<z.ZodString>;
    layer: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type SiteParcel = z.infer<typeof SiteParcel>;
/** Required yards, METRES. `left` / `right` override `side` per-edge when set. */
export declare const SiteSetbacks: z.ZodObject<{
    front: z.ZodNumber;
    side: z.ZodNumber;
    rear: z.ZodNumber;
    left: z.ZodOptional<z.ZodNumber>;
    right: z.ZodOptional<z.ZodNumber>;
    streetSide: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type SiteSetbacks = z.infer<typeof SiteSetbacks>;
export declare const SiteDossier: z.ZodObject<{
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
}, z.core.$loose>;
export type SiteDossier = z.infer<typeof SiteDossier>;
export declare const SiteNode: z.ZodObject<{
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
}, z.core.$strip>;
/**
 * Read-side migration for scenes written before these fields existed, where
 * the plan tooling parked the same values under `metadata`. Returns a patch
 * (empty when there is nothing to lift) — callers merge it onto the node.
 *
 * Only cheap, unambiguous lifts are done here: `metadata.setbacks` (already
 * metres), `metadata.setbacksSource`, `metadata.zone`, `metadata.apn` and
 * `metadata.source`. Anything richer (full imported project records) is
 * left in `metadata` for the workstream that owns it.
 */
export declare function migrateSiteMetadata(node: {
    metadata?: unknown;
    setbacks?: SiteSetbacks | undefined;
    setbacksSource?: string | undefined;
    zone?: string | undefined;
    parcel?: SiteParcel | undefined;
}): Partial<SiteNode>;
export type SiteNode = z.infer<typeof SiteNode>;
//# sourceMappingURL=site.d.ts.map