/**
 * Bảy story của màn S-14 "Đọc kích thước OCR" — đúng bảy trạng thái của A11.
 *
 * ## Vì sao story dựng CONTAINER chứ không dựng view bằng props viết tay
 *
 * `DimensionOcrReview` là view thuần và nhận props ĐÃ TÍNH SẴN
 * (`DimensionRowViewModel`, `DimensionChainViewModel`, `DimensionCompareViewModel`…).
 * Viết tay bộ props đó cho bảy trạng thái nghĩa là dựng lại viewmodel bằng
 * tay — tức đoán trước kết quả của `useDimensionOcrReview`, đúng thứ R-61 cấm
 * ("không công thức tự chế") và đúng cách để story trôi khỏi màn thật sau lần
 * sửa hook đầu tiên.
 *
 * Nên bảy story cắm `createMockDimensionOcrReviewGateway()` vào container thật,
 * và nguyên liệu của mỗi cổng lấy thẳng từ `dimensionOcrReviewScenarios.ts` —
 * cùng bảy kịch bản mà `useDimensionOcrReview.test.ts` và
 * `DimensionOcrReview.test.tsx` dùng. Một bộ dữ liệu cho cả ba nơi, không phải
 * ba bảng sẽ lệch nhau (R-70).
 *
 * ## Bảy trạng thái ép bằng ĐẦU VÀO, không bằng một cờ `state`
 *
 * `deriveScreenState` dẫn xuất trạng thái từ dữ liệu chứ không nhận một cờ, nên
 * mỗi story ép đúng cái đầu vào sinh ra trạng thái đó:
 *
 * | story | ép bằng |
 * |---|---|
 * | `Rong` | đồ thị dựng từ `scenario.dimensions` rỗng |
 * | `DangTai` | cổng trả đồ thị `null` — lớp kích thước chưa về, kho còn trống |
 * | `MotPhan` | bộ mẫu nguyên bản — 18/34, chín chuỗi dưới ngưỡng tin cậy |
 * | `Loi` | `failReadDimensionLayer: true` (KHÔNG phải `failReadBackground`) |
 * | `ThanhCong` | bộ mẫu với cả 34 chuỗi `reviewed: true` |
 * | `KhongCoQuyen` | `roles: []` — vai không có quyền sửa lớp |
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
  DimensionOcrReviewContainer,
  type DimensionOcrReviewContainerProps,
} from './DimensionOcrReview.container';
import {
  buildDimensionOcrGraph,
  createMockDimensionOcrReviewGateway,
  DIMENSION_OCR_SAMPLE_LEVEL,
} from './dimensionOcrReviewGateway';
import { dimensionOcrScenarioFor } from './dimensionOcrReviewScenarios';

/** Bảy trạng thái, đúng thứ tự `SEVEN_STATES` — cho story và cho bài kiểm. */
export const SEVEN_STORY_STATES: readonly SevenState[] = SEVEN_STATES;

const PROJECT_ID = 'project-1';
const FLOOR_ID = DIMENSION_OCR_SAMPLE_LEVEL.id;

/**
 * Props container của một trạng thái. Bài kiểm dùng lại đúng hàm này (R-70).
 *
 * Nguyên liệu KHÔNG viết ở đây: nó là `scenario.dimensions` của
 * `dimensionOcrReviewScenarios.ts`, nên story và bài kiểm không thể lệch khỏi
 * bảy kịch bản mà hook đã được kiểm trên đó. `loading` là ngoại lệ duy nhất
 * không đi qua `buildDimensionOcrGraph`: nó cần cổng trả `null` để kho ở lại
 * rỗng và `isLoading` của hook giữ nguyên — một đồ thị rỗng cho ra `empty`, một
 * trạng thái khác hẳn.
 */
export function scenarioArgsFor(state: SevenState): DimensionOcrReviewContainerProps {
  const scenario = dimensionOcrScenarioFor(state);

  return {
    floorId: FLOOR_ID,
    projectId: PROJECT_ID,
    roles: scenario.isViewerRole ? [] : ['engineer'],
    gateway: createMockDimensionOcrReviewGateway({
      graph: state === 'loading' ? null : buildDimensionOcrGraph(scenario.dimensions),
      ...(state === 'error' ? { failReadDimensionLayer: true } : {}),
      ...(scenario.backgroundImageUrl === null ? { withoutImage: true } : {}),
    }),
    ...(scenario.isCollapsed ? { forceCollapsed: true } : {}),
  };
}

const meta = {
  title: 'Screens/QC/DimensionOcrReview',
  component: DimensionOcrReviewContainer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    /* Vỏ route: `DimensionOcrReviewRoute` không dựng ở đây, nhưng container vẫn
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
} satisfies Meta<typeof DimensionOcrReviewContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — OCR không đọc được chuỗi nào, kèm liên kết sang hiệu chỉnh tỷ lệ. */
export const Rong: Story = { args: scenarioArgsFor('empty') };

/** 2. Đang tải — nửa phải là khung xương, canvas là nền chờ. */
export const DangTai: Story = { args: scenarioArgsFor('loading') };

/** 3. Một phần — TRẠNG THÁI CHÍNH của màn, 18/34 đã duyệt. */
export const MotPhan: Story = { args: scenarioArgsFor('partial') };

/** 4. Lỗi — lớp kích thước hỏng; canvas VẪN xem được ảnh gốc. */
export const Loi: Story = { args: scenarioArgsFor('error') };

/** 5. Xong — 34/34 chuỗi kích thước đã duyệt. */
export const ThanhCong: Story = { args: scenarioArgsFor('success') };

/** 6. Không có quyền — vai Người xem: canvas chỉ xem, danh sách ẩn nút sửa/duyệt. */
export const KhongCoQuyen: Story = { args: scenarioArgsFor('forbidden') };

/** 7. Thu gọn — danh sách và dải đối chiếu ẩn, canvas chiếm cả khung. */
export const ThuGon: Story = { args: scenarioArgsFor('collapsed') };
