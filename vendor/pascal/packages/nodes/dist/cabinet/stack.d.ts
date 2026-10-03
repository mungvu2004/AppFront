import { type CabinetModuleNode, type CabinetNode } from '@pascal-app/core';
type CabinetStackOwner = CabinetNode | CabinetModuleNode;
export declare const CABINET_COMPARTMENT_TYPES: readonly ["shelf", "drawer", "door", "oven", "microwave", "dishwasher", "sink", "cooktop-gas", "cooktop-induction", "pull-out-pantry", "fridge-single", "fridge-double", "fridge-top-freezer", "fridge-bottom-freezer", "hood-pyramid", "hood-curved-glass"];
export type CabinetCompartmentType = (typeof CABINET_COMPARTMENT_TYPES)[number];
export type CabinetFridgeCompartmentType = Extract<CabinetCompartmentType, 'fridge-single' | 'fridge-double' | 'fridge-top-freezer' | 'fridge-bottom-freezer'>;
export type CabinetHoodCompartmentType = Extract<CabinetCompartmentType, 'hood-pyramid' | 'hood-curved-glass'>;
export type CabinetCooktopCompartmentType = Extract<CabinetCompartmentType, 'cooktop-gas' | 'cooktop-induction'>;
export declare const SINK_LAYOUTS: readonly ["single", "double", "double-offset"];
export type SinkLayout = (typeof SINK_LAYOUTS)[number];
export declare const COOKTOP_LAYOUTS: readonly ["gas-2burner", "gas-4burner", "gas-5burner-wok", "gas-6burner", "induction-2zone", "induction-4zone"];
export type CooktopLayout = (typeof COOKTOP_LAYOUTS)[number];
export declare const PULL_OUT_PANTRY_RACK_STYLES: readonly ["wire", "tray", "glass"];
export type PullOutPantryRackStyle = (typeof PULL_OUT_PANTRY_RACK_STYLES)[number];
export declare const CABINET_DOOR_TYPES: readonly ["single-left", "single-right", "double", "glass"];
export type CabinetDoorType = (typeof CABINET_DOOR_TYPES)[number];
export type CabinetCompartment = NonNullable<CabinetStackOwner['stack']>[number];
export declare const OVEN_STANDARD_WIDTH = 0.6;
export declare const OVEN_DEFAULT_HEIGHT = 0.595;
export declare const MICROWAVE_STANDARD_WIDTH = 0.61;
export declare const MICROWAVE_STANDARD_HEIGHT = 0.39;
export declare const MICROWAVE_DEFAULT_HEIGHT = 0.39;
export declare const DISHWASHER_STANDARD_WIDTH = 0.6;
export declare const DISHWASHER_STANDARD_HEIGHT = 0.72;
export declare const COOKTOP_STANDARD_WIDTH = 0.75;
export declare const SINK_STANDARD_WIDTH = 0.8;
export declare const SINK_DEFAULT_LAYOUT: SinkLayout;
export declare const COOKTOP_DEFAULT_HEIGHT = 0.08;
export declare const COOKTOP_DEFAULT_GAS_LAYOUT: CooktopLayout;
export declare const COOKTOP_DEFAULT_INDUCTION_LAYOUT: CooktopLayout;
export declare const PULL_OUT_PANTRY_STANDARD_WIDTH = 0.3;
export declare const PULL_OUT_PANTRY_DEFAULT_SHELF_COUNT = 5;
export declare const PULL_OUT_PANTRY_DEFAULT_RACK_STYLE: PullOutPantryRackStyle;
export declare const FRIDGE_COLUMN_WIDTH = 0.76;
export declare const FRIDGE_WIDE_WIDTH = 0.91;
export declare const FRIDGE_STANDARD_DEPTH = 0.76;
export declare const FRIDGE_COLUMN_HEIGHT = 1.78;
export declare const TALL_CABINET_CARCASS_HEIGHT = 2.07;
export declare const HOOD_CANOPY_DEPTH = 0.5;
export declare const HOOD_PYRAMID_CANOPY_HEIGHT = 0.38;
export declare const HOOD_CURVED_BODY_HEIGHT = 0.16;
export declare const HOOD_CURVED_TOTAL_HEIGHT = 0.44;
export declare const HOOD_DUCT_SIZE = 0.28;
export declare const DEFAULT_CEILING_HEIGHT = 2.5;
export declare function hoodCompartmentHeight(type: CabinetHoodCompartmentType): number;
export declare function isFridgeCompartmentType(type: CabinetCompartmentType): type is CabinetFridgeCompartmentType;
export declare function isHoodCompartmentType(type: CabinetCompartmentType): type is CabinetHoodCompartmentType;
export declare function isCooktopCompartmentType(type: CabinetCompartmentType): type is CabinetCooktopCompartmentType;
export declare function defaultDoorType(width: number): CabinetDoorType;
export declare function newCabinetCompartment<T extends CabinetCompartmentType>(type: T): Extract<CabinetCompartment, {
    type: T;
}>;
export declare function fridgeCabinetStack(type: CabinetFridgeCompartmentType): CabinetCompartment[];
export declare function cooktopCabinetStack(type: CabinetCooktopCompartmentType): CabinetCompartment[];
export declare function sinkCabinetStack(): CabinetCompartment[];
/** Union of every field any compartment variant can carry. */
type AnyCompartmentFields = Partial<{
    type: CabinetCompartmentType;
    height: number;
    doorType: CabinetDoorType;
    drawerCount: number;
    shelfCount: number;
    pantryRackStyle: PullOutPantryRackStyle;
    cooktopLayout: CooktopLayout;
    sinkLayout: SinkLayout;
    cooktopBurnersOn: boolean;
    cooktopShowGrate: boolean;
    cooktopActiveBurners: number[];
    cooktopKnobProgress: number[];
}>;
/**
 * Spread-with-override for the compartment union. Callers patch fields that
 * are valid for the compartment's actual variant (the UI only offers
 * variant-appropriate controls); the cast is contained here so every call
 * site stays clean under the discriminated union.
 */
