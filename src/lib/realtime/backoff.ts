/**
 * backoff.ts — Logic bậc mũ cho SSE reconnect.
 *
 * Chuỗi khoảng chờ cơ sở (ms): 1 000 → 2 000 → 4 000 → 8 000 → 16 000 → 30 000 → 30 000 …
 * Jitter ngẫu nhiên: +0..200 ms.
 * Reset về bậc 0 sau khi kết nối ổn định ≥ 30 giây.
 *
 * Không phụ thuộc React, không import token/style.
 * Clock và random có thể inject để kiểm thử đồng hồ giả.
 */

const BASE_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

/** Jitter tối đa cộng thêm vào mỗi khoảng chờ (ms). */
const JITTER_MAX_MS = 200;

/** Ngưỡng ổn định để reset bậc về 0 (ms). */
const STABLE_THRESHOLD_MS = 30_000;

/** Khoảng chờ tối đa — cũng là giá trị fallback an toàn. */
const MAX_DELAY_MS = 30_000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BackoffClock {
  now(): number;
}

export interface BackoffOptions {
  clock?: BackoffClock;
  /** Hàm sinh số ngẫu nhiên trong [0, 1). Mặc định: Math.random. */
  random?: () => number;
}

export interface BackoffHandle {
  /** Khoảng chờ tiếp theo (ms, bao gồm jitter). Không tăng bậc. */
  nextDelayMs(): number;
  /** Số lần thử hiện tại (0-based). Tăng sau mỗi advance(). */
  attemptIndex(): number;
  /**
   * Ghi nhận thời điểm kết nối thành công.
   * Gọi sau khi nhận sự kiện `onopen`.
   */
  markConnected(): void;
  /**
   * Nếu đã ổn định ≥ STABLE_THRESHOLD_MS kể từ markConnected(), reset về bậc 0.
   * Thường được gọi qua setTimeout(30 000) sau markConnected().
   */
  resetIfStable(): void;
  /** Tăng bậc sau mỗi lần kết nối thất bại. */
  advance(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createBackoff(options?: BackoffOptions): BackoffHandle {
  const clock: BackoffClock = options?.clock ?? { now: () => Date.now() };
  const random: () => number = options?.random ?? Math.random;

  let attempt = 0;
  let connectedAt: number | null = null;

  return {
    nextDelayMs(): number {
      const maxIndex = BASE_DELAYS_MS.length - 1;
      const index = Math.min(attempt, maxIndex);
      const baseDelay: number = BASE_DELAYS_MS[index] ?? MAX_DELAY_MS;
      const jitter = Math.floor(random() * (JITTER_MAX_MS + 1));
      return baseDelay + jitter;
    },

    attemptIndex(): number {
      return attempt;
    },

    markConnected(): void {
      connectedAt = clock.now();
    },

    resetIfStable(): void {
      if (connectedAt !== null && clock.now() - connectedAt >= STABLE_THRESHOLD_MS) {
        attempt = 0;
        connectedAt = null;
      }
    },

    advance(): void {
      attempt += 1;
      connectedAt = null;
    },
  };
}
