import type { ItemNode } from '../schema/nodes/item.js';
import type { AnyNode } from '../schema/types.js';
import type { ProceduralItemNode } from './node.js';
import { type Vec3 } from './recipe.js';
import { type Frame } from './spatial.js';
export type QueryNodes = Readonly<Record<string, AnyNode | ProceduralItemNode>>;
export declare function isProceduralItem(node: unknown): node is ProceduralItemNode;
export declare function proceduralLocalPose(node: ProceduralItemNode, nodes: QueryNodes): {
    position: Vec3;
    rotation: Vec3;
};
export declare function proceduralFootprint(node: ProceduralItemNode): {
    position: Vec3;
    rotation: [number, number, number];
    dimensions: Vec3;
};
export type LevelFrameOptions = {
    /**
     * Frames already resolved over the same unchanged `nodes` record, filled as
     * hosts resolve, so a query over many nodes resolves each host once. Keep
     * one cache per `planOnly` setting.
     */
    cache?: Map<string, Frame>;
    /**
     * Resolve only the plan (XZ) placement: heights that need the scene (wall
     * slab support, ceiling height, floor lift) are taken as 0, which skips
     * their cost. Rotations and plan positions are exact.
     */
    planOnly?: boolean;
};
/** A node's frame in its level's coordinates. */
export declare function nodeLevelFrame(id: string, nodes: QueryNodes, seen?: Set<string>, options?: LevelFrameOptions): Frame;
export declare function attachmentBounds(child: ProceduralItemNode | ItemNode): import("./spatial.js").Bounds;
export declare function attachmentRegionsOverlap(a: ReturnType<typeof attachmentBounds>, b: ReturnType<typeof attachmentBounds>): boolean;
export declare function validateProceduralRelations(raw: AnyNode | ProceduralItemNode, nodes: QueryNodes): void;
export declare function queryProceduralItem(node: ProceduralItemNode, nodes: QueryNodes): {
    id: `procedural-item_${string}`;
    kind: "procedural-item";
    classification: {
        category: string;
        functionTags: string[];
        tags: string[];
    } | null;
    hostId: string | null;
    wallId: string | null;
    parameters: Record<string, number>;
    localBounds: {
        min: Vec3;
        max: Vec3;
        dimensions: Vec3;
    };
    levelBounds: import("./spatial.js").Bounds;
    frame: Frame;
    footprint: number[][];
    surfaces: {
        frame: Frame;
        id: string;
        label: string;
        position: Vec3;
        rotation: Vec3;
        normal: Vec3;
        size: [number, number];
    }[];
    children: string[];
};
//# sourceMappingURL=query.d.ts.map