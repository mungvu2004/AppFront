import '../../../three-types';
import { type LinearUnit, type MetricNotation } from '../../../lib/measurements';
type PlacementBoxMeasurements = {
    unit: LinearUnit;
    metricNotation?: MetricNotation;
};
/**
 * Green/red placement footprint shown while a node follows the cursor — the
 * same wireframe-box + radial base plane the GLB item tool draws (geometry
 * helpers shared via `placement-box-geometry`). Unlike the item coordinator's
 * imperative cursor (it mutates module-singleton materials in a `useFrame`
 * loop), this is a declarative, React-driven box: the caller passes the live
 * `position` / `rotationY` / `valid` and the box re-renders. Its own materials
 * are instanced per-mount so it never fights the item tool's singletons.
 *
 * The box is centred on its footprint in X/Z and sits on the floor (its base
 * at the group origin's Y), so a node whose local origin is floor-level — like
 * a shelf — lines up without an extra offset.
 */
export declare function PlacementBox({ activeDimensionId, dimensions, dimensionInput, measurements, measurementValues, onDimensionSelect, position, rotationY, valid, }: {
    /** Footprint extent `[width, height, depth]` (unrotated). */
    dimensions: [number, number, number];
    /** Optional dimension guide labels matching the GLB item placement cursor. */
    measurements?: PlacementBoxMeasurements;
    /** Values represented by the editable dimension pills; defaults to the box dimensions. */
    measurementValues?: [width: number, height: number, depth: number];
    /** World-plan position of the footprint centre (floor level). */
    position: [number, number, number];
    /** Y-rotation in radians, applied to the whole box. */
    rotationY?: number;
    /** Drives the colour: green when placeable, red otherwise. */
    valid: boolean;
    activeDimensionId?: string | null;
    dimensionInput?: string;
    onDimensionSelect?: (id: string) => void;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=placement-box.d.ts.map