import type { CabinetNode } from '@pascal-app/core';
export type CabinetDimensionProfileId = 'metric-base' | 'us-base';
export type CabinetDimensionProfile = {
    id: CabinetDimensionProfileId;
    label: string;
    depth: number;
    carcassHeight: number;
    plinthHeight: number;
    countertopThickness: number;
};
export declare const CABINET_DIMENSION_PROFILES: CabinetDimensionProfile[];
export declare function cabinetDimensionProfileId(node: Pick<CabinetNode, 'depth' | 'carcassHeight' | 'plinthHeight' | 'countertopThickness'>): CabinetDimensionProfileId | 'custom';
export declare function cabinetDimensionProfileById(id: CabinetDimensionProfileId): CabinetDimensionProfile;
//# sourceMappingURL=profiles.d.ts.map