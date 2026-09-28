import type { GridEvent } from '@pascal-app/core';
export type GridEventScreenProjection = {
    pointer: [number, number];
    localToScreen: [number, number, number, number, number, number];
};
export type EditorGridEvent = GridEvent & {
    screenProjection?: GridEventScreenProjection;
};
export declare function getGridEventScreenProjection(event: GridEvent): GridEventScreenProjection | undefined;
//# sourceMappingURL=grid-event-presentation.d.ts.map