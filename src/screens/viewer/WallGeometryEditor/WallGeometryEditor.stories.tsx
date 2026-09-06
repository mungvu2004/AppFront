/**
 * Bảy story của `WallGeometryEditor` — một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng THẲNG TỪ PROPS: `WallGeometryEditor` là view thuần, hợp đồng của
 * nó (`wallGeometryEditorTypes.ts`) chỉ có `state` cộng `overlayRef`, nên
 * không có provider, không store và không cổng nào ở đây.
 *
 * BA LUẬT của mục 6.3 (`notes/wall-geometry-editor/contract-screen.md`,
 * R-70 — không làm vừa lòng bài kiểm):
 *
 * 1. Bức tường lấy từ bộ mẫu chuẩn A14 (`CLEAN_BUILDING_SCENARIO`) — mã tường,
 *    độ dày, toạ độ đỉnh đều là số thật của bộ mẫu, không gõ tay.
 * 2. Chuỗi lấy từ `WALL_GEOMETRY_EDITOR_TEXT`, không chép lại.
 * 3. Kịch bản `success` có một biến thể `comparisonChip: null` — chỗ để mở #1
 *    (mục 7 của hợp đồng) được kiểm THẬT, không chỉ được viết ra.
 *
 * BẪY ĐÃ TRÁNH: một export KHÔNG-PHẢI-STORY trong file CSF làm Storybook coi
 * nó là story và bỏ trắng cả file. `meta.excludeStories` liệt kê đúng những
 * export như vậy.
 */
import type { Meta, StoryObj } from '@storybook/react';

