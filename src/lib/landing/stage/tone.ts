/**
 * The stage's one tone curve, Khronos PBR Neutral, and its inverse.
 *
 * Neutral is the identity up to 0.76 and only rolls off the top, so plaster,
 * oak and linen keep their hue (AgX greys whites and desaturates — R1). The
 * cost is that a flat colour above the knee lands a little darker than
 * written: Paper Ivory #F3EFE6 is above it. The background is therefore
 * written as `inverseNeutral(paper)`, so after the curve the screen shows
 * the paper exactly. Unlit paper drawn in the scene (ink's sheet) needs the
 * same pre-image to match it.
 */

import { Color } from 'three';

const START = 0.8 - 0.04;
const DESATURATION = 0.15;

/** three's / postprocessing's `NeutralToneMapping`, on linear RGB in place. */
export function neutral(c: Color): Color {
  const x = Math.min(c.r, c.g, c.b);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c.r -= offset;
  c.g -= offset;
  c.b -= offset;
  const peak = Math.max(c.r, c.g, c.b);
  if (peak < START) {
    return c;
  }
  const d = 1 - START;
  const newPeak = 1 - (d * d) / (peak + d - START);
  c.multiplyScalar(newPeak / peak);
  const g = 1 - 1 / (DESATURATION * (peak - newPeak) + 1);
  c.r += (newPeak - c.r) * g;
  c.g += (newPeak - c.g) * g;
  c.b += (newPeak - c.b) * g;
  return c;
}

/** The linear colour that `neutral` maps to `target` (fixed-point; the curve is monotone). */
export function inverseNeutral(target: Color): Color {
  const x = target.clone();
  const probe = new Color();
  for (let i = 0; i < 40; i += 1) {
    neutral(probe.copy(x));
    x.r += target.r - probe.r;
    x.g += target.g - probe.g;
    x.b += target.b - probe.b;
  }
  return x;
}
