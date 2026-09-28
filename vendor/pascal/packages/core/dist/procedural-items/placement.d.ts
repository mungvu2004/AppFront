import type { CeilingNode } from '../schema/nodes/ceiling.js';
import type { WallNode } from '../schema/nodes/wall.js';
import type { ProceduralItemNode } from './node.js';
import { type QueryNodes } from './query.js';
export declare function resolveProceduralWallPlacement(node: ProceduralItemNode, wall: WallNode, x: number, y: number, side: 'front' | 'back', nodes: QueryNodes): ProceduralItemNode | null;
export declare function resolveProceduralCeilingPlacement(node: ProceduralItemNode, ceiling: CeilingNode, x: number, z: number, yaw?: number): ProceduralItemNode;
//# sourceMappingURL=placement.d.ts.map