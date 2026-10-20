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
  /** n8ao sample/denoise preset. */
  readonly aoMode: 'Performance' | 'Low' | 'Medium';
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly smaa: 'low' | 'medium';
}

export const QUALITY: Readonly<Record<Quality, QualitySettings>> = {
  full: { maxDpr: 2, composer: true, ao: true, aoHalfRes: false, aoMode: 'Medium', shadows: true, shadowMapSize: 2048, smaa: 'medium' },
  // Measured on Intel UHD 1440×900 (tools/passes.mjs): the composer's half-float chain alone costs ≈ 7 ms and
  // n8ao another ≈ 7 (even 'Performance', half-res); shadows ≈ 0 once static. So the iGPU tier keeps the sun
  // shadow, drops the composer, and gets its edges from the context's MSAA: p50 7 / p95 14 ms vs 21 / 35.
  balanced: { maxDpr: 1, composer: false, ao: false, aoHalfRes: true, aoMode: 'Performance', shadows: true, shadowMapSize: 1024, smaa: 'low' },
  lite: { maxDpr: 1, composer: false, ao: false, aoHalfRes: false, aoMode: 'Performance', shadows: false, shadowMapSize: 512, smaa: 'low' },
};

/** Integrated GPUs (the target laptop's Intel UHD) start a notch down; Apple M-series do not. */
const INTEGRATED = /intel|uhd|iris|amd radeon\(tm\) graphics|radeon vega|mali|adreno/i;
const SOFTWARE = /swiftshader|llvmpipe|software|basic render/i;

/** The starting tier for a GPU, from its `UNMASKED_RENDERER_WEBGL` string ('' when hidden). */
export function qualityForRenderer(renderer: string): Quality {
  if (SOFTWARE.test(renderer)) {
    return 'lite';
  }
  return INTEGRATED.test(renderer) ? 'balanced' : 'full';
}

/** Ask the browser which GPU it has (a throwaway context, released at once) and pick the starting tier. */
export function pickStageQuality(): Quality {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (gl === null) {
    return 'lite';
  }
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info === null ? '' : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return qualityForRenderer(name);
}

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

/**
 * The tier the intro benchmark settles on: one step down per budget the
 * median frame misses (the intro holds still, so this is the only moment a
 * switch is free). Never climbs.
 */
export function benchmarkTier(start: Quality, medianFrameMs: number, budgetMs = 20): Quality {
  let tier = start;
  let cost = medianFrameMs;
  // Each step roughly halves the fill cost (measured on Intel UHD: full 48 → balanced ≈ 14 → lite 7 ms).
  while (cost > budgetMs && LOWER[tier] !== null) {
    tier = LOWER[tier] ?? tier;
    cost /= 2;
  }
  return tier;
}

/** Governor and DPR changes wait until the wheel/touch has been still this long. */
export const QUIET_MS = 600;

/**
 * Scroll feel (A/B in docs/trang-chu/impl/tools/feel.mjs): Lenis lerp, then a
 * second first-order stage on p with rate `k` (1/s). Snap below `snap`, or
 * when a jump is bigger than `jump` (skip, seek, restore) instead of
 * fast-forwarding through every scene.
 */
export const SCROLL_FEEL = { lerp: 0.15, k: 12, snap: 2e-5, jump: 0.25 } as const;

/** One frame of the second smoothing stage; `dtS` is clamped so a stalled tab does not overshoot. */
export function dampProgress(shown: number, raw: number, dtS: number, k: number = SCROLL_FEEL.k): number {
  const delta = raw - shown;
  if (Math.abs(delta) < SCROLL_FEEL.snap || Math.abs(delta) > SCROLL_FEEL.jump) {
    return raw;
  }
  const next = shown + delta * (1 - Math.exp(-k * Math.min(Math.max(dtS, 0), 0.1)));
  return Math.abs(raw - next) < SCROLL_FEEL.snap ? raw : next;
}

type NumberTree = Readonly<Record<string, number | Readonly<Record<string, number>>>>;

/** True when two `build`/`compliance` records hold the same numbers (one level of nesting) — the shadow map is then still valid. */
export function sameNumbers(a: NumberTree, b: NumberTree): boolean {
  for (const key in a) {
    const x = a[key];
    const y = b[key];
    if (typeof x === 'number' || typeof y === 'number' || x === undefined || y === undefined) {
      if (x !== y) {
        return false;
      }
    } else if (!sameNumbers(x, y)) {
      return false;
    }
  }
  for (const key in b) {
    if (!(key in a)) {
      return false;
    }
  }
  return true;
}
