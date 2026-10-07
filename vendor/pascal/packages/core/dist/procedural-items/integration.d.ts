import { type QueryNodes } from './query.js';
import type { Recipe, Vec3 } from './recipe.js';
export declare function prepareProceduralPlacement(recipe: Recipe, nodes: QueryNodes, placement: {
    parentId: string;
    position: Vec3;
    side?: 'front' | 'back';
}): {
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `procedural-item_${string}`;
    type: "procedural-item";
    recipe: {
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
            count: import("./recipe.js").Expr;
            shapes: {
                id: string;
                primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
                slot: string;
                size: [import("./recipe.js").Expr, import("./recipe.js").Expr, import("./recipe.js").Expr];
                position: [import("./recipe.js").Expr, import("./recipe.js").Expr, import("./recipe.js").Expr];
                rotation?: [import("./recipe.js").Expr, import("./recipe.js").Expr, import("./recipe.js").Expr] | undefined;
                radius?: import("./recipe.js").Expr | undefined;
                topScale?: import("./recipe.js").Expr | undefined;
                support?: boolean | undefined;
            }[];
            motion?: {
                kind: "hinge";
                pivot: [import("./recipe.js").Expr, import("./recipe.js").Expr, import("./recipe.js").Expr];
                axis: "x" | "y" | "z";
                angle: import("./recipe.js").Expr;
                delay?: import("./recipe.js").Expr | undefined;
                duration?: import("./recipe.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "slide";
                axis: "x" | "y" | "z";
                distance: import("./recipe.js").Expr;
                delay?: import("./recipe.js").Expr | undefined;
                duration?: import("./recipe.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "spin";
                pivot: [import("./recipe.js").Expr, import("./recipe.js").Expr, import("./recipe.js").Expr];
                axis: "x" | "y" | "z";
                radiansPerSecond: import("./recipe.js").Expr;
            } | undefined;
            light?: {
                position: [import("./recipe.js").Expr, import("./recipe.js").Expr, import("./recipe.js").Expr];
                color: string;
                intensity?: number | undefined;
                distance?: number | undefined;
                emissiveSlot?: string | undefined;
            } | undefined;
        }[];
        constraints: {
            left: import("./recipe.js").Expr;
            relation: "lte" | "gte";
            right: import("./recipe.js").Expr;
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
            position: [import("./recipe.js").Expr, import("./recipe.js").Expr, import("./recipe.js").Expr];
            size: [import("./recipe.js").Expr, import("./recipe.js").Expr];
            part?: string | undefined;
            rotation?: [import("./recipe.js").Expr, import("./recipe.js").Expr, import("./recipe.js").Expr] | undefined;
        }[] | undefined;
    };
    parameters: Record<string, number>;
    slots: Record<string, string>;
    position: [number, number, number];
    rotation: [number, number, number];
    children: string[];
    attachments: Record<string, string>;
    name?: string | undefined;
    camera?: {
        position: [number, number, number];
        target: [number, number, number];
        mode: "perspective" | "orthographic";
        fov?: number | undefined;
        zoom?: number | undefined;
    } | undefined;
    provenance?: {
        refs: {
            id: string;
            ns?: string | undefined;
            role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
        }[];
        lineage?: {
            op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
            fromIds: string[];
        } | undefined;
    } | undefined;
    wallId?: string | undefined;
    side?: "front" | "back" | undefined;
    supportSlabId?: string | undefined;
};
//# sourceMappingURL=integration.d.ts.map