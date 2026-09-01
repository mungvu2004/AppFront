/**
 * Bảy story của màn S-13 "Lớp đối tượng" — đúng bảy trạng thái của A11.
 *
 * ## Vì sao story dựng CONTAINER chứ không dựng view bằng props viết tay
 *
 * `ObjectLayerReview` là view thuần và nhận props đã tính sẵn
 * (`ObjectPlacementViewModel`, `ObjectListRowViewModel`, `ObjectInspectorViewModel`…).
 * Viết tay bộ props đó cho bảy trạng thái nghĩa là dựng lại viewmodel bằng
 * tay — tức đoán trước kết quả của `useObjectLayerReview`, đúng thứ R-61 cấm
 * ("không công thức tự chế") và đúng cách để story trôi khỏi màn thật sau lần
 * sửa hook đầu tiên.
 *
 * Nên bảy story cắm `createMockObjectLayerReviewGateway()` vào container thật,
 * và hạt giống của mỗi cổng lấy thẳng từ `objectLayerReviewScenarios.ts` —
 * cùng bảy kịch bản mà `useObjectLayerReview.test.ts` và
 * `ObjectLayerReview.test.tsx` dùng. Một bộ dữ liệu cho cả ba nơi, không phải
 * ba bảng sẽ lệch nhau (R-70).
 *
 * ## Bảy trạng thái ép bằng ĐẦU VÀO, không bằng một cờ `state`
 *
 * `deriveScreenState` dẫn xuất trạng thái từ dữ liệu chứ không nhận một cờ, nên
 * mỗi story ép đúng cái đầu vào sinh ra trạng thái đó:
 *
 * | story | ép bằng |
 * |---|---|
 * | `Rong` | đồ thị có tường nhưng không đối tượng nào |
 * | `DangTai` | cổng trả đồ thị `null` — lớp đối tượng chưa về, ảnh nền cũng chưa |
 * | `MotPhan` | bộ mẫu nguyên bản — 9/21, 5 mục dưới ngưỡng |
 * | `Loi` | `failReadObjectLayer: true` (KHÔNG phải `failReadBackground`) |
 * | `ThanhCong` | bộ mẫu với cả 21 đối tượng `reviewed: true` |
 * | `KhongCoQuyen` | `roles: ['viewer']` |
 * | `ThuGon` | `forceCollapsed: true` |
 *
 * ## BẪY ĐÃ BIẾT — `meta.excludeStories`
 *
 * Một export KHÔNG PHẢI story trong file stories làm TRẮNG toàn bộ file
 * (`docs/contracts/ui.md` mục H). {@link scenarioArgsFor} và
 * {@link SEVEN_STORY_STATES} là dữ liệu để bài kiểm dùng lại (R-70), không phải
 * story, nên cả hai PHẢI có tên trong `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';

import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  ObjectLayerReviewContainer,
  type ObjectLayerReviewContainerProps,
} from './ObjectLayerReview.container';
import {
  createMockObjectLayerReviewGateway,
  OBJECT_LAYER_SAMPLE_LEVEL,
} from './objectLayerReviewGateway';
import { objectLayerScenarioFor } from './objectLayerReviewScenarios';

/** Bảy trạng thái, đúng thứ tự `SEVEN_STATES` — cho story và cho bài kiểm. */
export const SEVEN_STORY_STATES: readonly SevenState[] = SEVEN_STATES;

const PROJECT_ID = 'project-1';
const FLOOR_ID = OBJECT_LAYER_SAMPLE_LEVEL.id;

/**
 * Props container của một trạng thái. Bài kiểm dùng lại đúng hàm này (R-70).
 *
 * Hạt giống cổng KHÔNG viết ở đây: nó là `scenario.gatewaySeed` của
 * `objectLayerReviewScenarios.ts`, nên story và bài kiểm không thể lệch khỏi
 * bảy kịch bản mà hook đã được kiểm trên đó.
 */
export function scenarioArgsFor(state: SevenState): ObjectLayerReviewContainerProps {
  const scenario = objectLayerScenarioFor(state);

  return {
    floorId: FLOOR_ID,
    projectId: PROJECT_ID,
    roles: scenario.roles,
    gateway: createMockObjectLayerReviewGateway(scenario.gatewaySeed),
    ...(scenario.isCollapsed ? { forceCollapsed: true } : {}),
  };
}

const meta = {
  title: 'Screens/QC/ObjectLayerReview',
  component: ObjectLayerReviewContainer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    /* Vỏ route: `ObjectLayerReviewRoute` không dựng ở đây, nhưng container vẫn
     * nằm trong cây có router để mọi liên kết con tìm được provider. */
    (Story) => (
      <MemoryRouter>
        <div className="h-screen w-screen">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  excludeStories: ['scenarioArgsFor', 'SEVEN_STORY_STATES'],
} satisfies Meta<typeof ObjectLayerReviewContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — AI không nhận ra đối tượng nào, kèm nút thêm thủ công. */
export const Rong: Story = { args: scenarioArgsFor('empty') };

/** 2. Đang tải — panel trái là khung xương, canvas là nền chờ. */
export const DangTai: Story = { args: scenarioArgsFor('loading') };

/** 3. Một phần — TRẠNG THÁI CHÍNH của màn, 9/21 đã duyệt. */
export const MotPhan: Story = { args: scenarioArgsFor('partial') };

/** 4. Lỗi — lớp đối tượng hỏng; canvas VẪN xem được ảnh nền. */
export const Loi: Story = { args: scenarioArgsFor('error') };

/** 5. Xong — 21/21 đối tượng đã duyệt. */
export const ThanhCong: Story = { args: scenarioArgsFor('success') };

/** 6. Không có quyền — vai Người xem: ray ẩn công cụ sửa, canvas chỉ xem. */
export const KhongCoQuyen: Story = { args: scenarioArgsFor('forbidden') };

/** 7. Thu gọn — hai panel ẩn, ray công cụ nổi trên canvas. */
export const ThuGon: Story = { args: scenarioArgsFor('collapsed') };
