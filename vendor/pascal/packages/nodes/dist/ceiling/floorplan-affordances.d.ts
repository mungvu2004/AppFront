export declare const ceilingMoveVertexAffordance: import("@pascal-app/core").FloorplanAffordance<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `ceiling_${string}`;
    type: "ceiling";
    children: (`item_${string}` | `procedural-item_${string}`)[];
    polygon: [number, number][];
    holes: [number, number][][];
    holeMetadata: {
        source: "stair" | "elevator" | "manual";
        stairId?: string | undefined;
        elevatorId?: string | undefined;
    }[];
    autoFromWalls: boolean;
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
    material?: {
        id?: string | undefined;
        preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
        properties?: {
            color: string;
            roughness: number;
            metalness: number;
            opacity: number;
            transparent: boolean;
            side: "front" | "back" | "double";
        } | undefined;
        texture?: {
            url: string;
            repeat?: [number, number] | undefined;
            scale?: number | undefined;
        } | undefined;
    } | undefined;
    materialPreset?: string | undefined;
    slots?: Record<string, string> | undefined;
    height?: number | undefined;
}>;
export declare const ceilingAddVertexAffordance: import("@pascal-app/core").FloorplanAffordance<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `ceiling_${string}`;
    type: "ceiling";
    children: (`item_${string}` | `procedural-item_${string}`)[];
    polygon: [number, number][];
    holes: [number, number][][];
    holeMetadata: {
        source: "stair" | "elevator" | "manual";
        stairId?: string | undefined;
        elevatorId?: string | undefined;
    }[];
    autoFromWalls: boolean;
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
    material?: {
        id?: string | undefined;
        preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
        properties?: {
            color: string;
            roughness: number;
            metalness: number;
            opacity: number;
            transparent: boolean;
            side: "front" | "back" | "double";
        } | undefined;
        texture?: {
            url: string;
            repeat?: [number, number] | undefined;
            scale?: number | undefined;
        } | undefined;
    } | undefined;
    materialPreset?: string | undefined;
    slots?: Record<string, string> | undefined;
    height?: number | undefined;
}>;
export declare const ceilingMoveEdgeAffordance: import("@pascal-app/core").FloorplanAffordance<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `ceiling_${string}`;
    type: "ceiling";
    children: (`item_${string}` | `procedural-item_${string}`)[];
    polygon: [number, number][];
    holes: [number, number][][];
    holeMetadata: {
        source: "stair" | "elevator" | "manual";
        stairId?: string | undefined;
        elevatorId?: string | undefined;
    }[];
    autoFromWalls: boolean;
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
    material?: {
        id?: string | undefined;
        preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
        properties?: {
            color: string;
            roughness: number;
            metalness: number;
            opacity: number;
            transparent: boolean;
            side: "front" | "back" | "double";
        } | undefined;
        texture?: {
            url: string;
            repeat?: [number, number] | undefined;
            scale?: number | undefined;
        } | undefined;
    } | undefined;
    materialPreset?: string | undefined;
    slots?: Record<string, string> | undefined;
    height?: number | undefined;
}>;
export declare const ceilingDeleteVertexAffordance: import("@pascal-app/core").FloorplanAffordance<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `ceiling_${string}`;
    type: "ceiling";
    children: (`item_${string}` | `procedural-item_${string}`)[];
    polygon: [number, number][];
    holes: [number, number][][];
    holeMetadata: {
        source: "stair" | "elevator" | "manual";
        stairId?: string | undefined;
        elevatorId?: string | undefined;
    }[];
    autoFromWalls: boolean;
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
    material?: {
        id?: string | undefined;
        preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
        properties?: {
            color: string;
            roughness: number;
            metalness: number;
            opacity: number;
            transparent: boolean;
            side: "front" | "back" | "double";
        } | undefined;
        texture?: {
            url: string;
            repeat?: [number, number] | undefined;
            scale?: number | undefined;
        } | undefined;
    } | undefined;
    materialPreset?: string | undefined;
    slots?: Record<string, string> | undefined;
    height?: number | undefined;
}>;
//# sourceMappingURL=floorplan-affordances.d.ts.map