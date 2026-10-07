import type { CabinetModuleNode, CabinetNode, GeometryContext } from '@pascal-app/core';
import type { ColorPreset, RenderShading } from '@pascal-app/viewer';
import { Group } from 'three';
export declare function getRunModules(ctx?: GeometryContext): CabinetModuleNode[];
export declare function buildCabinetRunGeometry(node: CabinetNode, ctx: GeometryContext | undefined, shading: RenderShading, textures: boolean, colorPreset: ColorPreset, sceneTheme: string | undefined): Group | null;
//# sourceMappingURL=run.d.ts.map