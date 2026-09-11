/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63) — `StateGallery`
 * (`/design-system/states`, S-47).
 *
 * Story dựng thẳng {@link StateGallery} — không container, không hook, không
 * một lời gọi mạng nào. Cùng khuôn `MobileViewer.stories.tsx`.
 *
 * Dữ liệu của cả bảy story lấy nguyên từ `stateGalleryScenarioFor`
 * (`stateGalleryScenarios.ts`, đóng băng cùng `stateGalleryTypes.ts`) — không
 * bịa một bộ props thứ hai tại chỗ (R-70). `StateGallery.test.tsx` dùng lại
 * đúng hàm này.
 *
 * Tên bảy export dưới đây (`Rong`, `DangTai`, …) khớp đúng
 * `storyExportNames` mà chính manifest của trang này khai cho mục
 * `system/StateGallery` — vòng lặp trang tự khảo sát chính nó.
 *
 * Không export nào ở đây ngoài bảy story và `default`, nên KHÔNG cần
 * `meta.excludeStories` — bẫy "một export không phải story làm trắng cả
 * file" không áp dụng.
 *
 * `StateGallery.tsx`, `stateGalleryManifest.ts`, `stateGalleryScenarios.ts`
 * CHƯA tồn tại trong worktree này — worker khác đang viết song song, cùng
 * hợp đồng `stateGalleryTypes.ts`. File này vì vậy ĐỎ (tsc/Storybook) cho tới
 * khi lớp gộp nối hai nhánh lại — kết quả ĐÚNG của lượt này, không phải lỗi
 * ở đây.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { StateGallery } from './StateGallery';
import { stateGalleryScenarioFor } from './stateGalleryScenarios';

const meta = {
  title: 'Màn hình/Duyệt bảy trạng thái',
  component: StateGallery,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof StateGallery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rong: Story = { args: stateGalleryScenarioFor('empty') };

export const DangTai: Story = { args: stateGalleryScenarioFor('loading') };

export const MotPhan: Story = { args: stateGalleryScenarioFor('partial') };

export const Loi: Story = { args: stateGalleryScenarioFor('error') };

export const Xong: Story = { args: stateGalleryScenarioFor('success') };

export const KhongCoQuyen: Story = { args: stateGalleryScenarioFor('forbidden') };

export const ThuGon: Story = { args: stateGalleryScenarioFor('collapsed') };
