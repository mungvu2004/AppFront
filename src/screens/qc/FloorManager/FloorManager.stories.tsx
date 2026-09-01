/**
 * Story của màn S-16 "Quản lý tầng" — bảy trạng thái của A11, cộng một story
 * thứ tám cho hai khoản nợ của cổng.
 *
 * Cả tám dựng VIEW THUẦN từ `floorManagerScenarioFor(state)` — cùng bộ dữ liệu
 * mà `FloorManager.test.tsx` dùng (R-70, đúng khuôn
 * `AxisGridManager.stories.tsx`). Story thứ tám ({@link GioiHanCuaPhien}) vẫn
 * là trạng thái "một phần", chỉ ghi đè `unsupportedNotices` để hai câu nợ có
 * chỗ nhìn thấy được.
 *
 * ## BẪY ĐÃ BIẾT — `meta.excludeStories`
 *
 * Một export KHÔNG PHẢI story trong file stories làm TRẮNG toàn bộ file.
 * {@link scenarioArgsFor} và {@link SEVEN_STORY_STATES} là dữ liệu để bài kiểm
 * dùng lại, không phải story, nên cả hai PHẢI có tên trong `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { FloorManager } from './FloorManager';
import {
  FLOOR_MANAGER_FIXTURE_UNSUPPORTED_NOTICES,
  floorManagerScenarioFor,
} from './floorManagerFixture';
import type { FloorManagerViewProps } from './floorManagerTypes';

/** Bảy trạng thái, đúng thứ tự `SEVEN_STATES` — cho story và cho bài kiểm. */
export const SEVEN_STORY_STATES: readonly SevenState[] = SEVEN_STATES;

/**
 * Mười lăm hàm xử lý của hợp đồng props, ở dạng không làm gì.
 *
 * Story dựng VIEW THUẦN nên không có hook nào phía sau để nhận lượt bấm; bản
 * thật của mười lăm hàm này sống ở `useFloorManager` và được
 * `FloorManager.container.tsx` (T7) nối vào.
 */
const IDLE_HANDLERS = {
  onSelectFloor: () => undefined,
  onHoverFloor: () => undefined,
  onFloorFieldChange: () => undefined,
  onFloorFieldCommit: () => undefined,
  onFloorFieldCancel: () => undefined,
  onReorderFloors: () => undefined,
  onAddFloor: () => undefined,
  onDuplicateFloor: () => undefined,
  onToggleHiddenIn3d: () => undefined,
  onRemoveFloor: () => undefined,
  onToggleAutoElevation: () => undefined,
  onUploadDrawing: () => undefined,
  onToggleCollapsed: () => undefined,
  onRetry: () => undefined,
  onUndo: () => undefined,
} as const;

/**
 * Props view của một trạng thái. Bài kiểm dùng lại đúng hàm này (R-70).
 */
export function scenarioArgsFor(state: SevenState): FloorManagerViewProps {
  return {
    ...IDLE_HANDLERS,
    ...floorManagerScenarioFor(state),
  };
}

const meta = {
  title: 'Screens/QC/FloorManager',
  component: FloorManager,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-screen w-screen">
        <Story />
      </div>
    ),
  ],
  excludeStories: ['scenarioArgsFor', 'SEVEN_STORY_STATES'],
} satisfies Meta<typeof FloorManager>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — chưa có tầng nào, kèm nút mời thêm tầng đầu tiên. */
export const Rong: Story = { args: scenarioArgsFor('empty') };

/** 2. Đang tải — bảng là khung xương, lát cắt là một khối skeleton duy nhất. */
export const DangTai: Story = { args: scenarioArgsFor('loading') };

/** 3. Một phần — tầng mái chưa có bản vẽ, dải của nó vẫn đúng tỷ lệ. */
export const MotPhan: Story = { args: scenarioArgsFor('partial') };

/** 4. Lỗi — không đọc được danh sách tầng; lát cắt vẫn giữ khung. */
export const Loi: Story = { args: scenarioArgsFor('error') };

/** 5. Xong — bốn tầng đủ bản vẽ, tổng tỷ lệ dải bằng 1. */
export const ThanhCong: Story = { args: scenarioArgsFor('success') };

/** 6. Không có quyền — vai Người xem: bảng chỉ đọc, mọi hành động sửa bị ẩn. */
export const KhongCoQuyen: Story = { args: scenarioArgsFor('forbidden') };

/** 7. Thu gọn — cột lát cắt ẩn hẳn, còn nút bung lại. */
export const ThuGon: Story = { args: scenarioArgsFor('collapsed') };

/**
 * 8. Khoản nợ của cổng — hai khả năng chưa có chỗ lưu, và màn NÓI RA cả hai.
 *
 * Không phải trạng thái thứ tám của A11: đây vẫn là "một phần", chỉ khác ở chỗ
 * cổng khai `persistFloorContents` và `hideFloorFrom3d` là chưa làm được. Câu
 * chữ lấy nguyên từ bảng của `floorManagerGateway.ts`, đúng bộ mà
 * `useFloorManager` đọc lên khi chạy thật.
 */
export const GioiHanCuaPhien: Story = {
  args: {
    ...scenarioArgsFor('partial'),
    unsupportedNotices: FLOOR_MANAGER_FIXTURE_UNSUPPORTED_NOTICES,
  },
};
