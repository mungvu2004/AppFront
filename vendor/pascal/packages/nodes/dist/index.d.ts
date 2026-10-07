import type { Plugin } from '@pascal-app/core';
/**
 * Built-in plugin bundling every node kind shipped with the Pascal editor.
 *
 * Apps load this once at bootstrap (`loadPlugin(builtinPlugin)`) before
 * mounting the viewer. New built-in nodes are added by creating a folder
 * here under `src/<kind>/` and appending its `NodeDefinition` below.
 *
 * External plugins follow the exact same shape — same `Plugin` type, same
 * `loadPlugin` call path. This is intentional: the API is stress-tested
 * by built-ins before any third-party plugin lands.
 *
 * All kinds are registered unconditionally. Parity is verified by
 * comparing against deployed production rather than an in-app env-var
 * flag toggle. As of Phase 6 the legacy mount points in `viewer/` are
 * gone — every kind dispatches through the registry.
 */
export declare const builtinPlugin: Plugin;
export { applyBlockCommand, type BlockCommand, type BlockCommandResult, type BlockSelection, blockFaceCentroid, blockFaceNormal, } from './block/commands';
export { blockDefinition } from './block/definition';
export { boxVentDefinition } from './box-vent';
export { buildingDefinition } from './building';
export { bakeCabinetAnimationClip, CABINET_PLANNING_TOLERANCE, type CabinetPlacementType, type CabinetPlanningIssue, type CabinetPlanningIssueCode, type CabinetPlanningOptions, type CabinetPlanningReport, cabinetDefinition, cabinetModuleDefinition, MIN_PRACTICAL_TOP_CABINET_HEIGHT, poseCabinetMovingParts, useCabinetPlacementStatus, useCabinetPlacementType, validateCabinetRun, } from './cabinet';
export { ceilingDefinition } from './ceiling';
export { chimneyDefinition } from './chimney';
export { columnDefinition } from './column';
export { constructionDimensionDefinition } from './construction-dimension';
export { cupolaDefinition } from './cupola';
export { doorDefinition } from './door';
export { dormerDefinition } from './dormer';
export { downspoutDefinition } from './downspout';
export { ductFittingDefinition } from './duct-fitting';
export { ductSegmentDefinition } from './duct-segment';
export { ductTerminalDefinition } from './duct-terminal';
export { elevatorDefinition } from './elevator';
export { eyebrowVentDefinition } from './eyebrow-vent';
export { fenceDefinition } from './fence';
export { guideDefinition } from './guide';
export { gutterDefinition } from './gutter';
export { hvacEquipmentDefinition } from './hvac-equipment';
export { importedMeshDefinition } from './imported-mesh';
export { itemDefinition } from './item';
export { leanToExtensionDefinition } from './lean-to-extension';
export { levelDefinition } from './level';
export { linesetDefinition } from './lineset';
export { liquidLineDefinition, useLiquidLineToolOptions } from './liquid-line';
export { measurementDefinition } from './measurement';
export { pipeFittingDefinition } from './pipe-fitting';
export { pipeSegmentDefinition } from './pipe-segment';
export { pipeTrapDefinition } from './pipe-trap';
export { ridgeVentDefinition } from './ridge-vent';
export { type RoofFootprintSourceChoice, roofDefinition, useRoofFootprintSource } from './roof';
export { roofSegmentDefinition } from './roof-segment';
export { scanDefinition } from './scan';
export { shelfDefinition } from './shelf';
export { siteDefinition } from './site';
export { skylightDefinition } from './skylight';
export { slabDefinition } from './slab';
export { solarPanelDefinition } from './solar-panel';
export { spawnDefinition } from './spawn';
export { stairDefinition } from './stair';
export { stairSegmentDefinition } from './stair-segment';
export { structuralGridDefinition } from './structural-grid';
export { turbineVentDefinition } from './turbine-vent';
export { unitDefinition } from './unit';
export { wallDefinition } from './wall';
export { windowDefinition } from './window';
export { zoneDefinition } from './zone';
//# sourceMappingURL=index.d.ts.map