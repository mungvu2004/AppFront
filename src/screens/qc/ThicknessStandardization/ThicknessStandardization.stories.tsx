/**
 * Bảy story của màn S-18 "Chuẩn hoá độ dày tường" — đúng bảy trạng thái của
 * A11.
 *
 * ## Vì sao story dựng CONTAINER chứ không dựng view bằng props viết tay
 *
 * `ThicknessStandardization` là view thuần và nhận props đã tính sẵn (`bins`,
 * `groupRows`, `segmentRows`, `summary`, `thresholdLabels`, `shapes`…). Viết
 * tay bộ props đó cho bảy trạng thái nghĩa là dựng lại viewmodel bằng tay —
 * tức đoán trước kết quả của `useThicknessStandardization`, đúng thứ R-61 cấm
 * ("không công thức tự chế") và đúng cách để story trôi khỏi màn thật sau lần
 * sửa hook đầu tiên. Đó cũng là lý do `thicknessStandardizationScenarios.ts`
 * mang NGUYÊN LIỆU đồ thị (`Wall[]`/`Level[]`) chứ không mang viewmodel dựng
 * sẵn — xem docstring của chính file đó.
 *
 * Nên bảy story cắm `createMockThicknessStandardizationGateway()` vào container
 * thật. Cùng cổng giả mà `useThicknessStandardization.test.ts` và
 * `ThicknessStandardization.test.tsx` dùng, và cùng bộ mẫu 48 đoạn / ba tầng
 * của `thicknessFixture.ts` — một bộ dữ liệu cho cả ba nơi, không phải ba bảng
 * sẽ lệch nhau (R-70). Tiền lệ: `RoomLabelReview.stories.tsx`.
 *
 * ## Bảy trạng thái ép bằng ĐẦU VÀO, không bằng một cờ `state`
 *
 * `deriveThicknessScreenState` dẫn xuất trạng thái từ dữ liệu chứ không nhận
 * một cờ, nên mỗi story ép đúng cái đầu vào sinh ra trạng thái đó — và cái đầu
 * vào ấy đọc ra từ kịch bản, không viết tay ở đây:
 *
 * | story | ép bằng |
 * |---|---|
 * | `Rong` | 48 đoạn ĐÃ ở đúng nhóm chuẩn, không còn gì để áp |
 * | `DangTai` | cổng có `readThicknessLayer` không bao giờ trả lời |
 * | `MotPhan` | bộ mẫu lọc còn hai nhóm 110 và 220 |
 * | `Loi` | `failReadThicknessLayer` — biểu đồ vẫn giữ đúng chiều cao khung |
 * | `ThanhCong` | như `Rong` về dữ liệu, khác ở chỗ lượt áp vừa chạy xong |
 * | `KhongCoQuyen` | `roles: ['viewer']` — không quyền sửa lớp |
 * | `ThuGon` | `forceCollapsed` |
 *
 * `ThanhCong` và `Rong` dùng CHUNG một tập tường: hai trạng thái ấy tả cùng một
 * sự thật dữ liệu và chỉ khác nhau ở chỗ lượt áp đã chạy hay chưa — nhưng story
 * không bấm hộ người dùng (CẤM TUYỆT ĐỐI: không áp thay đổi nào trước khi
 * người dùng bấm), nên cả hai dừng ở cùng một khung hình, và
 * `ThicknessStandardization.test.tsx` là nơi lái lượt áp thật.
 *
 * ## BẪY ĐÃ BIẾT — `meta.excludeStories`
 *
 * Một export KHÔNG PHẢI story trong file stories làm TRẮNG toàn bộ file.
 * {@link scenarioArgsFor} và {@link SEVEN_STORY_STATES} là dữ liệu để bài kiểm
 * dùng lại (R-70), không phải story, nên cả hai PHẢI có tên trong
 * `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ProjectRole } from '@/types/project';

import {
  ThicknessStandardizationContainer,
  type ThicknessStandardizationContainerProps,
} from './ThicknessStandardization.container';
import { THICKNESS_FIXTURE_LEVELS } from './thicknessFixture';
import {
  createMockThicknessStandardizationGateway,
  thicknessGraphOf,
} from './thicknessStandardizationGateway';
import {
  THICKNESS_STANDARDIZATION_SCENARIOS,
  type ThicknessStandardizationScenario,
} from './thicknessStandardizationScenarios';

/** Bảy trạng thái, đúng thứ tự `SEVEN_STATES` — cho story và cho bài kiểm. */
export const SEVEN_STORY_STATES: readonly SevenState[] = SEVEN_STATES;

