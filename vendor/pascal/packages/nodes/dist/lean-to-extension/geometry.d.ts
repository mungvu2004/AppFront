import type { GeometryContext, LeanToExtensionNode } from '@pascal-app/core';
import { type ColorPreset, type RenderShading } from '@pascal-app/viewer';
import { Group } from 'three';
export declare function leanToFacetCount(node: LeanToExtensionNode): number;
export declare function leanToExtensionGeometryKey(node: LeanToExtensionNode): string;
export declare function buildLeanToExtensionGeometry(node: LeanToExtensionNode, ctx?: GeometryContext, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string): Group;
//# sourceMappingURL=geometry.d.ts.map