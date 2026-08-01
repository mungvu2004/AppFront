// Hằng animation chuẩn — chỉ 5 mốc thời lượng theo AGENTS.md
// 120 / 180 / 260 / 340 / 700 ms

export const DURATION = {
  fast:    0.12,   // 120 ms — micro-interaction
  quick:   0.18,   // 180 ms — đóng overlay
  default: 0.26,   // 260 ms — mở overlay, panel toggle
  slow:    0.34,   // 340 ms — drawer slide
  expand:  0.70,   // 700 ms — progress, skeleton
} as const;

export const EASE = {
  /** Easing chính theo design system — panel mở/đóng */
  default: [0.32, 0.72, 0, 1] as [number, number, number, number],
  /** Ease out chuẩn */
  out: [0, 0, 0.58, 1] as [number, number, number, number],
  /** Ease in-out chuẩn */
  inOut: [0.42, 0, 0.58, 1] as [number, number, number, number],
} as const;

export const SPRING = {
  /** Bottom-sheet snap */
  sheet: { type: 'spring' as const, damping: 28, stiffness: 220 },
} as const;
