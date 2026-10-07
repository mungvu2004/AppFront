import { type ForwardedRef } from 'react';
import { type MetricNotation } from '../../lib/measurements';
export declare function formatMeasurement(value: number, unit: 'metric' | 'imperial', metricNotation?: MetricNotation): string;
type MeasurePart = 'height' | 'length' | 'thickness';
export interface DimensionPillPart {
    key: string;
    prefix: string;
    value: number;
    /** Render an explicit +/- sign — for deltas rather than absolute sizes. */
    signed?: boolean;
}
/**
 * Generic floating dimension pill: a row of `prefix value` readouts with the
 * active one emphasised. Styled to match the top-center floating info bar
 * (rounded-full, design-token colours) so it tracks the app theme.
 *
 * `primaryRef` points at the primary value's `<span>` so a caller driving a
 * per-frame drag can rewrite its text imperatively without a React re-render.
 */
export declare function DimensionPill({ parts, unit, primary, primaryRef, }: {
    parts: DimensionPillPart[];
    unit: 'metric' | 'imperial';
    primary?: string;
    primaryRef?: ForwardedRef<HTMLSpanElement>;
}): import("react").JSX.Element;
/**
 * Floating dimension pill shown during wall / fence drags: `H · L · T` with
 * the actively-dragged dimension emphasised.
 *
 * The forwarded ref points at the `primary` value's `<span>` so a caller
 * driving a per-frame drag (the height arrow) can rewrite its text
 * imperatively without a React re-render. Callers that re-render naturally
 * (the endpoint tools) ignore the ref and just pass live values as props.
 */
export declare const MeasurementPill: import("react").ForwardRefExoticComponent<{
    height: number;
    length: number;
    thickness: number;
    unit: "metric" | "imperial";
    primary: MeasurePart;
} & import("react").RefAttributes<HTMLSpanElement>>;
export {};
//# sourceMappingURL=measurement-pill.d.ts.map