import { type RidgeVentNode, type RoofSegmentNode } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * Pure builder for the ridge vent mesh. Each style is a peaked **band** of
 * constant thickness `t` that drapes over the ridge like a real ridge cap:
 * a shaped top surface, a parallel underside offset down by `t`, visible
 * eave thickness faces along both edges, and end caps.
 *
 * This is the middle ground between the two earlier extremes — the original
 * was a paper-thin shell (no perceptible thickness), then a flat-bottomed
 * solid (read as a closed box). The band keeps the V / arched cap silhouette
 * and the open underside (so it sits astride the ridge) while showing real
 * thickness at the eaves and ends.
 *
 *  - `standard`: smooth rounded arch
 *  - `shingled`: angular peak with raised shingle-course ridges across the top
 *  - `metal`: bent-metal cap with a wide flat seam and drip lips
 *
 * `endCaps` closes both ends. Pure: no React, no scene access, no mutation.
 */
export declare function buildRidgeVentGeometry(node: RidgeVentNode, segment?: RoofSegmentNode): THREE.BufferGeometry;
//# sourceMappingURL=geometry.d.ts.map