import { type Expr } from './recipe.js';
export declare const shelfRecipe: {
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
        count: Expr;
        shapes: {
            id: string;
            primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
            slot: string;
            size: [Expr, Expr, Expr];
            position: [Expr, Expr, Expr];
            rotation?: [Expr, Expr, Expr] | undefined;
            radius?: Expr | undefined;
            topScale?: Expr | undefined;
            support?: boolean | undefined;
        }[];
        motion?: {
            kind: "hinge";
            pivot: [Expr, Expr, Expr];
            axis: "x" | "y" | "z";
            angle: Expr;
            delay?: Expr | undefined;
            duration?: Expr | undefined;
            easing?: "linear" | "smooth" | "soft" | undefined;
        } | {
            kind: "slide";
            axis: "x" | "y" | "z";
            distance: Expr;
            delay?: Expr | undefined;
            duration?: Expr | undefined;
            easing?: "linear" | "smooth" | "soft" | undefined;
        } | {
            kind: "spin";
            pivot: [Expr, Expr, Expr];
            axis: "x" | "y" | "z";
            radiansPerSecond: Expr;
        } | undefined;
        light?: {
            position: [Expr, Expr, Expr];
            color: string;
            intensity?: number | undefined;
            distance?: number | undefined;
            emissiveSlot?: string | undefined;
        } | undefined;
    }[];
    constraints: {
        left: Expr;
        relation: "lte" | "gte";
        right: Expr;
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
        position: [Expr, Expr, Expr];
        size: [Expr, Expr];
        part?: string | undefined;
        rotation?: [Expr, Expr, Expr] | undefined;
    }[] | undefined;
};
export declare const bedRecipe: {
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
        count: Expr;
        shapes: {
            id: string;
            primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
            slot: string;
            size: [Expr, Expr, Expr];
            position: [Expr, Expr, Expr];
            rotation?: [Expr, Expr, Expr] | undefined;
            radius?: Expr | undefined;
            topScale?: Expr | undefined;
            support?: boolean | undefined;
        }[];
        motion?: {
            kind: "hinge";
            pivot: [Expr, Expr, Expr];
            axis: "x" | "y" | "z";
            angle: Expr;
            delay?: Expr | undefined;
            duration?: Expr | undefined;
            easing?: "linear" | "smooth" | "soft" | undefined;
        } | {
            kind: "slide";
            axis: "x" | "y" | "z";
            distance: Expr;
            delay?: Expr | undefined;
            duration?: Expr | undefined;
            easing?: "linear" | "smooth" | "soft" | undefined;
        } | {
            kind: "spin";
            pivot: [Expr, Expr, Expr];
            axis: "x" | "y" | "z";
            radiansPerSecond: Expr;
        } | undefined;
        light?: {
            position: [Expr, Expr, Expr];
            color: string;
            intensity?: number | undefined;
            distance?: number | undefined;
            emissiveSlot?: string | undefined;
        } | undefined;
    }[];
    constraints: {
        left: Expr;
        relation: "lte" | "gte";
        right: Expr;
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
        position: [Expr, Expr, Expr];
        size: [Expr, Expr];
        part?: string | undefined;
        rotation?: [Expr, Expr, Expr] | undefined;
    }[] | undefined;
};
export declare const radiatorRecipe: {
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
        count: Expr;
        shapes: {
            id: string;
            primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
            slot: string;
            size: [Expr, Expr, Expr];
            position: [Expr, Expr, Expr];
            rotation?: [Expr, Expr, Expr] | undefined;
            radius?: Expr | undefined;
            topScale?: Expr | undefined;
            support?: boolean | undefined;
        }[];
        motion?: {
            kind: "hinge";
            pivot: [Expr, Expr, Expr];
            axis: "x" | "y" | "z";
            angle: Expr;
            delay?: Expr | undefined;
            duration?: Expr | undefined;
            easing?: "linear" | "smooth" | "soft" | undefined;
        } | {
            kind: "slide";
            axis: "x" | "y" | "z";
            distance: Expr;
            delay?: Expr | undefined;
            duration?: Expr | undefined;
            easing?: "linear" | "smooth" | "soft" | undefined;
        } | {
            kind: "spin";
            pivot: [Expr, Expr, Expr];
            axis: "x" | "y" | "z";
            radiansPerSecond: Expr;
        } | undefined;
        light?: {
            position: [Expr, Expr, Expr];
            color: string;
            intensity?: number | undefined;
            distance?: number | undefined;
            emissiveSlot?: string | undefined;
        } | undefined;
    }[];
    constraints: {
        left: Expr;
        relation: "lte" | "gte";
        right: Expr;
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
        position: [Expr, Expr, Expr];
        size: [Expr, Expr];
        part?: string | undefined;
        rotation?: [Expr, Expr, Expr] | undefined;
    }[] | undefined;
};
export declare const counterRecipe: {
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
        count: Expr;
        shapes: {
            id: string;
            primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
            slot: string;
            size: [Expr, Expr, Expr];
            position: [Expr, Expr, Expr];
            rotation?: [Expr, Expr, Expr] | undefined;
            radius?: Expr | undefined;
            topScale?: Expr | undefined;
            support?: boolean | undefined;
        }[];
        motion?: {
            kind: "hinge";
            pivot: [Expr, Expr, Expr];
            axis: "x" | "y" | "z";
            angle: Expr;
            delay?: Expr | undefined;
            duration?: Expr | undefined;
            easing?: "linear" | "smooth" | "soft" | undefined;
        } | {
            kind: "slide";
            axis: "x" | "y" | "z";
            distance: Expr;
            delay?: Expr | undefined;
            duration?: Expr | undefined;
            easing?: "linear" | "smooth" | "soft" | undefined;
        } | {
            kind: "spin";
            pivot: [Expr, Expr, Expr];
            axis: "x" | "y" | "z";
            radiansPerSecond: Expr;
        } | undefined;
        light?: {
            position: [Expr, Expr, Expr];
            color: string;
            intensity?: number | undefined;
            distance?: number | undefined;
            emissiveSlot?: string | undefined;
        } | undefined;
    }[];
    constraints: {
        left: Expr;
        relation: "lte" | "gte";
        right: Expr;
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
        position: [Expr, Expr, Expr];
        size: [Expr, Expr];
        part?: string | undefined;
        rotation?: [Expr, Expr, Expr] | undefined;
    }[] | undefined;
};
export declare const experimentBriefs: readonly [{
    readonly id: "shelf_open";
    readonly prompt: "Create a freestanding open oak bookcase, 1.2 m wide and 1.8 m tall, with adjustable width, height, depth and shelf count. Expose frame and shelf material slots and shelf support surfaces.";
}, {
    readonly id: "shelf_asymmetric";
    readonly prompt: "Create an asymmetric low bookcase with a wide open compartment on the left and a narrow stack of shelves on the right. Expose overall width, height, depth and right shelf count. Use contrasting frame and back colors.";
}, {
    readonly id: "bed_timber";
    readonly prompt: "Create a timber platform bed with a mattress, a headboard and two pillows. Expose bed width, length, headboard height, pillow count and pillow size. Pillows must remain above the mattress when resized. Separate frame, bedding and pillow material slots.";
}, {
    readonly id: "bed_upholstered";
    readonly prompt: "Create an upholstered bed with a tall rounded headboard, a low base, mattress and three pillows. Expose bed width, length, headboard height and pillow count. Include independently adjustable pillow depth and separate material slots.";
}, {
    readonly id: "bench";
    readonly prompt: "Create a park bench with a slatted timber seat, backrest and two metal supports. Expose width, seat height, depth and slat count. Changing width must preserve support thickness. Separate timber and metal slots.";
}, {
    readonly id: "divider";
    readonly prompt: "Create a freestanding room divider with repeated vertical timber slats on a base. Expose width, height, depth and slat count. Keep every slat above the ground and evenly distributed when resized. Separate slat and base slots.";
}];
//# sourceMappingURL=fixtures.d.ts.map