import { type NodeDefinition } from '@pascal-app/core';
import { ColumnNode } from './schema';
/**
 * Column — Stage A registration. Wrap-export of the legacy
 * `ColumnRenderer` (no system — column geometry is computed inline in
 * the renderer). Inspector / floorplan still go through legacy paths via
 * panel-manager.tsx / floorplan-panel.tsx (their hardcoded `case 'column':`
 * entries fire before the registry fallback).
 *
 * Capabilities: column declares the generic `movable` (translate on XZ
 * with grid snap), so its 3D move runs through the shared
 * `MoveRegistryNodeTool` — which gives it grid/line/off snapping, alignment,
 * R/T rotation, slab-elevation lift, and the `collides` red/green placement
 * box for free. (2D move still routes through `floorplanMoveTarget`, which
 * wins the 2D dispatch.)
 *
 * Defaults computed via stub-parse so we leverage every zod
 * `.default()` annotation on the schema (~60 fields).
 */
export declare const columnDefinition: NodeDefinition<typeof ColumnNode>;
//# sourceMappingURL=definition.d.ts.map