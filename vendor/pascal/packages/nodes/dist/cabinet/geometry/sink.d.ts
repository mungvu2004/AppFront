import { Group, type Material, Mesh } from 'three';
import { type SinkBowlSpec } from '../appliance-layout';
export { FAUCET_SETBACK, type SinkBowlSpec, sinkBowls } from '../appliance-layout';
/**
 * Subtract the sink bowl openings from a countertop mesh via three-bvh-csg.
 * `cutCenterX/Z` position the sink footprint in the countertop mesh's local
 * frame (the run countertop spans several modules, so the sink is off-center
 * there). Returns a replacement mesh; the caller swaps it into the group.
 */
export declare function cutSinkIntoCountertop(countertop: Mesh, bowls: SinkBowlSpec[], cutCenterX: number, cutCenterZ: number, countertopThickness: number): Mesh;
/**
 * Undermount sink: basin shells + faucet, positioned under a countertop
 * opening the caller has already cut via {@link cutSinkIntoCountertop}.
 * `rimY` is the underside of the countertop (= carcass top);
 * `countertopThickness` is the effective slab thickness above the rim (the
 * parent run's when the module doesn't own its countertop).
 */
export declare function addSinkCompartment(group: Group, bowls: SinkBowlSpec[], centerX: number, centerZ: number, rimY: number, countertopThickness: number, index: number, applianceMaterial: Material): void;
//# sourceMappingURL=sink.d.ts.map