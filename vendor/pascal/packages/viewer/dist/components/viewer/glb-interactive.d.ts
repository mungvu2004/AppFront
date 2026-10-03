import { type AnyNodeId, type Interactive, type SceneGraph } from '@pascal-app/core';
import { type EvaluatedLight, type ProceduralItemNode } from '@pascal-app/core/procedural-items';
import { type AnimationAction, type Object3D, Vector3 } from 'three';
/** An interactive item recovered from the scene graph so the baked GLB can be
 *  re-lit / re-animated by joining on `pascalId`. The GLB carries the geometry
 *  + identity; the effects + controls live in the DB scene graph (no sidecar). */
export type GlbInteractiveItem = {
    pascalId: AnyNodeId;
    label: string;
    /** Item height (world units) for placing the controls overlay above it. */
    height: number;
    interactive: Interactive;
    procedural?: {
        lights: EvaluatedLight[];
        parts: ProceduralItemNode['recipe']['parts'];
    };
};
/** A baked zone's identity node + its local floor polygon (from `extras`). */
export type GlbZoneRef = {
    id: string;
    node: Object3D;
    polygon: [number, number][];
};
/** Pull the interactive items out of a scene graph. Only items that actually
 *  carry effects (light / animation) are returned — everything else baked
 *  faithfully and needs no runtime help. */
export declare function buildGlbInteractiveItems(sceneGraph: SceneGraph | null | undefined): GlbInteractiveItem[];
export declare function buildGlbLightRegs(items: GlbInteractiveItem[], identity: Map<string, Object3D>): GlbLightReg[];
/**
 * Re-creates the item-driven interactivity the parametric viewer has — pooled
 * lights, ambient animation, and the controls overlay — on top of a baked GLB.
 * Effects come from the DB scene graph (`items`); world transforms come from the
 * baked Object3Ds (`identity`), joined on `pascalId`. Nothing is stamped into
 * the GLB itself, so the artifact stays integrator-clean.
 */
export declare function GlbInteractive({ items, identity, zones, actions, levelOrder, }: {
    items: GlbInteractiveItem[];
    identity: Map<string, Object3D>;
    zones: GlbZoneRef[];
    /** Baked animation actions keyed by clip name — ambient item loops play from
     *  `<pascalId>: loop`. */
    actions: Record<string, AnimationAction | null>;
    /** Level pascalIds bottom-to-top, so the light pool can prefer ground-floor
     *  lights when nothing is focused (mirrors the parametric level factor). */
    levelOrder: string[];
}): import("react").JSX.Element;
export type GlbLightReg = {
    key: string;
    nodeId: AnyNodeId;
    object: Object3D;
    color: string;
    distance: number;
    getWorldPosition: (out: Vector3) => void;
    getIntensity: () => number;
    isOn: () => boolean;
    levelId: string | null;
};
//# sourceMappingURL=glb-interactive.d.ts.map