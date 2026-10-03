import type { NodeDefinition } from '@pascal-app/core';
import { DoorNode } from './schema';
/**
 * Door — Phase 5 batch kind. Hosted on walls, cuts holes in them,
 * animated open/close state.
 *
 * Capabilities:
 *  - **No `movable`**: door's move is bespoke wall-bound drag (slide
 *    along the wall, snap to wall start/end). Capability-driven dispatch
 *    keeps legacy `MoveDoorTool`.
 *  - `selectable`, `duplicable`, `deletable` standard.
 *
 * Stages:
 *  - A: registered.
 *  - B: deferred — door geometry (frame / leaf / glass / hardware /
 *    segments) is ~800 lines in DoorSystem; extraction is a focused
 *    session. `def.renderer` (wrap-export of legacy DoorRenderer) +
 *    `def.system` (DoorSystem + DoorAnimationSystem bundle) hold parity.
 *  - C: `def.floorplan` polygon sits in parent wall's cutout. Legacy
 *    `openingPolygons` short-circuits door entries when registered.
 */
export declare const doorDefinition: NodeDefinition<typeof DoorNode>;
//# sourceMappingURL=definition.d.ts.map