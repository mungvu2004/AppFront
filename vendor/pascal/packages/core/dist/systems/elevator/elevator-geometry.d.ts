import type { ElevatorDoorPanelStyle, ElevatorDoorStyle, ElevatorNode, ElevatorShaftStyle } from '../../schema/index.js';
export type ElevatorDoorSide = 'left' | 'right';
export declare function getResolvedElevatorDoorStyle(doorStyle: ElevatorNode['doorStyle'] | undefined): ElevatorDoorStyle;
export declare function getResolvedElevatorDoorPanelStyle(doorPanelStyle: ElevatorNode['doorPanelStyle'] | undefined): ElevatorDoorPanelStyle;
export declare function getResolvedElevatorShaftStyle(shaftStyle: ElevatorNode['shaftStyle'] | undefined): ElevatorShaftStyle;
export declare function getElevatorDoorLeafSides(doorStyle: ElevatorNode['doorStyle'] | undefined): ElevatorDoorSide[];
export declare function getElevatorDoorLeafX(side: ElevatorDoorSide, openingWidth: number, doorOpen: number, doorStyle: ElevatorNode['doorStyle'] | undefined): number;
export declare function getElevatorDoorLeafWidth(openingWidth: number, doorStyle: ElevatorNode['doorStyle'] | undefined): number;
export declare function getElevatorCabWidth(node: ElevatorNode): number;
export declare function getElevatorCabDepth(node: ElevatorNode): number;
export declare function getElevatorShaftWallThickness(node: ElevatorNode): number;
export declare function getElevatorShaftWidth(node: ElevatorNode, cabWidth?: number): number;
export declare function getElevatorShaftDepth(node: ElevatorNode, cabDepth?: number): number;
export declare function getElevatorCabCenterZ(node: ElevatorNode): number;
//# sourceMappingURL=elevator-geometry.d.ts.map