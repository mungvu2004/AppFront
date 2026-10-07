import { type NodeDefinition } from '@pascal-app/core';
import { ItemNode } from './schema';
/**
 * Item — Phase 5 batch kind. Catalog-backed, GLB-rendered, multi-host.
 *
 * Demonstrates the **custom `def.renderer` escape hatch** (see
 * plans/editor-node-registry.md): items use `useGLTF` from drei to
 * load CDN assets, plus a non-trivial interactive-widget layer inside
 * the rendered scene. Not expressible as a pure `def.geometry`. The
 * registry mounts the custom React renderer as-is.
 *
 * Capabilities:
 *  - **No `movable`**: item's move is bespoke `MoveItemContent` —
 *    handles attachTo transitions mid-drag (floor ↔ wall ↔ ceiling),
 *    asset.attachTo lookups, scale-preserving Y math for surface
 *    placement. The smooth generic mover can't express that. Legacy
 *    mover keeps running via capability-driven dispatch.
 *  - `selectable`, `duplicable`, `deletable` standard.
 *
 * Stages:
 *  - A: registered.
 *  - B: N/A — def.renderer escape hatch (GLB / useGLTF).
 *  - C: `def.floorplan` resolves parent chain via `ctx.resolve`,
 *    returns a rotated rectangle (width × depth). Mirrors the legacy
 *    `getItemFloorplanTransform` math. Legacy `floorplanItemEntries`
 *    short-circuits when item is registered.
 *
 * `toolHints`: matches the legacy ItemHelper UI (mouse / R / T / Shift /
 * Esc) — registry-driven placement panel.
 */
export declare const itemDefinition: NodeDefinition<typeof ItemNode>;
//# sourceMappingURL=definition.d.ts.map