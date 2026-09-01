/**
 * Bảy story của màn S-15 "Trục và gốc toạ độ" — đúng bảy trạng thái của A11.
 *
 * ## Vì sao story dựng VIEW THUẦN, không dựng container
 *
 * Ba màn QC anh em cắm cổng giả vào container, vì kịch bản của chúng mang
 * NGUYÊN LIỆU đồ thị và trạng thái màn được `deriveScreenState` suy ra từ dữ
 * liệu. Kịch bản của màn này có hình dạng khác: đặc tả riêng của T3 đòi "mỗi
 * kịch bản trả về `AxisGridViewModel` hoàn chỉnh", nên
 * `axisGridManagerScenarios.ts` đã là bảy view-model dựng sẵn — và chúng không
 * tự chế con số nào, mọi trục đi qua `detectAxes()`/`labelAxes()` và mọi độ
 * lệch đi qua `alignFloors()` trong `axisGridFixture.ts` (R-61).
 *
 * Cho bảy view-model ấy vào view thuần là đường NGẮN NHẤT tới đúng bảy trạng
 * thái, và là cùng một bộ dữ liệu mà `AxisGridManager.test.tsx` dùng — một bộ
 * cho cả hai nơi, không phải hai bảng sẽ lệch nhau (R-70).
 *
 * ## BẪY ĐÃ BIẾT — `meta.excludeStories`
 *
 * Một export KHÔNG PHẢI story trong file stories làm TRẮNG toàn bộ file
 * (`docs/contracts/ui.md` mục H). {@link scenarioArgsFor} và
 * {@link SEVEN_STORY_STATES} là dữ liệu để bài kiểm dùng lại (R-70), không phải
 * story, nên cả hai PHẢI có tên trong `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { AxisGridManager, type AxisGridManagerViewProps } from './AxisGridManager';
import { axisGridScenarioFor } from './axisGridManagerScenarios';

/** Bảy trạng thái, đúng thứ tự `SEVEN_STATES` — cho story và cho bài kiểm. */
export const SEVEN_STORY_STATES: readonly SevenState[] = SEVEN_STATES;

/**
 * Mười ba hàm xử lý của hợp đồng props, ở dạng không làm gì.
 *
 * Story dựng VIEW THUẦN nên không có hook nào phía sau để nhận lượt bấm; đây là
 * đúng cái mà "view test được chỉ từ props" (mục D) nghĩa là. Bản thật của mười
 * ba hàm này sống ở `useAxisGridManager` và được `AxisGridManager.container.tsx`
 * nối vào — story không dựng lại một hàm nào trong số đó.
 */
const IDLE_HANDLERS = {
  onAxisToggleVisibility: () => undefined,
  onAxisSelect: () => undefined,
  onAxisAdd: () => undefined,
  onAxisDrag: () => undefined,
  onAxisRemove: () => undefined,
  onViewOnDrawing: () => undefined,
  onAnchorChange: () => undefined,
  onGhostToggle: () => undefined,
  onAutoAlign: () => undefined,
  onFloorRowHover: () => undefined,
  onViewFloorOnDrawing: () => undefined,
  onUndo: () => undefined,
  onRetry: () => undefined,
  onToggleCollapsed: () => undefined,
} as const;

/**
 * Props view của một trạng thái. Bài kiểm dùng lại đúng hàm này (R-70).
 *
 * View-model KHÔNG viết ở đây: nó là `axisGridScenarioFor(state)` của
 * `axisGridManagerScenarios.ts`, nên story và bài kiểm không thể lệch khỏi bảy
 * kịch bản mà hook đã được kiểm trên đó.
 */
export function scenarioArgsFor(state: SevenState): AxisGridManagerViewProps {
  return {
    ...IDLE_HANDLERS,
    viewModel: axisGridScenarioFor(state),
    spacingMessage: null,
  };
}

const meta = {
  title: 'Screens/QC/AxisGridManager',
  component: AxisGridManager,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-screen w-screen">
        <Story />
      </div>
    ),
  ],
  excludeStories: ['scenarioArgsFor', 'SEVEN_STORY_STATES'],
} satisfies Meta<typeof AxisGridManager>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — chưa dò ra trục nào, kèm câu mời vẽ thủ công hoặc suy ra từ tường bao. */
export const Rong: Story = { args: scenarioArgsFor('empty') };

/** 2. Đang tải — cột trái là khung xương, canvas vẫn giữ khung của nó. */
export const DangTai: Story = { args: scenarioArgsFor('loading') };

/** 3. Một phần — mới có trục dọc, chưa có trục ngang. */
export const MotPhan: Story = { args: scenarioArgsFor('partial') };

/** 4. Lỗi — lớp dữ liệu trục hỏng; canvas VẪN xem được. */
export const Loi: Story = { args: scenarioArgsFor('error') };

/** 5. Xong — đủ hai chiều trục, mọi tầng trong dung sai. */
export const ThanhCong: Story = { args: scenarioArgsFor('success') };

/** 6. Không có quyền — vai Người xem: canvas chỉ xem, cột trái nói rõ vì sao. */
export const KhongCoQuyen: Story = { args: scenarioArgsFor('forbidden') };

/** 7. Thu gọn — hai cột ẩn, canvas chiếm cả khung, còn nút bung lại. */
export const ThuGon: Story = { args: scenarioArgsFor('collapsed') };
