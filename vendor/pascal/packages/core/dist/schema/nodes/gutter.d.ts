import { z } from 'zod';
import { type RoofSegmentNode } from './roof-segment.js';
export declare const GUTTER_EAVE_TUCK_INWARD = 0.04;
export declare const GUTTER_EAVE_TUCK_UP = 0.04;
export type GutterEaveSide = '+X' | '-X' | '+Z' | '-Z';
export type GutterRun = {
    side: GutterEaveSide;
    position: [number, number, number];
    rotation: number;
    length: number;
};
export type GutterEdgeExclusion = {
    side: GutterEaveSide;
    from: number;
    to: number;
};
export declare const GutterOutlet: z.ZodObject<{
    id: z.ZodString;
    offset: z.ZodDefault<z.ZodNumber>;
    diameter: z.ZodDefault<z.ZodNumber>;
    generatedBy: z.ZodOptional<z.ZodLiteral<"default-downspout">>;
}, z.core.$strip>;
export type GutterOutlet = z.infer<typeof GutterOutlet>;
export declare const GutterNode: z.ZodObject<{
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
}, z.core.$strip>;
export type GutterNode = z.infer<typeof GutterNode>;
export declare function computeGutterEaveY(segment: Pick<RoofSegmentNode, 'wallHeight' | 'overhang' | 'pitch' | 'roofType'>): number;
export declare function getGutterRunsForSegment(segment: RoofSegmentNode, roofSegments?: readonly RoofSegmentNode[], exclusions?: readonly GutterEdgeExclusion[]): GutterRun[];
export declare function createDefaultGuttersForSegment(segment: RoofSegmentNode, roofSegments?: readonly RoofSegmentNode[], exclusions?: readonly GutterEdgeExclusion[]): GutterNode[];
export declare function getDefaultGutterSide(node: unknown, roofSegmentId?: RoofSegmentNode['id']): GutterEaveSide | null;
export declare function isDefaultGutterNode(node: unknown, roofSegmentId?: RoofSegmentNode['id']): node is GutterNode;
export declare function hasAutoGutterMetadata(segment: Pick<RoofSegmentNode, 'metadata'>): segment is Pick<RoofSegmentNode, 'metadata'> & {
    metadata: Record<string, unknown> & {
        autoGutter: boolean;
    };
};
export declare function isAutoGutterEnabled(segment: Pick<RoofSegmentNode, 'id' | 'children' | 'metadata'>, nodes?: Record<string, unknown>): boolean;
//# sourceMappingURL=gutter.d.ts.map