import { z } from 'zod';
import { type Recipe } from './recipe.js';
export declare const ProceduralItemNode: z.ZodObject<{
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
}, z.core.$strip>;
export type ProceduralItemNode = z.infer<typeof ProceduralItemNode>;
export declare function parameterPatch(node: ProceduralItemNode, id: string, value: number): {
    parameters: {
        [x: string]: number;
    };
} | null;
export declare function snapParameters(recipe: Recipe, values: Record<string, number>): {
    [x: string]: number;
};
//# sourceMappingURL=node.d.ts.map