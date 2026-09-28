export type CabinetStandardWidthId = '300' | '400' | '600' | '800';
export type CabinetStandardWidth = {
    id: CabinetStandardWidthId;
    label: string;
    value: number;
};
export declare const CABINET_STANDARD_WIDTHS: CabinetStandardWidth[];
export declare function cabinetStandardWidthId(width: number): CabinetStandardWidthId | 'custom';
export declare function cabinetStandardWidthById(id: CabinetStandardWidthId): CabinetStandardWidth;
//# sourceMappingURL=widths.d.ts.map