/**
 * Bảy story của panel thanh tra đối tượng — một story cho mỗi trạng thái của
 * A11 (R-63).
 *
 * Story dựng THẲNG TỪ PROPS: `PropertyInspector` là view thuần, hợp đồng của nó
 * (`propertyInspectorTypes.ts`) chỉ có `state` cộng một tín hiệu nháy nền, nên
 * không có provider, không store và không cổng nào ở đây. Nguyên liệu của bảy
 * kịch bản nằm ở `propertyInspectorScenarios.ts`, dùng chung với
 * `PropertyInspector.test.tsx` — hai nơi kể một câu chuyện thì chúng phải kể từ
 * cùng một dữ liệu (R-70).
 *
 * BẪY ĐÃ TRÁNH: một export KHÔNG-PHẢI-STORY trong file CSF làm Storybook coi nó
 * là story và bỏ trắng cả file. `meta.excludeStories` liệt kê đúng những export
 * như vậy — ở đây là hằng số `PANEL_FRAME_CLASS` và hàm `argsFor`.
 *
 * `addon-a11y` soát từng story; `PropertyInspector.test.tsx` chạy
 * `expectAccessible` trên đúng bảy kịch bản này.
 */

import type { Meta, StoryObj } from '@storybook/react';

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { PropertyInspector } from './PropertyInspector';
import { PROPERTY_INSPECTOR_SCENARIOS } from './propertyInspectorScenarios';
import type { PropertyInspectorProps } from './propertyInspectorTypes';

/**
 * Khung nền của story — nền chìm để thấy được panel KHÔNG có viền bao ngoài
 * (CẤM TUYỆT ĐỐI: panel không viền), và đủ chỗ cho tấm trượt của `collapsed`.
 */
export const PANEL_FRAME_CLASS = 'flex min-h-[720px] items-start bg-bg-sunken p-6';

/** Props của một trạng thái, dùng chung giữa story và bài kiểm (R-70). */
export function argsFor(state: SevenState): PropertyInspectorProps {
  return { state: PROPERTY_INSPECTOR_SCENARIOS[state] };
}

const meta = {
  title: 'Screens/Viewer/PropertyInspector',
  component: PropertyInspector,
  parameters: { layout: 'fullscreen' },
  /* Hai export dưới đây là dữ liệu và hàm dùng chung, không phải story: thiếu
     dòng này thì Storybook nhận nhầm chúng là story và cả file ra trắng. */
  excludeStories: ['PANEL_FRAME_CLASS', 'argsFor'],
  decorators: [
    (Story): JSX.Element => (
      <div className={PANEL_FRAME_CLASS}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PropertyInspector>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — chưa chọn gì: biểu tượng nét 32, một câu đầy, gợi ý phím Tab. */
export const Rong: Story = { args: argsFor('empty') };

/** 2. Đang tải — năm dòng khung xương cao 36px, không chữ nào. */
export const DangTai: Story = { args: argsFor('loading') };

/** 3. Một phần — ba bức tường: độ dày hiện DẤU GẠCH NGANG, không phải 220. */
export const MotPhan: Story = { args: argsFor('partial') };

/** 4. Lỗi — lượt ghi độ dày bị từ chối; lý do và nút thử lại nằm NGAY TẠI DÒNG. */
export const Loi: Story = { args: argsFor('error') };

/** 5. Xong — một bức tường của bộ mẫu chuẩn A14, đủ trường, không cảnh báo chặn. */
export const Xong: Story = { args: argsFor('success') };

/** 6. Không có quyền — mọi dòng chỉ đọc, không viền, vẫn sao chép được. */
export const KhongCoQuyen: Story = { args: argsFor('forbidden') };

/** 7. Thu gọn — thẻ phụ mang nhãn tóm tắt, bấm vào là mở lại panel. */
export const ThuGon: Story = { args: argsFor('collapsed') };
