import type { MaterialSchema } from '../schema/material.js';
import { type SceneMaterial } from '../schema/scene-material.js';
export declare function proceduralSlotColor(ref: string | undefined, fallback: string, materials: Record<string, SceneMaterial>): string;
export declare function setProceduralMaterial(nodeId: string, slotId: string, ref?: string, material?: MaterialSchema): void;
//# sourceMappingURL=materials.d.ts.map