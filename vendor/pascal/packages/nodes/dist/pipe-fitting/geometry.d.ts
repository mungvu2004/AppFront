import { Group } from 'three';
import type { PipeFittingNode } from './schema';
/**
 * Pure local-frame DWV fitting geometry. Ports remain the network contract;
 * the model grows inward from each collar so replacing the old primitives does
 * not move any connected pipe endpoint.
 */
export declare function buildPipeFittingGeometry(node: PipeFittingNode): Group;
//# sourceMappingURL=geometry.d.ts.map