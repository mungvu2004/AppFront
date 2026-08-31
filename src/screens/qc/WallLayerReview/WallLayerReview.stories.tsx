/**
 * Bảy story của màn S-12 "Duyệt lớp tường" — đúng bảy trạng thái của A11.
 *
 * ## Vì sao story dựng CONTAINER chứ không dựng view bằng props viết tay
 *
 * `WallLayerReview` là view thuần và nhận props đã tính sẵn
 * (`WallLayerViewProps`, `WallLayerCanvasViewProps`…). Viết tay bộ props đó cho
 * bảy trạng thái nghĩa là dựng lại viewmodel bằng tay — tức đoán trước kết quả
 * của `useWallLayerReview`, đúng thứ R-61 cấm ("không công thức tự chế") và
 * đúng cách để story trôi khỏi màn thật sau lần sửa hook đầu tiên.
 *
 * Nên bảy story cắm `createMockWallLayerReviewGateway()` vào container thật.
 * Cùng cổng giả mà `useWallLayerReview.test.ts` và `WallLayerReview.test.tsx`
 * dùng, và cùng bộ mẫu 48 tường / 12 đã duyệt của `wallLayerReviewFixture.ts` —
 * một bộ dữ liệu cho cả ba nơi, không phải ba bảng sẽ lệch nhau (R-70).
 *
 * ## Bảy trạng thái ép bằng ĐẦU VÀO, không bằng một cờ `state`
 *
 * `deriveScreenState` dẫn xuất trạng thái từ dữ liệu chứ không nhận một cờ, nên
 * mỗi story ép đúng cái đầu vào sinh ra trạng thái đó:
 *
 * | story | ép bằng |
 * |---|---|
 * | `Rong` | đồ thị không có tường nào |
 * | `DangTai` | cổng có `readBackground` không bao giờ trả lời |
 * | `MotPhan` | bộ mẫu nguyên bản — 12/48 |
 * | `Loi` | `failReadBackground` |
 * | `ThanhCong` | bộ mẫu với cả 48 tường `reviewed` |
 * | `KhongCoQuyen` | `roles: ['viewer']` — không quyền sửa lớp |
 * | `ThuGon` | `forceCollapsed` |
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

import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Wall } from '@/domain/spatial/types';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ProjectRole } from '@/types/project';

import {
  WallLayerReviewContainer,
  type WallLayerReviewContainerProps,
} from './WallLayerReview.container';
import {
  WALL_LAYER_FIXTURE_BUILDING,
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_WALLS,
} from './wallLayerReviewFixture';
import { createMockWallLayerReviewGateway } from './wallLayerReviewGateway';

/** Bảy trạng thái, đúng thứ tự `SEVEN_STATES` — cho story và cho bài kiểm. */
export const SEVEN_STORY_STATES: readonly SevenState[] = SEVEN_STATES;

const PROJECT_ID = 'project-1';
const FLOOR_ID = WALL_LAYER_FIXTURE_LEVEL.id;

/** Vai có quyền sửa lớp; `forbidden` dùng vai Người xem. */
const EDITOR_ROLES: readonly ProjectRole[] = ['engineer'];
const VIEWER_ROLES: readonly ProjectRole[] = ['viewer'];

/** Một đồ thị từ danh sách tường cho trước — cùng đường mà bộ mẫu đi qua. */
const graphOf = (walls: readonly Wall[]) =>
  normalizeSpatial({
    building: WALL_LAYER_FIXTURE_BUILDING,
    levels: [WALL_LAYER_FIXTURE_LEVEL],
    walls,
    openings: [],
    furniture: [],
    rooms: [],
    axes: [],
    dimensions: [],
    notes: [],
  });

const FULL_GRAPH = graphOf(WALL_LAYER_FIXTURE_WALLS);
const EMPTY_GRAPH = graphOf([]);

/** A5: xanh "đã xác minh" chỉ đánh dấu việc người duyệt, nên `source` đi cùng. */
const ALL_REVIEWED_GRAPH = graphOf(
  WALL_LAYER_FIXTURE_WALLS.map((wall) => ({ ...wall, reviewed: true, source: 'human' as const })),
);

/**
 * Cổng của trạng thái `loading`: `readBackground` KHÔNG BAO GIỜ trả lời.
 *
 * Một lời hứa treo mãi là cách trung thực để giữ `useQuery` ở `pending` — trả
 * về sau một `setTimeout` sẽ là một thời lượng ngoài thang chuyển động, và
 * story thì cần trạng thái đứng yên để người xem đọc được nó.
 */
const pendingGateway = () => ({
  ...createMockWallLayerReviewGateway({ graph: FULL_GRAPH }),
  readBackground: () => new Promise<never>(() => undefined),
});

/** Props container của một trạng thái. Bài kiểm dùng lại đúng hàm này (R-70). */
export function scenarioArgsFor(state: SevenState): WallLayerReviewContainerProps {
  const base = {
    floorId: FLOOR_ID,
    projectId: PROJECT_ID,
    levelId: WALL_LAYER_FIXTURE_LEVEL.id,
    onNavigate: () => undefined,
    roles: EDITOR_ROLES,
  };

  switch (state) {
    case 'empty':
      return { ...base, gateway: createMockWallLayerReviewGateway({ graph: EMPTY_GRAPH }) };

    case 'loading':
      return { ...base, gateway: pendingGateway() };

    case 'error':
      return {
        ...base,
        gateway: createMockWallLayerReviewGateway({
          graph: FULL_GRAPH,
          failReadBackground: true,
        }),
      };

    case 'success':
      return { ...base, gateway: createMockWallLayerReviewGateway({ graph: ALL_REVIEWED_GRAPH }) };

    case 'forbidden':
      return {
        ...base,
        gateway: createMockWallLayerReviewGateway({ graph: FULL_GRAPH }),
        roles: VIEWER_ROLES,
      };

    case 'collapsed':
      return {
        ...base,
        forceCollapsed: true,
        gateway: createMockWallLayerReviewGateway({ graph: FULL_GRAPH }),
      };

    case 'partial':
    default:
      return { ...base, gateway: createMockWallLayerReviewGateway({ graph: FULL_GRAPH }) };
  }
}

const meta = {
  title: 'Screens/QC/WallLayerReview',
  component: WallLayerReviewContainer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    /* Vỏ route: `WallLayerReviewRoute` không dựng ở đây, nhưng container vẫn
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
} satisfies Meta<typeof WallLayerReviewContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — AI không dò ra đoạn tường nào ở tầng này. */
export const Rong: Story = { args: scenarioArgsFor('empty') };

/** 2. Đang tải — chưa có ảnh nền, panel trái là khung xương. */
export const DangTai: Story = { args: scenarioArgsFor('loading') };

/** 3. Một phần — TRẠNG THÁI CHÍNH của màn, 12/48 đã duyệt. */
export const MotPhan: Story = { args: scenarioArgsFor('partial') };

/** 4. Lỗi — không tải được bản vẽ gốc; canvas VẪN không trắng. */
export const Loi: Story = { args: scenarioArgsFor('error') };

/** 5. Xong — 48/48 đã duyệt, panel trái mời sang lớp Cửa và nội thất. */
export const ThanhCong: Story = { args: scenarioArgsFor('success') };

/** 6. Không có quyền — vai Người xem: ray ẩn công cụ sửa, thanh tra bỏ viền. */
export const KhongCoQuyen: Story = { args: scenarioArgsFor('forbidden') };

/** 7. Thu gọn — hai panel ẩn, ray công cụ nổi trên canvas, chú giải VẪN hiện. */
export const ThuGon: Story = { args: scenarioArgsFor('collapsed') };
