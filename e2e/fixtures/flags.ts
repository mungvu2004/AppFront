/**
 * Bật cờ tính năng TRƯỚC KHI trang chạy dòng mã nào.
 *
 * `useFeatureFlag` đọc `localStorage` ngay ở lượt vẽ đầu (`lib/telemetry/flags.ts:672-679`),
 * nên đặt cờ sau `page.goto` là muộn. `addInitScript` chạy trước mọi script của
 * trang, kể cả ở các lượt điều hướng sau trong cùng `page`. Gọi trước `goto`.
 *
 * Chép từ `e2e/pascal-viewer.spec.ts:121-131`. Cờ này bật một tính năng, không né
 * một lớp UI — thứ đó (tour) cấm tắt bằng khoá, xem `tour.ts`.
 */
import type { Page } from '@playwright/test';

/** Khoá `localStorage` giữ cờ — `FEATURE_FLAG_STORAGE_KEY`, `lib/telemetry/flags.ts:487`. */
export const FEATURE_FLAG_STORAGE_KEY = 'appfront-feature-flags';

export async function enableFlags(page: Page, flagKeys: readonly string[]): Promise<void> {
  await page.addInitScript(
    ({ storageKey, keys }) => {
      const overrides = Object.fromEntries(keys.map((key) => [key, true]));
      window.localStorage.setItem(storageKey, JSON.stringify(overrides));
    },
    { storageKey: FEATURE_FLAG_STORAGE_KEY, keys: flagKeys },
  );
}
