import { type AnyNode, type ItemNode, type LevelNode } from '@pascal-app/core';
import type { FloorplanItemEntry, FloorplanNodeTransform, LevelDescendantMap } from './types';
export declare function collectLevelDescendants(levelNode: LevelNode, nodes: Record<string, AnyNode>): AnyNode[];
export declare function getItemFloorplanTransform(item: ItemNode, nodeById: LevelDescendantMap, cache: Map<string, FloorplanNodeTransform | null>): FloorplanNodeTransform | null;
export declare function buildFloorplanItemEntry(item: ItemNode, nodeById: LevelDescendantMap, cache: Map<string, FloorplanNodeTransform | null>): FloorplanItemEntry | null;
//# sourceMappingURL=items.d.ts.map