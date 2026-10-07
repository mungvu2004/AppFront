import { type FloorplanAnnotationVisibility } from './annotation-visibility';
import type { FloorplanAnnotationRole, FloorplanToolMode, FloorplanWallDimensionReference } from './floorplan-extension';
export declare const FLOORPLAN_MODES: readonly ["default", "expert"];
export type FloorplanMode = (typeof FLOORPLAN_MODES)[number];
export declare const DEFAULT_FLOORPLAN_MODE: FloorplanMode;
export type FloorplanPresentationContext = {
    referencedAnnotationRole?: FloorplanAnnotationRole;
    selected?: boolean;
    target: 'editor' | 'export';
};
export declare function normalizeFloorplanMode(value: unknown): FloorplanMode;
export declare function normalizeFloorplanModesByProject(value: unknown): Record<string, FloorplanMode>;
export declare function isFloorplanToolAvailableInMode(availableModes: readonly FloorplanToolMode[] | undefined, mode: FloorplanMode): boolean;
export declare function resolveFloorplanAnnotationVisibility(mode: FloorplanMode, expertVisibility: FloorplanAnnotationVisibility, context: FloorplanPresentationContext): FloorplanAnnotationVisibility;
export declare function resolveFloorplanWallDimensionReference(mode: FloorplanMode, expertReference: FloorplanWallDimensionReference): FloorplanWallDimensionReference;
//# sourceMappingURL=floorplan-mode.d.ts.map