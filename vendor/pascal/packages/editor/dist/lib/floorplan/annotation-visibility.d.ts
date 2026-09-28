import type { FloorplanGeometry } from '@pascal-app/core';
import { type FloorplanAnnotationRole } from './floorplan-extension';
export type FloorplanAnnotationCategory = 'automaticDimensions' | 'contextualDimensions' | 'manualDimensions' | 'measurements' | 'openingMarks' | 'structuralGrids' | 'roomLabels' | 'roomDetails' | 'roofPlan' | 'stairAnnotations';
export type FloorplanAnnotationVisibility = Record<FloorplanAnnotationCategory, boolean>;
export declare const DEFAULT_FLOORPLAN_ANNOTATION_VISIBILITY: FloorplanAnnotationVisibility;
export declare function revealFloorplanAnnotationRole(visibility: FloorplanAnnotationVisibility, role: FloorplanAnnotationRole): FloorplanAnnotationVisibility;
export declare function normalizeFloorplanAnnotationVisibility(value: unknown): FloorplanAnnotationVisibility;
export declare function filterFloorplanAnnotationGeometry(geometry: FloorplanGeometry, visibility: FloorplanAnnotationVisibility, inheritedRole?: FloorplanAnnotationRole): FloorplanGeometry | null;
//# sourceMappingURL=annotation-visibility.d.ts.map