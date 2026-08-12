const BASE_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;
const JITTER_MAX_MS = 200;
const STABLE_THRESHOLD_MS = 30_000;

export interface BackoffClock {
  now(): number;
}

export interface BackoffOptions {
  clock?: BackoffClock;
  random?: () => number;
}

export interface BackoffHandle {
  nextDelayMs(): number;
  attemptIndex(): number;
  advance(): void;
  markConnected(): void;
  resetIfStable(): void;
}

export function createBackoff(options: BackoffOptions = {}): BackoffHandle {
  const clock = options.clock ?? { now: () => Date.now() };
  const random = options.random ?? Math.random;

  let attempt = 0;
  let connectedAt: number | null = null;

  return {
    nextDelayMs(): number {
      const baseDelay = BASE_DELAYS_MS[Math.min(attempt, BASE_DELAYS_MS.length - 1)] ?? 30_000;
      const jitter = Math.floor(random() * (JITTER_MAX_MS + 1));

      return baseDelay + jitter;
    },

    attemptIndex(): number {
      return attempt;
    },

    advance(): void {
      attempt += 1;
      connectedAt = null;
    },

    markConnected(): void {
      connectedAt = clock.now();
    },

    resetIfStable(): void {
      if (connectedAt === null) return;

      if (clock.now() - connectedAt >= STABLE_THRESHOLD_MS) {
        attempt = 0;
        connectedAt = null;
      }
    },
  };
}
