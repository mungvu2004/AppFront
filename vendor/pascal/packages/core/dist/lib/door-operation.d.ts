import type { DoorNode, DoorType } from '../schema/nodes/door.js';
export declare const SECTIONAL_GARAGE_RENDER_OPEN_SCALE = 0.88;
export declare function clampDoorOperationState(value: number | undefined): number;
export declare function isOperationDoorType(doorType: DoorType | DoorNode['doorType'] | string | undefined): doorType is "folding" | "pocket" | "barn" | "sliding" | "garage-sectional" | "garage-rollup" | "garage-tiltup";
export declare function getDoorRenderOpenAmount(doorType: DoorType | DoorNode['doorType'], operationState: number | undefined): number;
export declare function getGarageVisibleOpeningRatio(doorType: DoorType | DoorNode['doorType'], operationState: number | undefined): number;
//# sourceMappingURL=door-operation.d.ts.map