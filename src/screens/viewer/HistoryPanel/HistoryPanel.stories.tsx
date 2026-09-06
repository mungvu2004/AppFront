/**
 * Bảy story của S-34 "HistoryPanel" — một cho mỗi trạng thái của A11 — cộng
 * một story `layout: 'sheet'` (panel dưới 1024, xem `HistoryPanelLayout`).
 *
 * `HistoryPanel.container.tsx` chưa tồn tại (hai worker khác đang viết nó song
 * song), nên story dựng thẳng VIEW THUẦN `HistoryPanel` từ props tĩnh — không
 * dựng qua container/`forceState`. Dữ liệu đến từ `historyPanelScenarios.ts`,
 * cùng nguồn với `HistoryPanel.test.tsx` (R-70): một story xanh và một bài
 * kiểm xanh phải nhìn cùng một dữ liệu, nếu không thì không cái nào chứng minh
 * được gì về nhau.
 *
 * ## BẪY CSF
 *
 * Một export KHÔNG-PHẢI-STORY trong file CSF làm Storybook nhận nhầm nó là
 * story và bỏ TRẮNG cả file. File này không có export nào ngoài `default` và
 * các `Story`, nên không cần `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { createHistoryPanelScenarios, type HistoryPanelScenario } from './historyPanelScenarios';
import { HistoryPanel } from './HistoryPanel';
import type { HistoryPanelLayout } from './historyPanelTypes';

const SCENARIOS: readonly HistoryPanelScenario[] = createHistoryPanelScenarios();

function scenarioProps(state: HistoryPanelScenario['state']): HistoryPanelScenario['props'] {
  const found = SCENARIOS.find((scenario) => scenario.state === state);

  if (found === undefined) {
    throw new Error(`Không có kịch bản cho trạng thái "${state}".`);
  }

  return found.props;
}

/** Khung nền của story — bề rộng 344 của panel, cao cố định để thấy hết dòng thời gian. */
const FRAME_CLASS = 'h-[720px] w-[344px] bg-bg-app';

const meta = {
  component: HistoryPanel,
  decorators: [
    (Story): JSX.Element => (
      <div className={FRAME_CLASS}>
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'centered' },
  title: 'Screens/Viewer/HistoryPanel',
} satisfies Meta<typeof HistoryPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — chưa có bước nào để hiện. */
export const Rong: Story = { args: scenarioProps('empty') };

/** 2. Đang tải — khung xương của dòng thời gian. */
export const DangTai: Story = { args: scenarioProps('loading') };

/** 3. Một phần — đã chạm trần 100 bước; bước cũ nhất sắp rơi khỏi đáy. */
export const MotPhan: Story = { args: scenarioProps('partial') };

/** 4. Lỗi — không tải được lịch sử; nút "Thử lại" gọi lại chính nó. */
export const Loi: Story = { args: scenarioProps('error') };

/** 5. Thành công — đủ mục đơn, mục theo lô, mục có diff, và mục đã hoàn tác. */
export const ThanhCong: Story = { args: scenarioProps('success') };

/** 6. Không có quyền — xem được nhưng không nhảy trạng thái; người khác ẩn danh. */
export const KhongCoQuyen: Story = { args: scenarioProps('forbidden') };

/** 7. Thu gọn. */
export const ThuGon: Story = { args: scenarioProps('collapsed') };

const SHEET_LAYOUT: HistoryPanelLayout = 'sheet';

/** 8. Tấm trượt đáy dưới 1024 — cùng dữ liệu "thành công", khác `layout`. */
export const TamTruotDay: Story = {
  args: { ...scenarioProps('success'), layout: SHEET_LAYOUT },
};