import { formatLength } from '@/lib/format/measure';
import { CLEAN_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { WallGeometryEditor } from './WallGeometryEditor';
import {
  KNOWN_SNAP_KIND_IDS,
  WALL_GEOMETRY_EDITOR_TEXT,
  type WallGeometryEditorContent,
  type WallGeometryEditorState,
  type WallGeometryHandle,
  type WallGeometryPointPx,
  type WallGeometrySnapModel,
  type WallGeometryToolButton,
  type WallGeometryToolId,
} from './wallGeometryEditorTypes';

const TEXT = WALL_GEOMETRY_EDITOR_TEXT;

/** Khung nền của story — cao cố định để thấy được toàn bộ lớp phủ tuyệt đối. */
export const FRAME_CLASS = 'relative h-[640px] w-full bg-bg-app';

const noop = (): void => {
  /* Kịch bản là dữ liệu tĩnh: callback có mặt để view gắn được, không để chạy. */
};

/** Bức tường thật của bộ mẫu chuẩn A14 (luật 1 của mục 6.3). */
const SAMPLE_WALL = CLEAN_BUILDING_SCENARIO.graph.walls[0];

if (SAMPLE_WALL === undefined) {
  throw new Error('Bộ mẫu chuẩn A14 thiếu tường để dựng kịch bản của WallGeometryEditor.');
}

/**
 * Trích ra thành hằng số nguyên thuỷ (chuỗi/số) ngay sau lượt kiểm `undefined`.
 *
 * `noUncheckedIndexedAccess` chỉ thu hẹp kiểu của `SAMPLE_WALL` tại chính chỗ
 * kiểm tra; các hàm dựng kịch bản khai bên dưới đóng biến `SAMPLE_WALL` lại
 * (closure) và `tsc` không mang lượt thu hẹp đó vào trong một hàm khác, kể cả
 * khi hàm đó chỉ được gọi sau lượt kiểm. Giá trị nguyên thuỷ thì không có vấn
 * đề này.
 */
const WALL_ID = SAMPLE_WALL.id;
const WALL_START_X = SAMPLE_WALL.centreline.start.x;
const WALL_START_Y = SAMPLE_WALL.centreline.start.y;
const WALL_END_X = SAMPLE_WALL.centreline.end.x;
const WALL_END_Y = SAMPLE_WALL.centreline.end.y;

const V1_PX: WallGeometryPointPx = { xPx: 200, yPx: 240 };
const V2_PX: WallGeometryPointPx = { xPx: 480, yPx: 240 };
const MID_PX: WallGeometryPointPx = { xPx: 340, yPx: 240 };

const WALL_LENGTH_LABEL = formatLength(Math.abs(WALL_END_X - WALL_START_X));

/** Sáu công cụ, đủ chữ, cùng thứ tự `WALL_GEOMETRY_TOOL_IDS` (luật 2 của mục 6.3). */
function createToolButtons(activeToolId: WallGeometryToolId | null, isEnabled: boolean): WallGeometryToolButton[] {
  const ids: readonly WallGeometryToolId[] = [
    'moveVertex',
    'addVertex',
    'removeVertex',
    'splitWall',
    'joinWalls',
    'resetHeight',
  ];

  return ids.map((id) => {
    const tool = TEXT.tools[id];

    return {
      id,
      iconCode: id,
      isActive: id === activeToolId,
      isEnabled,
      keyLabel: tool.key,
      label: tool.label,
      onSelect: noop,
      tooltip: TEXT.tools.tooltip(tool.label, tool.key),
    };
  });
}

function createHandles(isEnabled: boolean): WallGeometryHandle[] {
  return [
    {
      ariaLabel: TEXT.handles.vertex('V-01'),
      atPx: V1_PX,
      id: 'V-01',
      isDragging: false,
      isEnabled,
      isHovered: false,
      kind: 'vertex',
      onNudge: noop,
      onPointerDown: noop,
      onPointerEnter: noop,
      onPointerLeave: noop,
    },
    {
      ariaLabel: TEXT.handles.vertex('V-02'),
      atPx: V2_PX,
      id: 'V-02',
      isDragging: false,
      isEnabled,
      isHovered: true,
      kind: 'vertex',
      onNudge: noop,
      onPointerDown: noop,
      onPointerEnter: noop,
      onPointerLeave: noop,
    },
    {
      ariaLabel: TEXT.handles.edge(WALL_ID),
      atPx: MID_PX,
      id: `edge-${WALL_ID}`,
      isDragging: false,
      isEnabled,
      isHovered: false,
      kind: 'edge',
      onNudge: noop,
      onPointerDown: noop,
      onPointerEnter: noop,
      onPointerLeave: noop,
    },
  ];
}

function createSnap(isEnabled: boolean): WallGeometrySnapModel {
  return {
    activeGuides: [
      {
        fromPx: V2_PX,
        id: 'guide-perpendicular',
        kindId: KNOWN_SNAP_KIND_IDS.perpendicular,
        label: TEXT.snap.perpendicular,
        labelAtPx: { xPx: V2_PX.xPx + 24, yPx: V2_PX.yPx - 24 },
        toPx: { xPx: V2_PX.xPx, yPx: V2_PX.yPx - 80 },
      },
    ],
    isAxisLocked: false,
    isSuppressed: false,
    kinds: [
      { id: KNOWN_SNAP_KIND_IDS.axis, isEnabled, label: TEXT.snap.axis('A'), onToggle: noop },
      { id: KNOWN_SNAP_KIND_IDS.otherVertex, isEnabled, label: TEXT.snap.otherVertex, onToggle: noop },
      { id: KNOWN_SNAP_KIND_IDS.perpendicular, isEnabled, label: TEXT.snap.perpendicular, onToggle: noop },
    ],
    modifierNotice: null,
  };
}

interface ContentOptions {
  readonly activeToolId?: WallGeometryToolId | null;
  readonly isEnabled?: boolean;
  readonly isLocked?: boolean;
  readonly comparisonChip?: WallGeometryEditorContent['comparisonChip'];
  readonly toolbarButtons?: readonly WallGeometryToolButton[];
}

/** Nội dung dùng chung cho bốn trạng thái `partial`/`error`/`success`/`forbidden`. */
function createContent(options: ContentOptions = {}): WallGeometryEditorContent {
  const isEnabled = options.isEnabled ?? true;
  const isLocked = options.isLocked ?? false;
  const buttons = options.toolbarButtons ?? createToolButtons(options.activeToolId ?? null, isEnabled);

  return {
    band: { doneLabel: TEXT.band.done, label: TEXT.band.editing(WALL_ID), onDone: noop },
    comparisonChip: options.comparisonChip ?? {
      label: TEXT.comparison.deviation('12 mm'),
      tone: 'attention',
    },
    dimensionChain: {
      segments: [{ id: `dim-${WALL_ID}`, isLive: false, lengthLabel: WALL_LENGTH_LABEL, midpointPx: MID_PX }],
      totalLabel: WALL_LENGTH_LABEL,
    },
    drag: null,
    edgeHighlights: [],
    handles: createHandles(isEnabled),
    returningHandleId: null,
    snap: createSnap(isEnabled),
    toolbar: { buttons, hint: null },
    vertexTable: {
      columns: { code: TEXT.vertexTable.columnCode, x: TEXT.vertexTable.columnX, y: TEXT.vertexTable.columnY },
      emptyMessage: null,
      rows: [
        {
          code: 'V-01',
          id: 'V-01',
          isLocked,
          isSelected: true,
          onSelect: noop,
          x: {
            displayValue: formatLength(WALL_START_X),
            draftValue: formatLength(WALL_START_X),
            message: null,
            onCancel: noop,
            onCommit: noop,
            onDraftChange: noop,
            status: 'idle',
          },
          y: {
            displayValue: formatLength(WALL_START_Y),
            draftValue: formatLength(WALL_START_Y),
            message: null,
            onCancel: noop,
            onCommit: noop,
            onDraftChange: noop,
            status: 'idle',
          },
        },
        {
          code: 'V-02',
          id: 'V-02',
          isLocked,
          isSelected: false,
          onSelect: noop,
          x: {
            displayValue: formatLength(WALL_END_X),
            draftValue: formatLength(WALL_END_X),
            message: null,
            onCancel: noop,
            onCommit: noop,
            onDraftChange: noop,
            status: 'idle',
          },
          y: {
            displayValue: formatLength(WALL_END_Y),
            draftValue: formatLength(WALL_END_Y),
            message: null,
            onCancel: noop,
            onCommit: noop,
            onDraftChange: noop,
            status: 'idle',
          },
        },
      ],
    },
  };
}

/** Bảy trạng thái, đúng thứ tự và đúng tên của `SEVEN_STATES` (luật 3 của mục 6.3 canh riêng `success`). */
export const WALL_GEOMETRY_EDITOR_SCENARIOS: Readonly<Record<SevenState, WallGeometryEditorState>> = {
  collapsed: {
    kind: 'collapsed',
    notice: TEXT.states.collapsed.notice,
    onExit: noop,
    summaryLabel: TEXT.states.collapsed.summary(WALL_ID),
  },
  empty: { hint: TEXT.states.empty.hint, kind: 'empty', message: TEXT.states.empty.message },
  error: {
    ...createContent({ comparisonChip: null }),
    explanation: TEXT.states.error.selfIntersecting,
    kind: 'error',
    offendingEdgeIds: [`edge-${WALL_ID}`],
    onDismissError: noop,
    edgeHighlights: [
      { ariaLabel: TEXT.handles.offendingEdge(WALL_ID), edgeId: `edge-${WALL_ID}`, fromPx: V1_PX, toPx: V2_PX, tone: 'violation' },
    ],
  },
  forbidden: {
    ...createContent({ isEnabled: false, isLocked: true, toolbarButtons: [] }),
    kind: 'forbidden',
    notice: TEXT.states.forbidden.viewerRole,
  },
  loading: { kind: 'loading', message: TEXT.states.loading.message },
  partial: {
    ...createContent({ activeToolId: 'resetHeight', toolbarButtons: createToolButtons('resetHeight', true).slice(-1) }),
    gap: { closeLabel: TEXT.states.partial.closeGap, onCloseGap: noop, sizeLabel: formatLength(12) },
    isHeightOnly: true,
    kind: 'partial',
    notice: TEXT.states.partial.heightOnly,
  },
  /**
   * Luật 3 của mục 6.3: `comparisonChip: null` — KHÔNG có vết vẽ gốc để so.
   * Đây là cách chỗ để mở #1 (mục 7) được kiểm thật, không chỉ được viết ra.
   */
  success: { ...createContent({ activeToolId: 'moveVertex', comparisonChip: null }), kind: 'success' },
};

const meta = {
  component: WallGeometryEditor,
  decorators: [
    (Story): JSX.Element => (
      <div className={FRAME_CLASS}>
        <Story />
      </div>
    ),
  ],
  /* Ba export trên (`FRAME_CLASS`, `WALL_GEOMETRY_EDITOR_SCENARIOS`) cộng
     `argsFor` dưới đây không phải story — thiếu dòng này Storybook nhận nhầm
     và cả file ra trắng. */
  excludeStories: ['FRAME_CLASS', 'WALL_GEOMETRY_EDITOR_SCENARIOS', 'argsFor'],
  parameters: { layout: 'fullscreen' },
  title: 'Screens/Viewer/WallGeometryEditor',
} satisfies Meta<typeof WallGeometryEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Props của một trạng thái, dùng chung giữa story và bài kiểm của T7 (R-70). */
export function argsFor(state: SevenState): { state: WallGeometryEditorState } {
  return { state: WALL_GEOMETRY_EDITOR_SCENARIOS[state] };
}

/** 1. Rỗng — chưa chọn tường nào; thanh công cụ hiện một câu gợi ý. */
export const Rong: Story = { args: argsFor('empty') };

/** 2. Đang tải — đang tính lại hình học. */
export const DangTai: Story = { args: argsFor('loading') };

/** 3. Một phần — chọn nhiều tường (chỉ đổi chiều cao) và một vòng hở. */
export const MotPhan: Story = { args: argsFor('partial') };

/** 4. Lỗi — đa giác tự cắt bị từ chối; cạnh gây lỗi được tô sáng và gọi tên. */
export const Loi: Story = { args: argsFor('error') };

/** 5. Xong — một bức tường của bộ mẫu chuẩn A14, KHÔNG có vết vẽ gốc để so (chỗ để mở #1). */
export const Xong: Story = { args: argsFor('success') };

/** 6. Không có quyền — công cụ sửa bị gỡ khỏi thanh, mọi hàng đỉnh chỉ đọc. */
export const KhongCoQuyen: Story = { args: argsFor('forbidden') };

/** 7. Thu gọn — khoá sửa trên di động, chỉ xem. */
export const ThuGon: Story = { args: argsFor('collapsed') };
