import './structured-clone-fallback';
import { type Kind } from '@pascal-app/lingo';
/**
 * Natural-language measurement parsing for editor property fields, backed by
 * `@pascal-app/lingo`. Lets a user type `6ft`, `180cm`, `1m80`, `5'11"`, `45°`
 * or `1.57rad` into any measurement field and have it canonicalized to the
 * unit the field stores its value in — independent of the metric/imperial
 * display toggle.
 *
 * The editor stores linear values in meters and angular values in radians (a
 * few fields store inches or degrees); lingo's `length` base is meters and its
 * `angle` base is radians, so a field's `unit` prop already names the stored /
 * canonical unit and doubles as the parse target.
 */
export interface LingoUnitSpec {
    kind: Kind;
    /** Unit id the field's stored `value` is expressed in — the parse target. */
    unitId: string;
}
/**
 * Map an editor field `unit` prop to a lingo kind + canonical unit. Returns
 * `null` for units we deliberately do NOT natural-language-parse (plain
 * numbers, percentages, angular rates, counts) so those keep exact
 * `Number.parseFloat` behavior.
 */
export declare function lingoUnitSpec(unit: string | undefined): LingoUnitSpec | null;
export interface ParseMeasurementOptions {
    /**
     * Implied unit for a BARE number (e.g. `6` → `6 ft`). Defaults to the field's
     * own `unitId`. A typed unit (`180cm`) is always honored regardless.
     */
    bareUnit?: string;
    /** Disambiguates gal/ton/cup families; harmless for length/angle. */
    system?: 'metric' | 'us' | 'imperial';
}
/**
 * Parse typed field text into the field's stored numeric unit. Returns `null`
 * when the text can't be read as a quantity, so the caller can fall back to a
 * plain number parse or revert to the previous value.
 */
export declare function parseMeasurement(raw: string, spec: LingoUnitSpec, options?: ParseMeasurementOptions): number | null;
export interface MeasurementHintOptions extends ParseMeasurementOptions {
    /** Unit id the preview is rendered in (the field's displayed unit). */
    displayUnit?: string;
    /** Max fraction digits in the preview. */
    precision?: number;
    /**
     * Clamp applied to the parsed stored value before previewing, so the hint
     * reflects what a commit would actually store on a bounded field.
     */
    clamp?: (stored: number) => number;
}
/**
 * A faint "= 1.83 m" preview of the value currently being typed, shown only
 * when the user typed something beyond a plain decimal in the field's own unit
 * (an explicit unit, a compound like `1m80`, or a number word) and it parses.
 * Returns `null` when there's nothing useful to preview.
 */
export declare function measurementHint(raw: string, spec: LingoUnitSpec, options?: MeasurementHintOptions): string | null;
//# sourceMappingURL=measurement-parser.d.ts.map