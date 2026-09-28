import { z } from 'zod';
export declare const BlockVertex: z.ZodObject<{
    id: z.ZodString;
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
}, z.core.$strip>;
export declare const BlockEdge: z.ZodObject<{
    id: z.ZodString;
    vertexIds: z.ZodTuple<[z.ZodString, z.ZodString], null>;
}, z.core.$strip>;
export declare const BlockFace: z.ZodObject<{
    id: z.ZodString;
    vertexIds: z.ZodArray<z.ZodString>;
    materialSlot: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
declare const BlockTopologyShape: z.ZodObject<{
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
}, z.core.$strip>;
export type BlockVertex = z.infer<typeof BlockVertex>;
export type BlockEdge = z.infer<typeof BlockEdge>;
export type BlockFace = z.infer<typeof BlockFace>;
export type BlockTopology = z.infer<typeof BlockTopologyShape>;
export type BlockFaceFrame = {
    origin: [number, number, number];
    xAxis: [number, number, number];
    yAxis: [number, number, number];
    normal: [number, number, number];
};
export declare function getBlockFaceNormal(topology: BlockTopology, face: BlockFace, vertices?: Map<string, [number, number, number]>): [number, number, number] | null;
export declare function getBlockFaceCentroid(topology: BlockTopology, face: BlockFace, vertices?: Map<string, [number, number, number]>): [number, number, number] | null;
export declare function getBlockFaceFrame(topology: BlockTopology, faceId: string): BlockFaceFrame | null;
export type BlockTopologyIssue = {
    path: (string | number)[];
    message: string;
};
export declare function blockUndirectedEdgeKey(a: string, b: string): string;
export declare function inspectBlockTopology(topology: BlockTopology): BlockTopologyIssue[];
export declare const BlockTopology: z.ZodObject<{
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
}, z.core.$strip>;
export declare function createBoxBlockTopology(width?: number, height?: number, depth?: number): BlockTopology;
export declare const BlockNode: z.ZodObject<{
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
}, z.core.$strip>;
export type BlockNode = z.infer<typeof BlockNode>;
export {};
//# sourceMappingURL=block.d.ts.map