const PROJECT_ID = 'project-1';
const FLOOR_ID = THICKNESS_FIXTURE_LEVELS[0]?.id ?? '';

/** Vai có quyền sửa lớp; `forbidden` dùng vai Người xem. */
const EDITOR_ROLES: readonly ProjectRole[] = ['engineer'];
const VIEWER_ROLES: readonly ProjectRole[] = ['viewer'];

/** Đồ thị của một kịch bản — đúng đường mà `useThicknessStandardization.test.ts` dựng nó. */
const graphOfScenario = (scenario: ThicknessStandardizationScenario): NormalizedSpatial =>
  thicknessGraphOf(scenario.walls, scenario.levels);

/** Kịch bản của một trạng thái, đọc ra từ bảy — không có kịch bản thứ tám ở đây. */
const scenarioFor = (state: SevenState): ThicknessStandardizationScenario => {
  const scenario = THICKNESS_STANDARDIZATION_SCENARIOS.find((entry) => entry.state === state);

  if (scenario === undefined) {
    throw new Error(
      `ThicknessStandardization.stories: không có kịch bản cho trạng thái "${state}".`,
    );
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
export function scenarioArgsFor(state: SevenState): ThicknessStandardizationContainerProps {
  const scenario = scenarioFor(state);
  const gateway = createMockThicknessStandardizationGateway({
    graph: graphOfScenario(scenario),
    failReadThicknessLayer: scenario.error !== null,
  });

  return {
    floorId: FLOOR_ID,
    projectId: PROJECT_ID,
    roles: scenario.isViewerRole ? VIEWER_ROLES : EDITOR_ROLES,
    forceCollapsed: scenario.isCollapsed,
    gateway:
      state === 'loading'
        ? { ...gateway, readThicknessLayer: () => new Promise<never>(() => undefined) }
        : gateway,
  };
}

const meta = {
  title: 'Screens/QC/ThicknessStandardization',
  component: ThicknessStandardizationContainer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    /* Vỏ route: `ThicknessStandardizationRoute` không dựng ở đây, nhưng
     * container vẫn nằm trong cây có router để mọi liên kết con tìm được
     * provider. */
    (Story) => (
      <MemoryRouter>
        <div className="h-screen w-screen">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  excludeStories: ['scenarioArgsFor', 'SEVEN_STORY_STATES'],
} satisfies Meta<typeof ThicknessStandardizationContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — mọi đoạn đã ở đúng nhóm chuẩn; câu rỗng nói ra hai bước đi tiếp. */
export const Rong: Story = { args: scenarioArgsFor('empty') };

/** 2. Đang tải — biểu đồ là khung xương đúng chiều cao, bảng là sáu dòng chờ. */
export const DangTai: Story = { args: scenarioArgsFor('loading') };

/** 3. Một phần — TRẠNG THÁI CHÍNH của màn: mới có số đo cho nhóm 110 và 220. */
export const MotPhan: Story = { args: scenarioArgsFor('partial') };

/** 4. Lỗi — lớp số đo hỏng, nhưng khung biểu đồ và vỏ màn vẫn đứng (không trắng). */
export const Loi: Story = { args: scenarioArgsFor('error') };

/** 5. Xong — 48/48 đoạn trong dung sai; ô "vượt dung sai" chuyển sang mức đã duyệt. */
export const ThanhCong: Story = { args: scenarioArgsFor('success') };

/** 6. Không có quyền — vai Người xem: thanh áp dụng vắng mặt, câu giải thích thay chỗ. */
export const KhongCoQuyen: Story = { args: scenarioArgsFor('forbidden') };

/** 7. Thu gọn — canvas xem trước ẩn, hai bảng chiếm cả bề ngang, còn nút bung lại. */
export const ThuGon: Story = { args: scenarioArgsFor('collapsed') };
