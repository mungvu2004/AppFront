import type { GeometryContext } from '@pascal-app/core';
import { Group, MeshStandardMaterial } from 'three';
import type { PipeSegmentNode } from './schema';
type PipeAppearance = {
    pipeMaterial: 'pvc' | 'abs' | 'cast-iron';
    system: 'waste' | 'vent';
};
export declare function createPipeMaterial(node: PipeAppearance): MeshStandardMaterial;
/**
 * Pure geometry builder for a DWV pipe run: capped cylinder sections
 * between consecutive path points with sphere hubs at interior joints
 * (proper wyes / sanitary tees come in the next slice). Slope lives in
 * the path's Y coordinates — nothing here is slope-aware.
 */
export declare function buildPipeSegmentGeometry(node: PipeSegmentNode, ctx?: GeometryContext): Group;
export {};
//# sourceMappingURL=geometry.d.ts.map