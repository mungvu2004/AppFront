// P13 helpers for phase10_dev_d_edge.spec.ts (FeedbackDemo, src/screens/FeedbackDemo.tsx). Own copy; no other pack's helper is imported.
import type { Locator, Page } from '@playwright/test';

export const FEEDBACK_URL = '/feedback-demo';
export const STATES = ['Empty', 'Loading', 'Partial', 'Error', 'Success', 'Unprivileged', 'Collapsed'] as const;
export const STEP_NAMES = [
  'Tiền xử lý ảnh',
  'Nhận diện tường (SegFormer)',
  'Nhận diện cửa và nội thất (YOLOv8)',
  'Đọc kích thước (PaddleOCR)',
  'Chuẩn hoá độ dày tường',
  'Dựng Spatial JSON',
] as const;

/** Toast region (Toast.tsx ToastViewport: role=region, aria-label "Thông báo"). */
export const toastRegion = (page: Page): Locator => page.getByRole('region', { name: 'Thông báo' });
/** Toasts (Toast.tsx ToastItem role=status), optionally those containing `text`. */
export const toasts = (page: Page, text?: string): Locator => {
  const all = toastRegion(page).getByRole('status');
  return text === undefined ? all : all.filter({ hasText: text });
};
export const stateButton = (page: Page, s: string): Locator => page.getByRole('button', { name: s, exact: true });

/** Open the demo and wait for its landmark (FeedbackDemo has no heading; the first trigger button is the landmark). */
export async function openFeedback(page: Page): Promise<void> {
  await page.goto(FEEDBACK_URL);
  await page.getByRole('button', { name: 'Test Undo Toast', exact: true }).waitFor();
}

/** Countdown bar width in % (Toast.tsx: `div[aria-hidden] > div` with inline width). */
export const barWidth = (toast: Locator): Promise<number> =>
  toast.locator('div[aria-hidden="true"] > div').evaluate((el) => parseFloat((el as HTMLElement).style.width));

/** Wait `n` animation frames inside the page (no timer). */
export const frames = (page: Page, n: number): Promise<void> =>
  page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
