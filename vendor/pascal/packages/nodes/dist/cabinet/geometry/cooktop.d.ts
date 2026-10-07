import { Group } from 'three';
import { type CabinetCompartment, type CabinetCooktopCompartmentType, type CooktopLayout } from '../stack';
import { type CabinetGeometryNode } from './shared';
export declare const GAS_HOB_BURNER_RADIUS = 0.052;
export type CooktopBurnerSpec = {
    x: number;
    z: number;
    size: number;
};
export type InductionZoneSpec = {
    x: number;
    z: number;
    radius: number;
    w?: number;
    d?: number;
};
export declare function gasHobBurners(layout: CooktopLayout): CooktopBurnerSpec[];
export declare function inductionZones(layout: CooktopLayout): InductionZoneSpec[];
export declare function addCooktopCompartment(group: Group, node: CabinetGeometryNode, compartment: CabinetCompartment, type: CabinetCooktopCompartmentType, topY: number, index: number): void;
//# sourceMappingURL=cooktop.d.ts.map