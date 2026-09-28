import type { AnyNodeId, NodeDefinition, SceneApi, WindowNode as WindowNodeType } from '@pascal-app/core';
import { WindowNode } from './schema';
export declare function resolveWindowHandlePortalTarget(window: WindowNodeType, scene: Pick<SceneApi, 'get'>): AnyNodeId | null;
/**
 * Window — Phase 5 batch kind. Mirrors door's shape: hosted on walls,
 * cuts holes in them, animated open/close state for opening windows.
 *
 * Stages:
 *  - A: registered.
 *  - B: deferred — window geometry ~800 lines; extraction is a focused
 *    session. `def.renderer` + `def.system` wrap-export legacy.
 *  - C: `def.floorplan` polygon sits in parent wall's cutout. Legacy
 *    `openingPolygons` short-circuits window entries when registered.
 */
export declare const windowDefinition: NodeDefinition<typeof WindowNode>;
//# sourceMappingURL=definition.d.ts.map