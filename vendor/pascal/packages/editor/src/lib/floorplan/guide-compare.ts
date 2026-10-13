// Chế độ so sánh ảnh nguồn với hình học dựng (F-15 S7 #87–#89). Hàm thuần.

export type GuideCompareMode = 'overlay' | 'swipe' | 'sideBySide'

export const GUIDE_COMPARE_MODES: readonly GuideCompareMode[] = ['overlay', 'swipe', 'sideBySide']
export const SWIPE_DEFAULT_PERCENT = 50
export const SWIPE_KEY_STEP = 5

export function clampSwipePercent(value: number): number {
  if (!Number.isFinite(value)) return SWIPE_DEFAULT_PERCENT
  return Math.min(100, Math.max(0, value))
}

/** Phần ảnh hiện ra bên trái tay cầm: hình chữ nhật cắt theo % chiều rộng ảnh. */
export function getSwipeClipRect(planWidth: number, planHeight: number, percent: number) {
  const width = (planWidth * clampSwipePercent(percent)) / 100
  return { x: -planWidth / 2, y: -planHeight / 2, width, height: planHeight }
}

/** Hoành độ tay cầm trong toạ độ cục bộ của ảnh. */
export function getSwipeHandleX(planWidth: number, percent: number): number {
  return -planWidth / 2 + (planWidth * clampSwipePercent(percent)) / 100
}

/** Phím ←/→ dời tay cầm; trả null nếu phím không liên quan. */
export function nextSwipePercent(current: number, key: string): number | null {
  if (key === 'ArrowLeft') return clampSwipePercent(current - SWIPE_KEY_STEP)
  if (key === 'ArrowRight') return clampSwipePercent(current + SWIPE_KEY_STEP)
  if (key === 'Home') return 0
  if (key === 'End') return 100
  return null
}

/** Cạnh nhau: ảnh dời sang phải bằng một bề rộng cộng khe nhỏ. */
export function getSideBySideOffsetX(planWidth: number): number {
  return planWidth * 1.05
}
