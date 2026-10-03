import * as THREE from 'three';
import { type Brush, Evaluator } from 'three-bvh-csg';
export declare function ensureRenderableGeometryAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry;
export declare function csgGeometry(brush: Brush): THREE.BufferGeometry;
export declare function csgMaterials(brush: Brush): THREE.Material[];
export declare const csgEvaluator: Evaluator;
export declare function computeGeometryBoundsTree(geometry: THREE.BufferGeometry): void;
export declare function prepareBrushForCSG(brush: Brush): void;
export declare function subtractCsgBrush(left: Brush, right: Brush, evaluator: Evaluator): Brush;
export { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
//# sourceMappingURL=csg-utils.d.ts.map