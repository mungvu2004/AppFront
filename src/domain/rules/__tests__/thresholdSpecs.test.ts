/**
 * The seam between the engine's defaults and the screen's fields.
 *
 * `config.ts` holds `DEFAULT_RULE_THRESHOLDS` — the numbers the twenty-five
 * checks actually measure against — and `thresholdSpecs.ts` holds the label,
 * unit and band each of those numbers is edited in. They are two files so that
 * `runner.ts`, which every screen with a rule pass pulls into its bundle, does
 * not drag twenty-six Vietnamese labels along with it.
 *
 * Two files means two places a number could live, and that is exactly the drift
 * this file exists to refuse. Every assertion below is about the seam itself:
 * same keys on both sides, same value for each key, and no way for a spec to
 * quietly invent a default the engine never ships. `config.test.ts` still
 * checks each default against the constant in the check that reads it — this
 * file checks that the screen sees the same map the engine does.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_RULE_THRESHOLDS } from '../config';
import { RULE_THRESHOLD_SPECS } from '../thresholdSpecs';

describe('ngưỡng: một nguồn sự thật', () => {
  it('mỗi spec lấy đúng giá trị mặc định của engine', () => {
    for (const spec of RULE_THRESHOLD_SPECS) {
      expect(
        spec.defaultValue,
        `khoá ${spec.key} lệch giữa spec và DEFAULT_RULE_THRESHOLDS`,
      ).toBe(DEFAULT_RULE_THRESHOLDS[spec.key]);
    }
  });

  it('không spec nào mang khoá mà engine không biết', () => {
    // A spec with no entry in the map has no shipped value at all, so
    // "khôi phục mặc định" would put a number on screen no rule ever read.
    const unknown = RULE_THRESHOLD_SPECS.filter(
      (spec) => DEFAULT_RULE_THRESHOLDS[spec.key] === undefined,
    ).map((spec) => spec.key);

    expect(unknown).toEqual([]);
  });

  it('không ngưỡng nào của engine thiếu chỗ để chỉnh', () => {
    // The other direction: a default the screen cannot reach is a number a
    // project is silently forbidden to change.
    const specKeys = new Set(RULE_THRESHOLD_SPECS.map((spec) => spec.key));
    const unreachable = Object.keys(DEFAULT_RULE_THRESHOLDS).filter((key) => !specKeys.has(key));

    expect(unreachable).toEqual([]);
  });

  it('mỗi khoá chỉ xuất hiện một lần', () => {
    const keys = RULE_THRESHOLD_SPECS.map((spec) => spec.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
