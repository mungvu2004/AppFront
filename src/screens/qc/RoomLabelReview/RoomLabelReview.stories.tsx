/**
 * Bảy story của màn S-17 "Duyệt tên phòng" — đúng bảy trạng thái của A11.
 *
 * ## Vì sao story dựng CONTAINER chứ không dựng view bằng props viết tay
 *
 * `RoomLabelReview` là view thuần và nhận props đã tính sẵn
 * (`RoomLabelReviewProps`: `areaText`, `totalAreaText`, `labelAnchorMm`,
 * `fillToken`…). Viết tay bộ props đó cho bảy trạng thái nghĩa là dựng lại
 * viewmodel bằng tay — tức đoán trước kết quả của `useRoomLabelReview`, đúng
 * thứ R-61 cấm ("không công thức tự chế") và đúng cách để story trôi khỏi màn
 * thật sau lần sửa hook đầu tiên. Đó cũng là lý do
 * `roomLabelReviewScenarios.ts` mang NGUYÊN LIỆU đồ thị (`Room[]`/`Wall[]`)
 * chứ không mang viewmodel dựng sẵn — xem docstring của chính file đó.
 *
 * Nên bảy story cắm `createMockRoomLabelReviewGateway()` vào container thật.
 * Cùng cổng giả mà `useRoomLabelReview.test.ts` và `RoomLabelReview.test.tsx`
 * dùng, và cùng bộ mẫu 14 phòng / 248,60 m² của `roomLabelFixture.ts` — một bộ
 * dữ liệu cho cả ba nơi, không phải ba bảng sẽ lệch nhau (R-70). Tiền lệ:
 * `WallLayerReview.stories.tsx`.
 *
 * ## Bảy trạng thái ép bằng ĐẦU VÀO, không bằng một cờ `state`
 *
 * `deriveRoomLabelScreenState` dẫn xuất trạng thái từ dữ liệu chứ không nhận
 * một cờ, nên mỗi story ép đúng cái đầu vào sinh ra trạng thái đó — và cái đầu
 * vào ấy đọc ra từ kịch bản, không viết tay ở đây:
 *
 * | story | ép bằng |
 * |---|---|
 * | `Rong` | đồ thị không có phòng nào, nhưng CÓ bốn tường và vòng hở 62 mm |
 * | `DangTai` | cổng có `readRoomLayer` không bao giờ trả lời |
 * | `MotPhan` | bộ mẫu nguyên bản — 14 phòng, 3 chưa đặt tên |
 * | `Loi` | `failReadRoomLayer` — ảnh nền VẪN xem được |
 * | `ThanhCong` | bộ mẫu với cả 14 phòng đã đặt tên và `reviewed` |
 * | `KhongCoQuyen` | `roles: ['viewer']` — không quyền sửa lớp |
 * | `ThuGon` | `forceCollapsed` |
 *
 * ## BẪY ĐÃ BIẾT — `meta.excludeStories`
 *
 * Một export KHÔNG PHẢI story trong file stories làm TRẮNG toàn bộ file. {@link
 * scenarioArgsFor} và {@link SEVEN_STORY_STATES} là dữ liệu để bài kiểm dùng
 * lại (R-70), không phải story, nên cả hai PHẢI có tên trong
 * `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ProjectRole } from '@/types/project';

import {
  RoomLabelReviewContainer,
  type RoomLabelReviewContainerProps,
} from './RoomLabelReview.container';
import { ROOM_LABEL_FIXTURE_BUILDING, ROOM_LABEL_FIXTURE_LEVEL } from './roomLabelFixture';
import { createMockRoomLabelReviewGateway } from './roomLabelReviewGateway';
import {
  ROOM_LABEL_REVIEW_SCENARIOS,
  type RoomLabelReviewScenario,
} from './roomLabelReviewScenarios';

/** Bảy trạng thái, đúng thứ tự `SEVEN_STATES` — cho story và cho bài kiểm. */
export const SEVEN_STORY_STATES: readonly SevenState[] = SEVEN_STATES;

const PROJECT_ID = 'project-1';
const FLOOR_ID = ROOM_LABEL_FIXTURE_LEVEL.id;

