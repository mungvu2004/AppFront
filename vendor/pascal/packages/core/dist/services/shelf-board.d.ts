import type { ShelfNode } from '../schema/nodes/shelf.js';
export declare const SHELF_BOARD_INSET = 0.001;
export declare function shelfBoardDimensions(width: number, thickness: number, depth: number, insetWidth?: boolean): [number, number, number];
export declare function shelfRowBoardDimensions(host: ShelfNode, rowY: number): [number, number, number];
//# sourceMappingURL=shelf-board.d.ts.map