import { type AnyNodeId, type WallConstructionOptions, type WallNode, type WallPlanPoint } from '@pascal-app/core';
export declare function createWallRectangle(levelId: AnyNodeId, start: WallPlanPoint, end: WallPlanPoint, defaults?: Partial<WallNode>, options?: WallConstructionOptions): {
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `wall_${string}`;
    type: "wall";
    children: (`item_${string}` | `procedural-item_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}`)[];
    start: [number, number];
    end: [number, number];
    frontSide: "unknown" | "exterior" | "interior";
    backSide: "unknown" | "exterior" | "interior";
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
    wallType?: "standard" | "curtain" | undefined;
    curtainWall?: {
        construction: "stick" | "unitized";
        framing: "capped" | "vertical-caps" | "horizontal-caps" | "structural-glazing";
        columns: {
            layout: "count" | "maximum-spacing" | "fixed-spacing";
            count: number;
            spacing: number;
            alignment: "center" | "start" | "end";
        };
        rows: {
            layout: "count" | "maximum-spacing" | "fixed-spacing";
            count: number;
            spacing: number;
            alignment: "center" | "start" | "end";
        };
        mullionWidth: number;
        transomWidth: number;
        perimeterWidth: number;
        jointWidth: number;
        glassThickness: number;
        panelType: "glass" | "solid" | "empty";
        spandrel: "bottom" | "top" | "none";
        frameColor: string;
        glassColor: string;
        solidColor: string;
        glassOpacity: number;
        glassRoughness: number;
        panels: {
            column: number;
            row: number;
            type: "glass" | "solid" | "empty";
        }[];
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
    interiorMaterial?: {
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
    interiorMaterialPreset?: string | undefined;
    exteriorMaterial?: {
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
    exteriorMaterialPreset?: string | undefined;
    slots?: Record<string, string> | undefined;
    thickness?: number | undefined;
    assembly?: {
        framing: {
            kind: "wood" | "lgs" | "cmu" | "icf";
            depth: number;
        };
        preset?: string | undefined;
        exterior?: {
            finish: "brick" | "none" | "siding" | "stucco" | "stone" | "fiber-cement";
            thickness: number;
        } | undefined;
        sheathing?: {
            material: "none" | "osb" | "plywood" | "gypsum";
            thickness: number;
        } | undefined;
        interior?: {
            finish: "plaster" | "none" | "drywall";
            thickness: number;
        } | undefined;
        cavityInsulation?: string | undefined;
    } | undefined;
    height?: number | undefined;
    curveOffset?: number | undefined;
    supportSlabId?: string | undefined;
    supportOffset?: number | undefined;
    fillToTerrain?: boolean | undefined;
    underpinning?: {
        rim: number;
        stem: number;
        openings?: {
            u: number;
            width: number;
            top: number;
            bottom: number;
        }[] | undefined;
    } | undefined;
    faceBands?: {
        enabled: boolean;
        count: number;
        lowerHeight: number;
        middleHeight: number;
        upperHeight: number;
    } | undefined;
    skirting?: {
        enabled: boolean;
        sides: "exterior" | "interior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    } | undefined;
    crown?: {
        enabled: boolean;
        sides: "exterior" | "interior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    } | undefined;
    chairRail?: {
        enabled: boolean;
        sides: "exterior" | "interior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    } | undefined;
}[];
//# sourceMappingURL=rectangle-command.d.ts.map