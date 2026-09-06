/**
 * Bảy story của S-33 — một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng **container ĐÃ NỐI DÂY**, không dựng view rỗng: `forceState` là
 * chỗ tiêm mà `RoomAreaPanelContainerProps` khai sẵn đúng cho việc này, nên
 * mỗi story là màn thật chạy trên dữ liệu thật, chỉ khác ở một trạng thái được
 * ép. Một story dựng từ props gõ tay sẽ vẽ ra thứ không ai chứng minh được là
 * màn thật vẽ giống.
 *
 * ## Dữ liệu: bộ mẫu chuẩn A14, và một khiếm khuyết CỦA BỘ MẪU
 *
 * A14 nói bộ mẫu là 14 phòng, 248,60 m² — mười ba phòng 17,00 m² cộng một
 * phòng 27,60 m² (`sampleBuilding.ts:149`). Nhưng **vòng phòng** lưu trong bộ
 * mẫu là mười bốn hình chữ nhật giống hệt nhau, mỗi hình 17,00 m², nên thứ đo
 * TỪ VÒNG cộng ra 238,00. `src/domain/rooms/__tests__/area.test.ts:79-92` đã
 * gặp đúng chuyện đó và xử lý đúng một cách: dựng lại vòng phòng cho khớp bảng
 * diện tích của chính bộ mẫu. {@link createRoomAreaSampleGraph} lặp lại phép
 * ấy, và bài kiểm của màn nhập lại chính hàm này — một nguồn dữ liệu, dùng
 * chung giữa story và bài kiểm (R-70).
 *
 * Tên phòng và tầng cũng được đặt lại thành tiếng Việt: bộ mẫu gọi chúng là
 * `Room 0` và `Level 0`, và một màn tiếng Việt vẽ ra chữ ấy thì `expectVietnamese`
 * báo đúng. Không con số nào đổi theo.
 *
 * ## BẪY CSF
 *
 * Một export KHÔNG-PHẢI-STORY trong file CSF làm Storybook nhận nhầm nó là
 * story và bỏ TRẮNG cả file. `meta.excludeStories` liệt kê đúng những export
 * như vậy.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, Room, RoomUsage, SpatialGraph } from '@/domain/spatial/types';
import { SQUARE_MILLIMETRES_PER_SQUARE_METRE } from '@/domain/units/types';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { useStore } from '@/store';

import { RoomAreaPanelContainer } from './RoomAreaPanel.container';
import type { RoomAreaScreenState } from './roomAreaTypes';

/** Khung nền của story — bề rộng 344 của panel, cao cố định để thấy hết cột. */
export const FRAME_CLASS = 'h-[760px] w-[344px] bg-bg-app';

/** Bề rộng mọi phòng của bảng nghiệm thu — cùng con số `area.test.ts` dùng. */
export const SCHEDULE_ROOM_WIDTH_MM = 4000;

/** Tám công năng của `RoomUsage`, đúng thứ tự khai trong `spatial/types.ts`. */
export const ALL_ROOM_USAGES: readonly RoomUsage[] = [
  'livingRoom',
  'bedroom',
  'kitchen',
  'bathroom',
  'utility',
  'corridor',
  'stairwell',
  'other',
];

/**
 * Bộ mẫu chuẩn A14 với mỗi vòng phòng đo đúng `Room.areaM2` mà nó khai.
 *
 * Bề rộng cố định, chiều sâu = diện tích ÷ bề rộng. 17,00 m² ra 4.250 mm và
 * 27,60 m² ra 6.900 mm — cả hai là số nguyên milimét, nên `computeArea` đọc lại
 * đúng con số bộ mẫu khai, không sai một phần nghìn nào.
 */
export function createRoomAreaSampleGraph(): SpatialGraph {
  const graph = createCleanBuildingScenario().graph;

  const rooms: Room[] = graph.rooms.map((room, index) => {
    const depthMm = (room.areaM2 * SQUARE_MILLIMETRES_PER_SQUARE_METRE) / SCHEDULE_ROOM_WIDTH_MM;
    const left = index * SCHEDULE_ROOM_WIDTH_MM;

    return {
      ...room,
      name: `Phòng ${String(index)}`,
      outline: [
        { x: left, y: 0 },
        { x: left + SCHEDULE_ROOM_WIDTH_MM, y: 0 },
        { x: left + SCHEDULE_ROOM_WIDTH_MM, y: depthMm },
        { x: left, y: depthMm },
      ],
    };
  });

  const levels: Level[] = graph.levels.map((level, index) => ({
    ...level,
    name: `Tầng ${String(index)}`,
  }));

  return { ...graph, levels, rooms };
}

