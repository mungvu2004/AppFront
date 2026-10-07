import type { CabinetNode, GeometryContext } from '@pascal-app/core';
import { type SinkBowlSpec } from './appliance-layout';
export type CabinetSlab = {
    size: [number, number, number];
    position: [number, number, number];
};
export type RunSinkCut = {
    bowls: SinkBowlSpec[];
    x: number;
    z: number;
};
export declare function getCabinetCountertopLayout(node: CabinetNode, ctx?: GeometryContext): {
    span: import("./run-layout").RunSpan;
    modules: {
        object: "node";
        parentId: string | null;
        visible: boolean;
        metadata: Record<string, unknown>;
        position: [number, number, number];
        rotation: number;
        width: number;
        depth: number;
        carcassHeight: number;
        operationState: number;
        plinthHeight: number;
        toeKickDepth: number;
        boardThickness: number;
        countertopThickness: number;
        countertopOverhang: number;
        countertopBackOverhang: number;
        withFinishedBack: boolean;
        frontThickness: number;
        frontGap: number;
        frontStyle: "slab" | "shaker" | "raised-arch";
        panelReady: boolean;
        handleStyle: "none" | "bar" | "cutout" | "hole" | "knob";
        handlePosition: "center" | "top" | "auto";
        frontOverlay: "inset" | "full";
        withBottomPanel: boolean;
        showPlinth: boolean;
        withCountertop: boolean;
        id: `cabinet-module_${string}`;
        type: "cabinet-module";
        children: string[];
        cabinetType: "base" | "tall";
        moduleKind: "standard" | "corner-filler";
        topFinish: "trim" | "none" | "top-cabinet";
        topFinishHeight: number;
        topFinishDepth: number;
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
        supportSlabId?: string | undefined;
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
        stack?: ({
            type: "shelf";
            id: string;
            shelfCount?: number | undefined;
            height?: number | undefined;
        } | {
            type: "drawer";
            id: string;
            drawerCount?: number | undefined;
            height?: number | undefined;
        } | {
            type: "door";
            id: string;
            doorType?: "glass" | "double" | "single-left" | "single-right" | undefined;
            shelfCount?: number | undefined;
            height?: number | undefined;
        } | {
            type: "sink";
            id: string;
            sinkLayout?: "single" | "double" | "double-offset" | undefined;
            height?: number | undefined;
        } | {
            type: "oven";
            id: string;
            height?: number | undefined;
        } | {
            type: "microwave";
            id: string;
            height?: number | undefined;
        } | {
            type: "dishwasher";
            id: string;
            height?: number | undefined;
        } | {
            type: "cooktop-gas";
            id: string;
            cooktopLayout?: "gas-2burner" | "gas-4burner" | "gas-5burner-wok" | "gas-6burner" | undefined;
            cooktopBurnersOn?: boolean | undefined;
            cooktopActiveBurners?: number[] | undefined;
            cooktopKnobProgress?: number[] | undefined;
            cooktopShowGrate?: boolean | undefined;
            height?: number | undefined;
        } | {
            type: "cooktop-induction";
            id: string;
            cooktopLayout?: "induction-2zone" | "induction-4zone" | undefined;
            cooktopBurnersOn?: boolean | undefined;
            cooktopActiveBurners?: number[] | undefined;
            cooktopKnobProgress?: number[] | undefined;
            cooktopShowGrate?: boolean | undefined;
            height?: number | undefined;
        } | {
            type: "pull-out-pantry";
            id: string;
            shelfCount?: number | undefined;
            pantryRackStyle?: "glass" | "wire" | "tray" | undefined;
            height?: number | undefined;
        } | {
            type: "fridge-single";
            id: string;
            height?: number | undefined;
        } | {
            type: "fridge-double";
            id: string;
            height?: number | undefined;
        } | {
            type: "fridge-top-freezer";
            id: string;
            height?: number | undefined;
        } | {
            type: "fridge-bottom-freezer";
            id: string;
            height?: number | undefined;
        } | {
            type: "hood-pyramid";
            id: string;
            height?: number | undefined;
        } | {
            type: "hood-curved-glass";
            id: string;
            height?: number | undefined;
        })[] | undefined;
        openSide?: "left" | "right" | undefined;
        cornerShelf?: boolean | undefined;
    }[];
    ends: import("./run-layout").RunSpanEnds;
    backOverhang: number;
    countertop: CabinetSlab | null;
    bar: {
        slab: CabinetSlab;
        support: CabinetSlab;
        edge: NonNullable<CabinetNode["barLedge"]>["edge"];
    } | null;
    sinkCuts: RunSinkCut[];
}[];
//# sourceMappingURL=countertop-layout.d.ts.map