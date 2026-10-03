import type { BlockFace, BlockNode, BlockTopology, GeometryContext } from '@pascal-app/core';
import { type ColorPreset, type RenderShading } from '@pascal-app/viewer';
import { Group } from 'three';
type Point = [number, number, number];
export declare function triangulateBlockFace(topology: BlockTopology, face: BlockFace): {
    triangles: [Point, Point, Point][];
    normal: Point;
} | null;
export declare function buildBlockGeometry(node: BlockNode, ctx?: Pick<GeometryContext, 'materials'>, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string): Group;
export {};
//# sourceMappingURL=geometry.d.ts.map