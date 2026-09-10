/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63) — `MobileViewer`.
 *
 * Story dựng thẳng {@link MobileViewer} — không container, không hook, không
 * một lời gọi mạng nào. Cùng khuôn `ExplodedView.stories.tsx`.
 *
 * Dữ liệu của cả bảy story lấy nguyên từ `mobileViewerScenarioFor`
 * (`mobileViewerScenarios.ts`, đóng băng cùng `mobileViewerTypes.ts`) — không
 * bịa một bộ props thứ hai tại chỗ (R-70). `MobileViewer.test.tsx` dùng lại
 * đúng hàm này.
 *
 * Khung nhìn di động (390 và 320) đặt qua tham số `viewport` của addon
 * Storybook viewport — 390 cho sáu trạng thái đầu, 320 cho `ThuGon` (trạng
 * thái `collapsed`, đúng ngưỡng `MOBILE_VIEWER_COMPACT_WIDTH_PX`).
 *
 * Không export nào ở đây ngoài bảy story và `default`, nên KHÔNG cần
 * `meta.excludeStories` — bẫy "một export không phải story làm trắng cả
 * file" không áp dụng: `mobileViewerScenarioFor` sống ở file dữ liệu, không ở
 * file này.
 *
 * `MobileViewer` chưa tồn tại trong worktree này (T7 đang viết song song);
 * Storybook build của file này sẽ đỏ cho tới khi lớp gộp nối lại — kết quả
 * ĐÚNG của lượt này, không phải lỗi ở đây.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { MobileViewer } from './MobileViewer';
import { mobileViewerScenarioFor } from './mobileViewerScenarios';

/**
 * Hai khung nhìn của riêng màn này. `.storybook/preview.ts` chỉ khai bốn
 * khung desktop, không có khung di động nào sẵn — nên khai cả hai ở đây thay
 * vì trỏ tới một khoá không tồn tại trong bộ toàn cục.
 */
const MOBILE_VIEWPORTS = {
  mobile390: { name: '390 — điện thoại cỡ vừa', styles: { width: '390px', height: '780px' }, type: 'mobile' },
  mobile320: { name: '320 — thu gọn', styles: { width: '320px', height: '640px' }, type: 'mobile' },
} as const;

/** Khung nhìn 390px — điện thoại cỡ vừa, bố cục đầy đủ bốn công cụ. */
const VIEWPORT_390 = {
  viewport: { viewports: MOBILE_VIEWPORTS, defaultViewport: 'mobile390' },
} as const;

/** Khung nhìn 320px — dưới `MOBILE_VIEWER_COMPACT_WIDTH_PX`, thanh dưới gộp còn ba. */
const VIEWPORT_320 = {
  viewport: { viewports: MOBILE_VIEWPORTS, defaultViewport: 'mobile320' },
} as const;

const meta = {
  title: 'Màn hình/Xem trên điện thoại',
  component: MobileViewer,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MobileViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rong: Story = { args: mobileViewerScenarioFor('empty'), parameters: VIEWPORT_390 };

export const DangTai: Story = { args: mobileViewerScenarioFor('loading'), parameters: VIEWPORT_390 };

export const MotPhan: Story = { args: mobileViewerScenarioFor('partial'), parameters: VIEWPORT_390 };

export const Loi: Story = { args: mobileViewerScenarioFor('error'), parameters: VIEWPORT_390 };

export const ThanhCong: Story = { args: mobileViewerScenarioFor('success'), parameters: VIEWPORT_390 };

export const KhongCoQuyen: Story = { args: mobileViewerScenarioFor('forbidden'), parameters: VIEWPORT_390 };

export const ThuGon: Story = { args: mobileViewerScenarioFor('collapsed'), parameters: VIEWPORT_320 };
