import { z } from 'zod';
export type Expr = number | string | {
    op: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max';
    args: Expr[];
} | {
    op: 'floor' | 'ceil' | 'round' | 'abs' | 'sin' | 'cos';
    args: [Expr];
} | {
    op: 'mod';
    args: [Expr, Expr];
};
export type Vec3 = [number, number, number];
export declare const RecipeSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    name: z.ZodString;
    description: z.ZodString;
    classification: z.ZodOptional<z.ZodObject<{
        category: z.ZodString;
        functionTags: z.ZodArray<z.ZodString>;
        tags: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    mounting: z.ZodOptional<z.ZodObject<{
        attachTo: z.ZodEnum<{
            ceiling: "ceiling";
            "wall-side": "wall-side";
        }>;
        reference: z.ZodString;
    }, z.core.$strict>>;
    surfaces: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        part: z.ZodOptional<z.ZodString>;
        position: z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>;
        rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>>;
        size: z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>;
    }, z.core.$strict>>>;
    parameters: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        default: z.ZodNumber;
        min: z.ZodNumber;
        max: z.ZodNumber;
        step: z.ZodNumber;
        unit: z.ZodEnum<{
            count: "count";
            m: "m";
            rad: "rad";
            s: "s";
        }>;
        part: z.ZodOptional<z.ZodString>;
        axis: z.ZodOptional<z.ZodEnum<{
            x: "x";
            y: "y";
            z: "z";
        }>>;
    }, z.core.$strict>>;
    slots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        color: z.ZodString;
        finish: z.ZodOptional<z.ZodEnum<{
            wood: "wood";
            glass: "glass";
            metal: "metal";
        }>>;
    }, z.core.$strict>>;
    parts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        count: z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>;
        motion: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            delay: z.ZodOptional<z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>>;
            duration: z.ZodOptional<z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>>;
            easing: z.ZodOptional<z.ZodEnum<{
                linear: "linear";
                smooth: "smooth";
                soft: "soft";
            }>>;
            kind: z.ZodLiteral<"hinge">;
            pivot: z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>;
            axis: z.ZodEnum<{
                x: "x";
                y: "y";
                z: "z";
            }>;
            angle: z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>;
        }, z.core.$strict>, z.ZodObject<{
            delay: z.ZodOptional<z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>>;
            duration: z.ZodOptional<z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>>;
            easing: z.ZodOptional<z.ZodEnum<{
                linear: "linear";
                smooth: "smooth";
                soft: "soft";
            }>>;
            kind: z.ZodLiteral<"slide">;
            axis: z.ZodEnum<{
                x: "x";
                y: "y";
                z: "z";
            }>;
            distance: z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"spin">;
            pivot: z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>;
            axis: z.ZodEnum<{
                x: "x";
                y: "y";
                z: "z";
            }>;
            radiansPerSecond: z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>;
        }, z.core.$strict>], "kind">>;
        light: z.ZodOptional<z.ZodObject<{
            position: z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>;
            color: z.ZodString;
            intensity: z.ZodOptional<z.ZodNumber>;
            distance: z.ZodOptional<z.ZodNumber>;
            emissiveSlot: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        shapes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            primitive: z.ZodEnum<{
                box: "box";
                roundedBox: "roundedBox";
                cylinder: "cylinder";
                ellipsoid: "ellipsoid";
            }>;
            slot: z.ZodString;
            size: z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>;
            position: z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>;
            rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>, z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>], null>>;
            radius: z.ZodOptional<z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>>;
            topScale: z.ZodOptional<z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>>;
            support: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    constraints: z.ZodArray<z.ZodObject<{
        left: z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>;
        relation: z.ZodEnum<{
            lte: "lte";
            gte: "gte";
        }>;
        right: z.ZodType<Expr, unknown, z.core.$ZodTypeInternals<Expr, unknown>>;
        message: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type EvaluatedShape = {
    id: string;
    partId: string;
    primitive: 'box' | 'roundedBox' | 'cylinder' | 'ellipsoid';
    slot: string;
    size: Vec3;
    position: Vec3;
    rotation: Vec3;
    radius: number;
    topScale: number;
    motionGroup?: string;
};
export type EvaluatedMotion = {
    id: string;
    partId: string;
    kind: 'hinge' | 'slide' | 'spin';
    axis: 'x' | 'y' | 'z';
    pivot: Vec3;
    amount: number;
    delay: number;
    duration: number;
    easing: 'linear' | 'smooth' | 'soft';
};
export type EvaluatedLight = {
    id: string;
    partId: string;
    index: number;
    motionGroup?: string;
    position: Vec3;
    color: string;
    intensity: number;
    distance: number;
    emissiveSlot?: string;
};
export type Surface = {
    id: string;
    label: string;
    position: Vec3;
    rotation: Vec3;
    normal: Vec3;
    size: [number, number];
};
export type Evaluation = {
    shapes: EvaluatedShape[];
    motions: EvaluatedMotion[];
    lights: EvaluatedLight[];
    motionGroupByInstance: Record<string, string>;
    surfaces: Surface[];
    min: Vec3;
    max: Vec3;
    dimensions: Vec3;
    parameters: Record<string, number>;
    triangles: number;
};
export declare const RECIPE_LIMITS: {
    readonly bytes: 131072;
    readonly depth: 24;
    readonly expressions: 50000;
    readonly shapes: 256;
    readonly triangles: 100000;
    readonly dimension: 30;
    readonly motionParts: 8;
    readonly motionGroups: 32;
    readonly lights: 12;
};
export declare function parseRecipe(input: unknown): Recipe;
export declare function evaluateRecipe(recipe: Recipe, values?: Record<string, number>): Evaluation;
export declare const EASINGS: {
    linear: (u: number) => number;
    smooth: (u: number) => number;
    soft: (u: number) => number;
};
export declare function finitePoseFraction(motion: EvaluatedMotion, time: number): number;
export declare function motionTimeline(evaluation: Pick<Evaluation, 'motions'>): {
    T: number;
    perPart: Record<string, {
        A: number;
        B: number;
    }>;
};
export declare function sweepRecipe(recipe: Recipe): ({
    index: number;
    values: Record<string, number>;
    valid: boolean;
    error: null;
} | {
    index: number;
    values: Record<string, number>;
    valid: boolean;
    error: string;
})[];
//# sourceMappingURL=recipe.d.ts.map