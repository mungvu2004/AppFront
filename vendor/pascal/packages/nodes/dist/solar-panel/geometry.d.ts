import type { RoofSegmentNode, SolarPanelNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare function createSolarPanelTexture(): THREE.CanvasTexture | null;
export declare function getDefaultPanelMaterial(): THREE.Material;
/**
 * Pure builder for a solar panel array. Generates one merged
 * BufferGeometry containing every cell of the rows × columns grid,
 * with two render groups so the frame (group 0) and the glass
 * (group 1) can carry distinct materials.
 *
 * Pure: no React, no scene access, no store mutation. The renderer
 * places this geometry in segment-local space with the surface tilt
 * applied as an outer JSX rotation.
 */
export declare function buildSolarPanelGeometry(node: SolarPanelNode): THREE.BufferGeometry | null;
/**
 * Return the rows/columns that fit the array edge-to-edge on the slope
 * the panel is sitting on. Returns null when nothing fits. Capped at
 * the schema's hard limit of 20.
 */
export declare function computeAutoFit(segment: RoofSegmentNode, panel: SolarPanelNode): {
    rows: number;
    columns: number;
} | null;
export declare function flippedPanelDims(panel: SolarPanelNode): {
    panelWidth: number;
    panelHeight: number;
};
//# sourceMappingURL=geometry.d.ts.map