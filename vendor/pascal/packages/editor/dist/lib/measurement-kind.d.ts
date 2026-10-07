export declare const CREATABLE_MEASUREMENT_KINDS: readonly ["distance", "angle", "area", "perimeter", "volume"];
export type CreatableMeasurementKind = (typeof CREATABLE_MEASUREMENT_KINDS)[number];
export declare const DEFAULT_CREATABLE_MEASUREMENT_KIND: CreatableMeasurementKind;
export declare function isCreatableMeasurementKind(value: unknown): value is CreatableMeasurementKind;
export declare function normalizeCreatableMeasurementKind(value: unknown): CreatableMeasurementKind;
//# sourceMappingURL=measurement-kind.d.ts.map