/**
 * Quality tiers (Prompt 5 §6) and the governor that steps down between them.
 *
 * The tiers are data so the renderer and the post chain read one table. The
 * governor only ever suggests a *lower* tier: a page that climbs back up after
 * a cheap stretch flickers between looks, which is worse than staying a notch
 * down. Within that, hysteresis (start counting above the budget, stop only
 * below a lower line) and a cooldown after every step keep one slow frame —
 * a texture upload, a shader compile — from costing a tier.
 */

export type Quality = 'full' | 'balanced' | 'lite';

export interface QualitySettings {
  readonly maxDpr: number;
  readonly composer: boolean;
  readonly ao: boolean;
  readonly aoHalfRes: boolean;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
}

export const QUALITY: Readonly<Record<Quality, QualitySettings>> = {
  full: { maxDpr: 2, composer: true, ao: true, aoHalfRes: false, shadows: true, shadowMapSize: 2048 },
  balanced: { maxDpr: 1.5, composer: true, ao: true, aoHalfRes: true, shadows: true, shadowMapSize: 1024 },
  lite: { maxDpr: 1, composer: false, ao: false, aoHalfRes: false, shadows: false, shadowMapSize: 512 },
};

const LOWER: Readonly<Record<Quality, Quality | null>> = { full: 'balanced', balanced: 'lite', lite: null };

export interface GovernorOptions {
  /** Frames slower than this (EMA) count against the tier. */
  readonly budgetMs?: number;
  /** The EMA must fall below this to stop counting. */
  readonly recoverMs?: number;
  /** How long the EMA must stay over budget before a step down. */
  readonly sustainMs?: number;
  /** No suggestion this soon after the last one. */
  readonly cooldownMs?: number;
  readonly smoothing?: number;
}

export interface FrameGovernor {
  /** Feed one frame. Returns the tier to switch to, or null to stay. */
  sample(frameMs: number, nowMs: number): Quality | null;
  readonly quality: Quality;
  readonly emaMs: number;
}

export function createFrameGovernor(start: Quality = 'full', options: GovernorOptions = {}): FrameGovernor {
  const budget = options.budgetMs ?? 22;
  const recover = options.recoverMs ?? 18;
  const sustain = options.sustainMs ?? 2000;
  const cooldown = options.cooldownMs ?? 5000;
  const k = options.smoothing ?? 0.1;
  let quality = start;
  let ema = 0;
  let primed = false;
  let overSince: number | null = null;
  let lastSwitch = -Infinity;

  return {
    get quality() {
      return quality;
    },
    get emaMs() {
      return ema;
    },
    sample(frameMs, nowMs) {
      ema = primed ? ema + (frameMs - ema) * k : frameMs;
      primed = true;
      if (ema > budget) {
        overSince ??= nowMs;
      } else if (ema < recover) {
        overSince = null;
      }
      const next = LOWER[quality];
      if (next === null || overSince === null || nowMs - overSince < sustain || nowMs - lastSwitch < cooldown) {
        return null;
      }
      quality = next;
      lastSwitch = nowMs;
      overSince = null;
      primed = false;
      return next;
    },
  };
}