export declare function patchCompartment(compartment: CabinetCompartment, patch: AnyCompartmentFields): CabinetCompartment;
export declare function defaultCabinetStack(node: Pick<CabinetStackOwner, 'width'>): CabinetCompartment[];
export declare function stackForCabinet(node: Pick<CabinetStackOwner, 'width' | 'stack'>): CabinetCompartment[];
export declare function compartmentDrawerCount(compartment: CabinetCompartment): number;
export declare function compartmentShelfCount(compartment: CabinetCompartment): number;
export declare function compartmentPullOutPantryRackStyle(compartment: CabinetCompartment): PullOutPantryRackStyle;
export declare function compartmentCooktopLayout(compartment: CabinetCompartment, type: CabinetCooktopCompartmentType): CooktopLayout;
export declare function cooktopLayoutElementCount(layout: CooktopLayout): number;
export declare function compartmentCooktopElementCount(compartment: CabinetCompartment, type: CabinetCooktopCompartmentType): number;
export declare function compartmentCooktopBurnersOn(compartment: CabinetCompartment): boolean;
export declare function compartmentCooktopActiveBurners(compartment: CabinetCompartment, type: CabinetCooktopCompartmentType): number[];
export declare function compartmentCooktopKnobProgress(compartment: CabinetCompartment, type: CabinetCooktopCompartmentType): number[];
export declare function compartmentCooktopShowGrate(compartment: CabinetCompartment): boolean;
export declare function compartmentSinkLayout(compartment: CabinetCompartment): SinkLayout;
export declare function compartmentDoorType(compartment: CabinetCompartment, width: number): CabinetDoorType;
export declare function minCabinetCarcassHeightForStack(node: Pick<CabinetStackOwner, 'stack' | 'width'>, minHeight?: number): number;
export declare function clampCabinetCarcassHeightForStack(node: Pick<CabinetStackOwner, 'stack' | 'width'>, carcassHeight: number, stack?: ({
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
} | {
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
})[]): number;
export declare function removeCabinetCompartmentStack(node: Pick<CabinetStackOwner, 'carcassHeight' | 'stack' | 'width'>, index: number): {
    stack: CabinetCompartment[];
    carcassHeight?: number;
};
export declare function replaceCabinetCompartmentStack(node: Pick<CabinetStackOwner, 'carcassHeight' | 'stack' | 'width'>, index: number, next: CabinetCompartment, fillerType?: Extract<CabinetCompartmentType, 'drawer' | 'door' | 'shelf'>, minHeight?: number): CabinetCompartment[];
export declare function normalizeCabinetStack(node: Pick<CabinetStackOwner, 'carcassHeight' | 'stack' | 'width'>): Array<{
    compartment: CabinetCompartment;
    index: number;
    height: number;
    y0: number;
    y1: number;
}>;
export declare function resizeCabinetCompartmentStack(node: Pick<CabinetStackOwner, 'carcassHeight' | 'stack' | 'width'>, index: number, targetHeight: number, minHeight?: number): CabinetCompartment[];
export { reflowRunModules as reflowCabinetRunModules } from './run-layout';
export declare function backAnchoredModuleZ(currentZ: number, currentDepth: number, nextDepth: number): number;
//# sourceMappingURL=stack.d.ts.map