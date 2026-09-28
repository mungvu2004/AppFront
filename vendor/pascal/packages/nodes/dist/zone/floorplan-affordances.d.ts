export declare const zoneMoveVertexAffordance: import("@pascal-app/core").FloorplanAffordance<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    id: `zone_${string}`;
    type: "zone";
    name: string;
    polygon: [number, number][];
    autoFromWalls: boolean;
    boundaryWallIds: `wall_${string}`[];
    spaceRole: "room" | "generic";
    roomNumber: string;
    enclosureStatus: "auto" | "open" | "enclosed";
    floorFinish: string;
    wallFinish: string;
    ceilingFinish: string;
    ceilingHeight: number;
    occupancy: string;
    clearDimensionPolicy: "none" | "inside-faces" | "finish-faces";
    color: string;
    metadata: Record<string, unknown>;
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
}>;
export declare const zoneAddVertexAffordance: import("@pascal-app/core").FloorplanAffordance<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    id: `zone_${string}`;
    type: "zone";
    name: string;
    polygon: [number, number][];
    autoFromWalls: boolean;
    boundaryWallIds: `wall_${string}`[];
    spaceRole: "room" | "generic";
    roomNumber: string;
    enclosureStatus: "auto" | "open" | "enclosed";
    floorFinish: string;
    wallFinish: string;
    ceilingFinish: string;
    ceilingHeight: number;
    occupancy: string;
    clearDimensionPolicy: "none" | "inside-faces" | "finish-faces";
    color: string;
    metadata: Record<string, unknown>;
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
}>;
export declare const zoneMoveEdgeAffordance: import("@pascal-app/core").FloorplanAffordance<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    id: `zone_${string}`;
    type: "zone";
    name: string;
    polygon: [number, number][];
    autoFromWalls: boolean;
    boundaryWallIds: `wall_${string}`[];
    spaceRole: "room" | "generic";
    roomNumber: string;
    enclosureStatus: "auto" | "open" | "enclosed";
    floorFinish: string;
    wallFinish: string;
    ceilingFinish: string;
    ceilingHeight: number;
    occupancy: string;
    clearDimensionPolicy: "none" | "inside-faces" | "finish-faces";
    color: string;
    metadata: Record<string, unknown>;
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
}>;
export declare const zoneDeleteVertexAffordance: import("@pascal-app/core").FloorplanAffordance<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    id: `zone_${string}`;
    type: "zone";
    name: string;
    polygon: [number, number][];
    autoFromWalls: boolean;
    boundaryWallIds: `wall_${string}`[];
    spaceRole: "room" | "generic";
    roomNumber: string;
    enclosureStatus: "auto" | "open" | "enclosed";
    floorFinish: string;
    wallFinish: string;
    ceilingFinish: string;
    ceilingHeight: number;
    occupancy: string;
    clearDimensionPolicy: "none" | "inside-faces" | "finish-faces";
    color: string;
    metadata: Record<string, unknown>;
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
}>;
//# sourceMappingURL=floorplan-affordances.d.ts.map