/** Cùng bộ mẫu, mười bốn phòng quay vòng qua CẢ TÁM công năng — mồi của phép [N2]. */
export function createEveryUsageGraph(): SpatialGraph {
  const graph = createRoomAreaSampleGraph();

  const rooms: Room[] = graph.rooms.map((room, index) => ({
    ...room,
    usage: ALL_ROOM_USAGES[index % ALL_ROOM_USAGES.length] ?? room.usage,
  }));

  return { ...graph, rooms };
}

/** Cùng bộ mẫu, phòng đầu bị xoá tên — mồi thật của trạng thái "một phần". */
export function createUnnamedRoomGraph(): SpatialGraph {
  const graph = createRoomAreaSampleGraph();
  const rooms: Room[] = graph.rooms.map((room, index) =>
    index === 0 ? { ...room, name: '' } : room,
  );

  return { ...graph, rooms };
}

/*
 * Bộ mẫu vào kho MỘT lần, lúc Storybook nạp file.
 *
 * Màn này đọc phòng từ kho, không đọc qua mạng (PQ-3), nên "dữ liệu của story"
 * chính là nội dung kho. Nạp ở đây chứ không trong một decorator: một decorator
 * ghi vào kho trong lúc vẽ sẽ là một lượt ghi giữa lượt render, và Storybook
 * gắn lại decorator mỗi lần đổi story.
 */
useStore.getState().setSpatial(normalizeSpatial(createRoomAreaSampleGraph()), 'v-story');

const noop = (): void => {
  /* Story là ảnh tĩnh của một trạng thái; chỗ nối có mặt để container gắn được. */
};

const meta = {
  component: RoomAreaPanelContainer,
  decorators: [
    (Story): JSX.Element => (
      <div className={FRAME_CLASS}>
        <Story />
      </div>
    ),
  ],
  /* Sáu export trên đây không phải story — thiếu dòng này Storybook nhận nhầm
     và cả file ra trắng. */
  excludeStories: [
    'ALL_ROOM_USAGES',
    'FRAME_CLASS',
    'SCHEDULE_ROOM_WIDTH_MM',
    'argsFor',
    'createEveryUsageGraph',
    'createRoomAreaSampleGraph',
    'createUnnamedRoomGraph',
  ],
  parameters: { layout: 'centered' },
  title: 'Screens/Viewer/RoomAreaPanel',
} satisfies Meta<typeof RoomAreaPanelContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Props của một trạng thái. Hai hành động rời màn là HAI sợi dây khác nhau (R-73). */
export function argsFor(state: RoomAreaScreenState): {
  forceState: RoomAreaScreenState;
  onCheckWallGaps: () => void;
  onOpenExport: () => void;
} {
  return { forceState: state, onCheckWallGaps: noop, onOpenExport: noop };
}

/** 1. Rỗng — chưa khép được vòng phòng nào; hành động là soát khe hở tường. */
export const Rong: Story = { args: argsFor('empty') };

/** 2. Đang tải — khung xương của ô tổng và danh sách. */
export const DangTai: Story = { args: argsFor('loading') };

/** 3. Một phần — bảng có số, nhưng còn tầng thiếu diện tích hoặc phòng chưa tên. */
export const MotPhan: Story = { args: argsFor('partial') };

/** 4. Lỗi — một lượt ghi bị tầng lệnh từ chối; nút "Đo lại" gửi lại chính nó. */
export const Loi: Story = { args: argsFor('error') };

/** 5. Xong — mười bốn phòng của bộ mẫu chuẩn A14, tổng 248,60 m². */
export const Xong: Story = { args: argsFor('ready') };

/** 6. Không có quyền — vai chỉ xem; ô tên phòng là chữ tĩnh. */
export const KhongCoQuyen: Story = { args: argsFor('forbidden') };

/** 7. Thu gọn — chỉ tổng và NĂM phòng lớn nhất toàn màn. */
export const ThuGon: Story = { args: argsFor('collapsed') };
