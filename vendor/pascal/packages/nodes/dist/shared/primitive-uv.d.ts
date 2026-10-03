import * as THREE from 'three';
export type MetricUv = readonly [number, number];
type Point3 = readonly [number, number, number] | number[];
/** Return cumulative metre distances along a sampled open or closed profile. */
export declare function cumulativeProfileDistances(points: readonly Point3[]): number[];
/** Project a flat polygon into metre-scaled UV coordinates without shearing trapezoids. */
export declare function planarMetricUvs(points: readonly Point3[], normal: Point3, uOffset?: number, vOffset?: number): MetricUv[];
/** Reuse the authored unwrap for AO and light maps, which read texture channel 2. */
export declare function copyUvToSecondaryChannel(geometry: THREE.BufferGeometry): void;
/** Apply metre-scaled planar UVs to a non-indexed, axis-aligned primitive. */
export declare function applyPlanarWorldUvs(geometry: THREE.BufferGeometry): void;
/** Scale cylinder/cone side UVs by circumference and height; caps use XZ metres. */
export declare function applyCylinderWorldUvs(geometry: THREE.BufferGeometry, radius: number, height: number): void;
/** Scale a sphere's equirectangular UVs to its circumference and pole distance. */
export declare function applySphereWorldUvs(geometry: THREE.BufferGeometry, radius: number): void;
export {};
//# sourceMappingURL=primitive-uv.d.ts.map