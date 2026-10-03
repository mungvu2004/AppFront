import type { GeometryContext } from '@pascal-app/core';
import { type ColorPreset, type RenderShading } from '@pascal-app/viewer';
import { ExtrudeGeometry, Group, type Material, Mesh, Vector3 } from 'three';
import type { DuctSegmentNode } from './schema';
export declare const INCHES_TO_METERS = 0.0254;
/**
 * Area-equivalent round diameter (inches) for a rect cross-section —
 * what a rect trunk advertises on its ports so round fittings / branches
 * mate at a sensible size.
 */
export declare function equivalentDiameterIn(widthIn: number, heightIn: number): number;
/**
 * Area-equivalent round diameter (inches) for a flat-oval cross-section:
 * a rectangle of (width − height) × height plus the two semicircular caps.
 */
export declare function ovalEquivalentDiameterIn(widthIn: number, heightIn: number): number;
/** The diameter (inches) a duct segment presents at its ports. */
export declare function ductPortDiameterIn(node: {
    shape?: 'round' | 'rect' | 'oval';
    diameter: number;
    width?: number;
    height?: number;
}): number;
/**
 * Cross-section axes for a rect run along `dir`, rolled `roll` radians
 * about the run direction. At roll 0: width is the horizontal axis
 * (UP × dir) and height the vertical one — vertical runs, where that
 * cross product degenerates, fall back to world X/Z. `roll` rotates the
 * pair in the plane perpendicular to `dir`, letting a riser carry the
 * orientation of the run it turned off instead of the bare fallback.
 */
export declare function rectSectionAxes(dir: Vector3, roll?: number): {
    width: Vector3;
    height: Vector3;
};
/**
 * Roll (radians) that keeps a rect cross-section continuous across an
 * elbow: the dimension lying along the joint's hinge — the bend-plane
 * normal `portDir × newDir`, perpendicular to both legs — must stay on
 * the same physical face on the new run as on the source run. Returns 0
 * for an in-plane (degenerate-normal) joint, so horizontal turns keep
 * the natural width-horizontal orientation.
 */
export declare function rollToContinueAcrossElbow(sourceDir: Vector3, sourceRoll: number, portDir: Vector3, newDir: Vector3): number;
/**
 * Rect box spanning `start`→`end`. Orientation comes from `rectSectionAxes`
 * (width horizontal, height vertical by default; `roll` reorients a riser
 * to stay continuous through its elbow). Quaternion from an explicit basis
 * — the minimal-rotation `setFromUnitVectors` used for cylinders would roll
 * the cross-section on axis-aligned runs.
 */
export declare function buildRectSection(start: Vector3, end: Vector3, widthM: number, heightM: number, material: Material, name: string, roll?: number): Mesh | null;
/**
 * Centered flat-oval prism with the same local axes as the rect box
 * (X = width, Y = run length, Z = height), so sections and previews
 * orient it with the `rectSectionAxes` basis.
 */
export declare function createOvalSectionGeometry(widthM: number, heightM: number, lengthM: number): ExtrudeGeometry;
/**
 * Flat-oval section spanning `start`→`end` — the oval counterpart of
 * `buildRectSection`, sharing its orientation basis and roll semantics.
 */
export declare function buildOvalSection(start: Vector3, end: Vector3, widthM: number, heightM: number, material: Material, name: string, roll?: number): Mesh | null;
/**
 * Cylinder spanning `start`→`end` at `radius`. Shared by the segment and
 * fitting builders — fittings are just short sections + a junction.
 */
export declare function buildSection(start: Vector3, end: Vector3, radius: number, material: Material, name: string): Mesh | null;
type DuctAppearance = {
    ductMaterial: 'sheet-metal' | 'spiral' | 'flex' | 'duct-board';
    system: 'supply' | 'return';
    slots?: Record<string, string>;
};
/**
 * Standard duct body material — a plain white matte finish so runs and
 * fittings read like walls / other building elements rather than tinted
 * metal. Shared with the fitting builder so connected runs and junctions
 * look like one piece.
 */
export declare function createDuctMaterial(node: DuctAppearance, sceneMaterials?: GeometryContext['materials'], shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string): Material;
/**
 * Pure geometry builder for a round duct segment polyline.
 *
 * Strategy:
 *   - For every consecutive pair of path points, build a cylinder of the
 *     duct's inner diameter.
 *   - Drop a sphere of the same radius at every interior joint to cap the
 *     corner smoothly (no mitering yet — fittings come in a later slice).
 *   - When insulation is non-zero, repeat the same pattern at a larger
 *     radius using a translucent shell material.
 *
 * All children are returned in level-local meters; the framework's
 * `<ParametricNodeRenderer>` handles the node-level transform (currently
 * identity since the schema has no position field — the path itself is
 * absolute within the level).
 */
export declare function buildDuctSegmentGeometry(node: DuctSegmentNode, ctx?: GeometryContext, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string): Group;
export {};
//# sourceMappingURL=geometry.d.ts.map