/** Vai có quyền sửa lớp; `forbidden` dùng vai Người xem. */
const EDITOR_ROLES: readonly ProjectRole[] = ['engineer'];
const VIEWER_ROLES: readonly ProjectRole[] = ['viewer'];

/** Đồ thị của một kịch bản — đúng đường mà `useRoomLabelReview.test.ts` dựng nó. */
const graphOfScenario = (scenario: RoomLabelReviewScenario) =>
  normalizeSpatial({
    building: ROOM_LABEL_FIXTURE_BUILDING,
    levels: [ROOM_LABEL_FIXTURE_LEVEL],
    walls: [...scenario.walls],
    openings: [],
    furniture: [],
    rooms: [...scenario.rooms],
    axes: [],
    dimensions: [],
    notes: [],
  });

/** Kịch bản của một trạng thái, đọc ra từ bảy — không có kịch bản thứ tám ở đây. */
const scenarioFor = (state: SevenState): RoomLabelReviewScenario => {
  const scenario = ROOM_LABEL_REVIEW_SCENARIOS.find((entry) => entry.state === state);

  if (scenario === undefined) {
    throw new Error(`RoomLabelReview.stories: không có kịch bản cho trạng thái "${state}".`);
  }

  return scenario;
};

/**
 * Props container của một trạng thái. Bài kiểm dùng lại đúng hàm này (R-70).
 *
 * Trạng thái `loading` là ngoại lệ duy nhất phải bọc thêm cổng: một lời hứa
 * treo mãi giữ `useQuery` ở `pending`. Trả lời sau một `setTimeout` sẽ là một
 * thời lượng ngoài thang chuyển động (R-71), và story thì cần một trạng thái
 * đứng yên để người xem đọc được nó.
 */
export function scenarioArgsFor(state: SevenState): RoomLabelReviewContainerProps {
  const scenario = scenarioFor(state);
  const gateway = createMockRoomLabelReviewGateway({
    graph: graphOfScenario(scenario),
    failReadRoomLayer: scenario.error !== null,
    ...(scenario.backgroundImageUrl === null ? { withoutImage: true } : {}),
  });

  return {
    floorId: FLOOR_ID,
    levelId: ROOM_LABEL_FIXTURE_LEVEL.id,
    onNavigate: () => undefined,
    projectId: PROJECT_ID,
    roles: scenario.isViewerRole ? VIEWER_ROLES : EDITOR_ROLES,
    forceCollapsed: scenario.isCollapsed,
    gateway:
      state === 'loading'
        ? { ...gateway, readRoomLayer: () => new Promise<never>(() => undefined) }
        : gateway,
  };
}

const meta = {
  title: 'Screens/QC/RoomLabelReview',
  component: RoomLabelReviewContainer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    /* Vỏ route: `RoomLabelReviewRoute` không dựng ở đây, nhưng container vẫn
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
} satisfies Meta<typeof RoomLabelReviewContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — M-06 chưa khép được vòng nào; câu rỗng nói ra hai bước đi tiếp. */
export const Rong: Story = { args: scenarioArgsFor('empty') };

/** 2. Đang tải — chưa có dữ liệu lẫn ảnh nền; cột trái là khung xương. */
export const DangTai: Story = { args: scenarioArgsFor('loading') };

/** 3. Một phần — TRẠNG THÁI CHÍNH của màn: 3 phòng chưa đặt tên, một vòng hở 62 mm. */
export const MotPhan: Story = { args: scenarioArgsFor('partial') };

/** 4. Lỗi — lớp phòng hỏng, nhưng ẢNH GỐC vẫn xem được (canvas không trắng). */
export const Loi: Story = { args: scenarioArgsFor('error') };

/** 5. Xong — 14/14 phòng đã có tên và đã được người duyệt xác nhận. */
export const ThanhCong: Story = { args: scenarioArgsFor('success') };

/** 6. Không có quyền — vai Người xem: canvas chỉ xem, cột trái nói rõ vì sao. */
export const KhongCoQuyen: Story = { args: scenarioArgsFor('forbidden') };

/** 7. Thu gọn — cột trái và thanh tra ẩn, canvas chiếm cả khung, còn nút bung lại. */
export const ThuGon: Story = { args: scenarioArgsFor('collapsed') };
