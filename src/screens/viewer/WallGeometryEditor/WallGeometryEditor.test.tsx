/**
 * Lượt kiểm và bản NGHIỆM THU ĐỊNH LƯỢNG của lớp phủ `WallGeometryEditor` (S-19).
 *
 * Bốn bộ khẳng định dùng chung của repo cộng sáu phép nghiệm thu mà chỉ lớp phủ
 * ĐÃ NỐI DÂY mới trả lời được. Mỗi phép **in ra con số thật** khi chạy — E.10
 * cấm báo "đạt" cho một bước chưa chạy, nên chỗ nào không đo được thì bài kiểm
 * nói thẳng là chưa đo được, kèm lý do.
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[G1]` | `expectSevenStates` trên bảy trạng thái THẬT của hook | 7/7 |
 * | `[G2]` | `expectAccessible` — bàn phím hạng nhất, Esc đóng lớp trên cùng | 7/7 |
 * | `[G3]` | `expectVietnamese` — không sót tiếng Anh, không mất dấu | 7/7 |
 * | `[G4]` | `expectNoRawColor` — cả thư mục màn | 0 mã màu thô |
 * | `[N1]` | kéo một đỉnh qua 40 khung hình | lịch sử tăng đúng 1 |
 * | `[N2]` | cửa trên bức tường vừa kéo | vị trí tương đối trước = sau |
 * | `[N3]` | ba loại bắt điểm, mỗi loại một nhãn hiện trên màn | 3 nhãn |
 * | `[N4]` | Esc giữa lúc kéo | toạ độ sau Esc = toạ độ trước khi kéo |
 * | `[N5]` | sửa trong 3D ⇒ mặt bằng 2D khớp | ba phía đọc ra cùng một hình |
 * | `[N6]` | `comparisonChip` | luôn `null`, không chip nào được vẽ |
 *
 * ## Vì sao dựng ĐÃ NỐI DÂY chứ không gõ tay bảy `state`
 *
 * Bảy trạng thái ở đây là ĐẦU RA THẬT của `useWallGeometryEditor` chạy trên bộ
 * mẫu chuẩn A14, không phải bảy đối tượng gõ tay: một bài kiểm gõ lại chính thứ
 * nó đang cần chứng minh thì không kiểm gì cả (R-70). {@link captureState} mở
 * lớp phủ bảy lần, mỗi lần với một đầu vào thật, và giữ lại `state` hook trả về.
 *
 * Đồ thị luôn là bộ mẫu chuẩn của A14 (`@/lib/testing/fixtures` — 4 tầng, 48
 * tường, 14 phòng, 248,60 m²); không dữ liệu mẫu nào được bịa ra tại chỗ.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import {
  sampleDoorId,
  sampleLevelId,
  sampleWallId,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import { toAttachedOpening, toSolidWall } from '@/lib/commands/business/shared';
import { createHistoryStack, type HistoryStack } from '@/lib/commands/history';
import { durationMs } from '@/lib/motion/tokens';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { createTestQueryClient } from '@/lib/testing/render';
import {
  createSevenStateScenarios,
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
} from '@/lib/testing/sevenStateScenarios';
import { useStore } from '@/store';
import { resetCommitRun } from '@/store/commit';

import { WallGeometryEditor } from './WallGeometryEditor';
import { WallGeometryEditorContainer } from './WallGeometryEditor.container';
import { useWallGeometryEditor } from './useWallGeometryEditor';
import {
  createWallGeometryEditorGateway,
  formatCoordinate,
  vertexDisplayCode,
  vertexIdOf,
  WALL_GEOMETRY_SNAP_KIND_IDS,
  WALL_GEOMETRY_SNAP_LABELS,
  type WallGeometryEditorGateway,
  type WallGeometryMoveVertexInput,
} from './wallGeometryEditorGateway';
import {
  WALL_GEOMETRY_EDITOR_TEXT,
  WALL_GEOMETRY_MOTION,
  type WallGeometryEditorState,
} from './wallGeometryEditorTypes';

const TEXT = WALL_GEOMETRY_EDITOR_TEXT;
const SCREEN_DIR = 'src/screens/viewer/WallGeometryEditor';
const REPORT = '[WALL-GEOMETRY-EDITOR]';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu và những con số của phiên nghiệm thu.                                */
/* -------------------------------------------------------------------------- */

/** Bức tường đang sửa: tường 0 của bộ mẫu, tầng 0, có đúng một cửa trên nó. */
const WALL_ID = sampleWallId(0);
/** Bức tường thứ hai CÙNG TẦNG — tầng của tường `n` là `n % 4`, nên là tường 4. */
const OTHER_WALL_ID = sampleWallId(4);
const FLOOR_ID = sampleLevelId(0);
/** Cửa của bộ mẫu nằm trên tường 0 — mồi của phép nghiệm thu [N2]. */
const DOOR_ID = sampleDoorId(0);

/** Đỉnh `end` của tường 0, chỗ mọi lượt kéo trong bài này bắt đầu. */
const DRAGGED_VERTEX_CODE = vertexDisplayCode(1);
const DRAGGED_VERTEX_ID = vertexIdOf(WALL_ID, 'end');

/**
 * Toạ độ đỉnh `end` của tường 0 trong bộ mẫu, và chỗ lượt kéo đưa nó tới.
 *
 * Đích là 2.000 mm chứ không phải một con số bất kỳ, và lý do là một khiếm
 * khuyết CỦA BỘ MẪU chứ không phải của màn: cửa `D-DOOR0` rộng 900 mm nằm ở
 * `offsetMm` 300 trên một bức tường chỉ dài 1.000 mm, tức nó đã thò ra ngoài
 * tường ngay từ đầu (vị trí tương đối 0,75 ⇒ tâm ở 750 mm, trong khi tâm lớn
 * nhất còn lọt là 550 mm). Kéo tới 1.400 mm thì `reflowOpenings` KẸP cửa lại
 * còn 0,6786 để nó khỏi treo ra khỏi đầu tường — một phép bảo vệ đúng, nhưng
 * nó che mất thứ [N2] đang đo. Ở 2.000 mm cửa vừa vặn nằm trọn, nên phép đo
 * "giữ nguyên vị trí tương đối" đọc được đúng cái nó định đọc.
 */
const DRAG_FROM_X_MM = 1000;
const DRAG_TO_X_MM = 2000;
const DRAG_AXIS_Y_MM = 0;
/** Đúng bốn mươi khung hình, như đặc tả nghiệm thu đòi. */
const DRAG_FRAME_COUNT = 40;
const DRAG_STEP_MM = 10;

/** Ba chỗ chạm để lộ ra ba loại bắt điểm; mỗi chỗ nằm trong bán kính bắt điểm của nó. */
const OTHER_WALL_START_X_MM = 4000;
const PERPENDICULAR_X_MM = 4500;
const OFF_AXIS_Y_MM = 5;
const GRID_ONLY_X_MM = 1600;

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Những gì bài kiểm đọc ra từ bên trong lớp phủ đang chạy. */
interface EditorProbe {
  state: WallGeometryEditorState | null;
  readonly geometryChanges: string[];
  exits: number;
}

const createProbe = (): EditorProbe => ({ exits: 0, geometryChanges: [], state: null });

/** Cổng THẬT, bọc thêm một lớp đếm — mỗi lượt gọi ba cửa của phiên kéo đếm được. */
interface CountedGateway {
  readonly gateway: WallGeometryEditorGateway;
  readonly history: HistoryStack;
  readonly previews: WallGeometryMoveVertexInput[];
  readonly commits: WallGeometryMoveVertexInput[];
  readonly discards: number[];
}

function createCountedGateway(): CountedGateway {
  const history = createHistoryStack();
  const base = createWallGeometryEditorGateway({ history });
  const previews: WallGeometryMoveVertexInput[] = [];
  const commits: WallGeometryMoveVertexInput[] = [];
  const discards: number[] = [];

  return {
    commits,
    discards,
    gateway: {
      ...base,
      commitVertexMove: (input) => {
        commits.push(input);

        return base.commitVertexMove(input);
      },
      discardVertexPreview: () => {
        discards.push(discards.length + 1);
        base.discardVertexPreview();
      },
      previewVertexMove: (input) => {
        previews.push(input);
        base.previewVertexMove(input);
      },
    },
    history,
    previews,
  };
}

interface WiredEditorProps {
  readonly probe: EditorProbe;
  readonly gateway: WallGeometryEditorGateway;
  readonly wallId: string | null;
  readonly selectedWallIds: readonly string[];
  readonly canEdit?: boolean;
  readonly isCollapsed?: boolean;
  readonly isSectionOrthographic?: boolean;
}

/** Hook thật cộng view thật, store thật, cổng thật — không nửa nào bị dựng lại. */
function WiredEditor(props: WiredEditorProps) {
  const [overlayElement, setOverlayElement] = useState<HTMLElement | null>(null);
  const { probe } = props;

  const model = useWallGeometryEditor({
    canEdit: props.canEdit ?? true,
    gateway: props.gateway,
    isCollapsed: props.isCollapsed ?? false,
    isSectionOrthographic: props.isSectionOrthographic ?? false,
    onExitEditMode: () => {
      probe.exits += 1;
    },
    onGeometryChanged: (wallId) => {
      probe.geometryChanges.push(wallId);
    },
    overlayElement,
    selectedWallIds: props.selectedWallIds,
    wallId: props.wallId,
  });

  useEffect(() => {
    probe.state = model.state;
  });

  return <WallGeometryEditor overlayRef={setOverlayElement} state={model.state} />;
}

/** Bộ mẫu chuẩn A14 vào store, ngăn xếp hoàn tác về 0 ngay sau đó. */
function seedStore(): void {
  const store = useStore.getState();

  store.setActiveFloor(FLOOR_ID);
  store.setSpatial(normalizeSpatial(createCleanBuildingScenario().graph), 'v-nghiem-thu');
  useStore.temporal.getState().clear();
  resetCommitRun();
}

function renderWired(props: WiredEditorProps): RenderResult {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <WiredEditor {...props} />
    </QueryClientProvider>,
  );
}

/** Lớp giữa của lớp phủ — chỗ `onPointerMove`/`onPointerUp` của một phiên kéo gắn. */
function overlayOf(container: HTMLElement): Element {
  const overlay = container.querySelector(`[aria-label="${TEXT.dimensionChain.regionLabel}"]`);

  if (overlay === null) {
    throw new Error('Lớp phủ chưa dựng ra vùng nhận con trỏ của phiên kéo.');
  }

  return overlay;
}

/** Giá trị đang hiện trong một ô toạ độ của bảng đỉnh — thứ NGƯỜI DÙNG đọc được. */
function cellValue(result: RenderResult, axisLabel: string, vertexCode: string): string {
  const field = result.getByLabelText(`${axisLabel} ${vertexCode}`);

  return (field as HTMLInputElement).value;
}

/** Toạ độ đỉnh đang kéo, đọc từ hai ô của bảng đỉnh. */
const draggedVertexOnScreen = (result: RenderResult): string =>
  `x=${cellValue(result, TEXT.vertexTable.columnX, DRAGGED_VERTEX_CODE)} · ` +
  `y=${cellValue(result, TEXT.vertexTable.columnY, DRAGGED_VERTEX_CODE)}`;

/** Bức tường như MÔ HÌNH ĐÃ LƯU đang giữ nó — phía mặt bằng 2D đọc. */
function wallInStore(wallId: string) {
  const entity = useStore.getState().spatial?.byId[wallId];

  if (entity === undefined || !('centreline' in entity)) {
    throw new Error(`Không còn tường ${wallId} trong store.`);
  }

  return entity;
}

/** Khoảng lùi đã LƯU của cửa trên tường chủ — con số mà lệnh kéo ghi lại. */
function openingOffsetMm(): number {
  const door = useStore.getState().spatial?.byId[DOOR_ID];

  if (door === undefined || !('offsetMm' in door)) {
    throw new Error(`Không còn cửa ${DOOR_ID} trong store.`);
  }

  return door.offsetMm;
}

/** Vị trí tương đối của cửa trên tường chủ, đọc bằng đúng hàm tầng lệnh dùng. */
function doorRelativePosition(): number {
  const graph = useStore.getState().spatial;
  const wall = wallInStore(WALL_ID);
  const door = graph?.byId[DOOR_ID];
  const level = graph?.byId[FLOOR_ID];

  if (door === undefined || level === undefined) {
    throw new Error('Bộ mẫu không còn đủ cửa và tầng để đo vị trí tương đối.');
  }

  if (!('offsetMm' in door) || !('elevationMm' in level)) {
    throw new Error('Mã cửa hoặc mã tầng của bộ mẫu đã trỏ sang loại đối tượng khác.');
  }

  return toAttachedOpening(door, toSolidWall(wall, level)).relativePosition;
}

/**
 * Một sự kiện con trỏ MANG THEO TOẠ ĐỘ.
 *
 * jsdom chưa cài `PointerEvent`, nên `fireEvent.pointerMove` rơi về `Event`
 * trần và `clientX`/`clientY` không bao giờ tới được hàm xử lý — lớp phủ nhận
 * `NaN` và ném ngay trong `Scale.pixelsToMillimetres`. `MouseEvent` thì jsdom
 * có đủ, và React đọc `pointermove` từ chính nó, nên đây là lượt kéo THẬT chứ
 * không phải một lượt gọi tay vào hàm xử lý.
 */
const pointerEventAt = (type: string, xPx: number, yPx: number): MouseEvent =>
  new MouseEvent(type, { bubbles: true, clientX: xPx, clientY: yPx });

/** Kéo đỉnh `end` của tường 0 qua đúng `DRAG_FRAME_COUNT` khung hình rồi thả tay. */
function dragEndVertex(result: RenderResult, toXMm: number, toYMm: number): void {
  fireEvent.pointerDown(
    result.getByRole('button', { name: TEXT.handles.vertex(DRAGGED_VERTEX_CODE) }),
  );

  const overlay = overlayOf(result.container);

  for (let frame = 1; frame <= DRAG_FRAME_COUNT; frame += 1) {
    fireEvent(
      overlay,
      pointerEventAt('pointermove', DRAG_FROM_X_MM + frame * DRAG_STEP_MM, DRAG_AXIS_Y_MM),
    );
  }

  fireEvent(overlay, pointerEventAt('pointerup', toXMm, toYMm));
}

/** Số bước lịch sử của tầng lệnh và của ngăn xếp hoàn tác người dùng thật sự gõ. */
const historySteps = (history: HistoryStack): { command: number; undo: number } => ({
  command: history.undoSteps().length,
  undo: useStore.temporal.getState().pastStates.length,
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  seedStore();
});

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái THẬT, chụp từ chính hook.                                    */
/* -------------------------------------------------------------------------- */

const capturedStates = new Map<SevenState, WallGeometryEditorState>();

/** Mở lớp phủ với một đầu vào thật và giữ lại `state` mà hook trả về. */
async function captureState(
  wanted: SevenState,
  props: Omit<WiredEditorProps, 'gateway' | 'probe'>,
  provoke?: (result: RenderResult, probe: EditorProbe) => Promise<void>,
): Promise<void> {
  const probe = createProbe();
  const result = renderWired({ ...props, gateway: createCountedGateway().gateway, probe });

  await provoke?.(result, probe);

  await waitFor(() => {
    expect(probe.state?.kind, `chưa ra được trạng thái "${SEVEN_STATE_LABELS[wanted]}"`).toBe(
      wanted,
    );
  });

  capturedStates.set(wanted, probe.state as WallGeometryEditorState);

  /*
   * Chụp xong vẫn đợi lượt đọc hạ cánh trước khi gỡ màn: bỏ màn giữa chừng để
   * lại một lượt cập nhật rơi ngoài `act`, và một bộ kiểm ồn là bộ kiểm mà lời
   * cảnh báo thật sự tiếp theo sẽ không ai đọc.
   */
  await waitFor(() => {
    expect(probe.state?.kind).not.toBe('loading');
  });

  result.unmount();
}

/** Trạng thái đã chụp, hoặc một lời từ chối rõ ràng thay cho một `undefined` lặng lẽ. */
function stateOf(state: SevenState): WallGeometryEditorState {
  const captured = capturedStates.get(state);

  if (captured === undefined) {
    throw new Error(`Chưa chụp được trạng thái "${SEVEN_STATE_LABELS[state]}".`);
  }

  return captured;
}

beforeAll(async () => {
  seedStore();

  const single = { selectedWallIds: [WALL_ID], wallId: WALL_ID };

  await captureState('empty', { selectedWallIds: [], wallId: null });
  await captureState('loading', single);
  await captureState('collapsed', { ...single, isCollapsed: true });
  await captureState('forbidden', { ...single, canEdit: false });
  await captureState('success', single);
  await captureState('partial', { selectedWallIds: [WALL_ID, OTHER_WALL_ID], wallId: WALL_ID });
  /*
   * `error` là KẾT LUẬN CỦA DỮ LIỆU THẬT, không phải một cờ: bộ mẫu A14 xếp
   * tường `n` lên tầng `n % 4`, nên hai bức tường cùng tầng không bao giờ chạm
   * đầu mút nhau và không đầu mút nào của tường 0 nằm trong một nút nối. Xoá
   * một đỉnh như thế là một lượt ghi tầng nghiệp vụ TỪ CHỐI, kèm câu giải thích
   * của chính nó — đúng đường mà `forceState` cố ý không dựng.
   */
  await captureState('error', single, async (result, probe) => {
    await waitFor(() => {
      expect(probe.state?.kind).toBe('success');
    });

    /* Chọn một đỉnh trước — nút "Xoá đỉnh" chỉ bật lên khi đã có đỉnh đang chọn. */
    fireEvent.click(result.getByRole('button', { name: vertexDisplayCode(0) }));

    /* Lượt ghi là BẤT ĐỒNG BỘ; `act` giữ lời từ chối rơi vào trong lượt kiểm. */
    await act(async () => {
      fireEvent.click(result.getByRole('button', { name: TEXT.tools.removeVertex.label }));
    });
  });
});

/* -------------------------------------------------------------------------- */
/* [G1..G4] Bốn bộ khẳng định dùng chung.                                      */
/* -------------------------------------------------------------------------- */

describe('[G] bốn bộ khẳng định dùng chung', () => {
  it('[G1] expectSevenStates — bảy trên bảy, không trạng thái nào ra màn trắng', () => {
    const rendered: SevenState[] = [];

    expectSevenStates((scenario) => {
      const state = scenario.state as SevenState;
      const { container, unmount } = render(<WallGeometryEditor state={stateOf(state)} />);

      rendered.push(state);

      return { container, unmount };
    }, createSevenStateScenarios());

    console.log(
      `${REPORT}[G1] expectSevenStates = ${String(rendered.length)}/${String(SEVEN_STATES.length)} — ` +
        rendered.map((state) => SEVEN_STATE_LABELS[state]).join(', '),
    );

    expect(rendered).toStrictEqual([...SEVEN_STATES]);
  });

  it('[G2] expectAccessible — bàn phím là đường đi hạng nhất trên cả bảy (R-72 / A12)', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<WallGeometryEditor state={stateOf(state)} />);

      expect(() => {
        expectAccessible(container);
      }, `trạng thái "${SEVEN_STATE_LABELS[state]}" hỏng khả năng tiếp cận`).not.toThrow();

      unmount();
    }

    console.log(`${REPORT}[G2] expectAccessible = ${String(SEVEN_STATES.length)}/7 trạng thái`);
  });

  it('[G3] expectVietnamese — không sót tiếng Anh, không mất dấu, trên cả bảy (R-72)', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<WallGeometryEditor state={stateOf(state)} />);

      expect(() => {
        expectVietnamese(container);
      }, `trạng thái "${SEVEN_STATE_LABELS[state]}" còn chuỗi chưa phải tiếng Việt có dấu`).not.toThrow();

      unmount();
    }

    console.log(`${REPORT}[G3] expectVietnamese = ${String(SEVEN_STATES.length)}/7 trạng thái`);
  });

  it('[G4] expectNoRawColor — cả thư mục màn, màu chỉ đến từ token (A1)', () => {
    expect(() => {
      expectNoRawColor(SCREEN_DIR);
    }).not.toThrow();

    console.log(`${REPORT}[G4] expectNoRawColor = 0 mã màu thô trong ${SCREEN_DIR}`);
  });
});

/* -------------------------------------------------------------------------- */
/* [N1] Một phiên kéo = ĐÚNG MỘT bước hoàn tác.                                */
/* -------------------------------------------------------------------------- */

describe('[N1] kéo một đỉnh qua 40 khung hình', () => {
  it('sinh đúng MỘT bước lịch sử, và in ra số bước trước và sau', async () => {
    const counted = createCountedGateway();
    const probe = createProbe();
    const result = renderWired({
      gateway: counted.gateway,
      probe,
      selectedWallIds: [WALL_ID],
      wallId: WALL_ID,
    });

    await waitFor(() => {
      expect(probe.state?.kind).toBe('success');
    });

    const before = historySteps(counted.history);

    dragEndVertex(result, DRAG_TO_X_MM, DRAG_AXIS_Y_MM);

    await waitFor(() => {
      expect(probe.geometryChanges).toHaveLength(1);
    });

    const after = historySteps(counted.history);

    console.log(
      `${REPORT}[N1] khung hình kéo = ${String(DRAG_FRAME_COUNT)} · lượt xem trước = ` +
        `${String(counted.previews.length)} · lượt ghi thật = ${String(counted.commits.length)}`,
    );
    console.log(
      `${REPORT}[N1] bước lịch sử tầng lệnh: TRƯỚC = ${String(before.command)} · SAU = ` +
        `${String(after.command)} · hiệu = ${String(after.command - before.command)}`,
    );
    console.log(
      `${REPORT}[N1] bước hoàn tác người dùng: TRƯỚC = ${String(before.undo)} · SAU = ` +
        `${String(after.undo)} · hiệu = ${String(after.undo - before.undo)}`,
    );

    expect(counted.previews).toHaveLength(DRAG_FRAME_COUNT);
    expect(counted.commits).toHaveLength(1);
    expect(after.command - before.command).toBe(1);
    expect(after.undo - before.undo).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* [N2] Ô mở giữ đúng vị trí tương đối.                                        */
/* -------------------------------------------------------------------------- */

describe('[N2] cửa trên bức tường vừa kéo', () => {
  it('giữ nguyên vị trí tương đối, và in ra vị trí trước và sau', async () => {
    const counted = createCountedGateway();
    const probe = createProbe();
    const result = renderWired({
      gateway: counted.gateway,
      probe,
      selectedWallIds: [WALL_ID],
      wallId: WALL_ID,
    });

    await waitFor(() => {
      expect(probe.state?.kind).toBe('success');
    });

    const endBeforeMm = wallInStore(WALL_ID).centreline.end.x;
    const relativeBefore = doorRelativePosition();
    const offsetBeforeMm = openingOffsetMm();

    dragEndVertex(result, DRAG_TO_X_MM, DRAG_AXIS_Y_MM);

    await waitFor(() => {
      expect(probe.geometryChanges).toHaveLength(1);
    });

    const relativeAfter = doorRelativePosition();
    const endAfterMm = wallInStore(WALL_ID).centreline.end.x;
    const offsetAfterMm = openingOffsetMm();

    console.log(
      `${REPORT}[N2] đỉnh cuối ${String(endBeforeMm)} mm → ${String(endAfterMm)} mm · cửa ${DOOR_ID} ` +
        `dịch theo: offset ${String(offsetBeforeMm)} mm → ${String(offsetAfterMm)} mm`,
    );
    console.log(
      `${REPORT}[N2] vị trí tương đối TRƯỚC = ${String(relativeBefore)} · SAU = ` +
        `${String(relativeAfter)} · lệch = ${String(relativeAfter - relativeBefore)}`,
    );

    expect(endAfterMm).not.toBe(endBeforeMm);
    expect(relativeAfter).toBeCloseTo(relativeBefore, 9);
  });
});

/* -------------------------------------------------------------------------- */
/* [N3] Ba loại bắt điểm, mỗi loại một nhãn hiện trên màn.                     */
/* -------------------------------------------------------------------------- */

describe('[N3] ba loại bắt điểm', () => {
  it('gọi tên từng loại trên màn, và in ra các nhãn thật sự hiện ra', async () => {
    const counted = createCountedGateway();
    const probe = createProbe();
    const result = renderWired({
      gateway: counted.gateway,
      probe,
      selectedWallIds: [WALL_ID],
      wallId: WALL_ID,
    });

    await waitFor(() => {
      expect(probe.state?.kind).toBe('success');
    });

    const overlay = overlayOf(result.container);
    const seen = new Set<string>();

    const labelsAt = (xMm: number, yMm: number): readonly string[] => {
      fireEvent.pointerDown(
        result.getByRole('button', { name: TEXT.handles.vertex(DRAGGED_VERTEX_CODE) }),
      );
      fireEvent(overlay, pointerEventAt('pointermove', xMm, yMm));

      const onScreen = Array.from(result.container.querySelectorAll('span'))
        .map((node) => (node.textContent ?? '').trim())
        .filter((text) => Object.values(WALL_GEOMETRY_SNAP_LABELS).includes(text));

      for (const label of onScreen) {
        seen.add(label);
      }

      fireEvent.keyDown(document.body, { key: 'Escape' });

      return onScreen;
    };

    const atVertex = labelsAt(OTHER_WALL_START_X_MM, DRAG_AXIS_Y_MM);
    const atPerpendicular = labelsAt(PERPENDICULAR_X_MM, OFF_AXIS_Y_MM);
    const atGrid = labelsAt(GRID_ONLY_X_MM, DRAG_AXIS_Y_MM);

    console.log(`${REPORT}[N3] chạm đầu mút tường khác → nhãn trên màn: ${atVertex.join(' · ')}`);
    console.log(
      `${REPORT}[N3] chạm chân vuông góc     → nhãn trên màn: ${atPerpendicular.join(' · ')}`,
    );
    console.log(`${REPORT}[N3] chạm lưới               → nhãn trên màn: ${atGrid.join(' · ')}`);
    console.log(
      `${REPORT}[N3] tổng số loại bắt điểm gọi được tên = ${String(seen.size)}/` +
        `${String(WALL_GEOMETRY_SNAP_KIND_IDS.length)} — ${[...seen].join(' · ')}`,
    );
    console.log(
      `${REPORT}[N3] đặc tả gốc đòi BỐN loại; loại thứ tư "${TEXT.snap.aiTrace}" không giao được vì ` +
        'không tầng nào trong repo giữ hình học gốc của AI (supports.readOriginalTrace = ' +
        `${String(counted.gateway.supports.readOriginalTrace)}). Giao ba, và nói ra là ba.`,
    );

    for (const kindId of WALL_GEOMETRY_SNAP_KIND_IDS) {
      expect(seen, `loại bắt điểm "${kindId}" chưa bao giờ được gọi tên trên màn`).toContain(
        WALL_GEOMETRY_SNAP_LABELS[kindId],
      );
    }

    expect(seen.size).toBe(WALL_GEOMETRY_SNAP_KIND_IDS.length);
    expect(seen.has(TEXT.snap.aiTrace)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* [N4] Esc giữa lúc kéo trả đỉnh về gốc.                                      */
/* -------------------------------------------------------------------------- */

describe('[N4] Esc giữa lúc kéo', () => {
  let clock: FakeClock | null = null;

  afterEach(() => {
    clock?.restore();
    clock = null;
  });

  it('trả đỉnh về đúng toạ độ ban đầu, và in ra toạ độ trước · trong · sau', async () => {
    const counted = createCountedGateway();
    const probe = createProbe();
    const result = renderWired({
      gateway: counted.gateway,
      probe,
      selectedWallIds: [WALL_ID],
      wallId: WALL_ID,
    });

    await waitFor(() => {
      expect(probe.state?.kind).toBe('success');
    });

    const beforeDrag = draggedVertexOnScreen(result);

    fireEvent.pointerDown(
      result.getByRole('button', { name: TEXT.handles.vertex(DRAGGED_VERTEX_CODE) }),
    );

    const overlay = overlayOf(result.container);

    for (let frame = 1; frame <= DRAG_FRAME_COUNT; frame += 1) {
      fireEvent(
        overlay,
        pointerEventAt('pointermove', DRAG_FROM_X_MM + frame * DRAG_STEP_MM, DRAG_AXIS_Y_MM),
      );
    }

    const duringDrag = draggedVertexOnScreen(result);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    const afterEscape = draggedVertexOnScreen(result);
    const stepsAfterEscape = historySteps(counted.history);
    const returningBefore = probe.state !== null && 'returningHandleId' in probe.state
      ? probe.state.returningHandleId
      : null;

    clock = installFakeClock();
    await clock.advance(durationMs(WALL_GEOMETRY_MOTION.cancelDrag));

    console.log(`${REPORT}[N4] TRƯỚC khi kéo : ${beforeDrag}`);
    console.log(`${REPORT}[N4] TRONG lúc kéo : ${duringDrag}`);
    console.log(`${REPORT}[N4] SAU khi Esc   : ${afterEscape}`);
    console.log(
      `${REPORT}[N4] lượt bỏ bản nháp = ${String(counted.discards.length)} · lượt ghi thật = ` +
        `${String(counted.commits.length)} · bước lịch sử = ${String(stepsAfterEscape.command)} · ` +
        `bước hoàn tác = ${String(stepsAfterEscape.undo)} · tay nắm đang về chỗ cũ = ` +
        `${String(returningBefore)}`,
    );

    expect(duringDrag).not.toBe(beforeDrag);
    expect(afterEscape).toBe(beforeDrag);
    expect(afterEscape).toBe(
      `x=${formatCoordinate(DRAG_FROM_X_MM)} · y=${formatCoordinate(DRAG_AXIS_Y_MM)}`,
    );
    expect(counted.commits).toHaveLength(0);
    expect(stepsAfterEscape.command).toBe(0);
    expect(stepsAfterEscape.undo).toBe(0);
    expect(returningBefore).toBe(DRAGGED_VERTEX_ID);
  });
});

/* -------------------------------------------------------------------------- */
/* [N5] Sửa trong 3D ⇒ mặt bằng 2D khớp.                                       */
/* -------------------------------------------------------------------------- */

describe('[N5] sửa trong 3D ⇒ mặt bằng 2D khớp', () => {
  it('ba phía đọc ra cùng một hình học, và in ra cả ba', async () => {
    const counted = createCountedGateway();
    const probe = createProbe();
    const result = renderWired({
      gateway: counted.gateway,
      probe,
      selectedWallIds: [WALL_ID],
      wallId: WALL_ID,
    });

    await waitFor(() => {
      expect(probe.state?.kind).toBe('success');
    });

    dragEndVertex(result, DRAG_TO_X_MM, DRAG_AXIS_Y_MM);

    await waitFor(() => {
      expect(probe.geometryChanges).toHaveLength(1);
    });

    const fromGateway = await counted.gateway.readWallGeometry(WALL_ID);
    const fromStore = wallInStore(WALL_ID).centreline;
    const onScreen = draggedVertexOnScreen(result);
    const gatewayEnd = fromGateway?.vertices.find((vertex) => vertex.id === DRAGGED_VERTEX_ID);

    console.log(
      `${REPORT}[N5] cổng 3D đọc   : x=${String(gatewayEnd?.atMm.xMm)} · y=${String(gatewayEnd?.atMm.yMm)}`,
    );
    console.log(
      `${REPORT}[N5] mô hình 2D đọc: x=${String(fromStore.end.x)} · y=${String(fromStore.end.y)}`,
    );
    console.log(`${REPORT}[N5] bảng đỉnh hiện : ${onScreen}`);
    console.log(
      `${REPORT}[N5] sợi dây dựng lại khung nhìn đã kêu ${String(probe.geometryChanges.length)} lần, ` +
        `mã tường "${String(probe.geometryChanges[0])}"`,
    );

    expect(gatewayEnd?.atMm.xMm).toBe(fromStore.end.x);
    expect(gatewayEnd?.atMm.yMm).toBe(fromStore.end.y);
    expect(onScreen).toBe(
      `x=${formatCoordinate(fromStore.end.x)} · y=${formatCoordinate(fromStore.end.y)}`,
    );
    expect(probe.geometryChanges).toStrictEqual([WALL_ID]);
  });
});

/* -------------------------------------------------------------------------- */
/* [N6] `comparisonChip` luôn null.                                            */
/* -------------------------------------------------------------------------- */

describe('[N6] chip đối chiếu bản vẽ gốc', () => {
  it('luôn null ở mọi trạng thái mang nội dung, và không chip nào được vẽ', async () => {
    const chips = new Map<SevenState, string>();

    for (const state of SEVEN_STATES) {
      const captured = stateOf(state);

      chips.set(
        state,
        'comparisonChip' in captured
          ? String(captured.comparisonChip)
          : 'trạng thái không mang nội dung',
      );
    }

    const trace = await createCountedGateway().gateway.readOriginalTrace(WALL_ID);
    const { container } = render(<WallGeometryEditor state={stateOf('success')} />);

    for (const [state, chip] of chips) {
      console.log(`${REPORT}[N6] ${SEVEN_STATE_LABELS[state]} → comparisonChip = ${chip}`);
    }

    console.log(`${REPORT}[N6] readOriginalTrace = ${String(trace)}`);

    for (const chip of chips.values()) {
      expect(chip === 'null' || chip === 'trạng thái không mang nội dung').toBe(true);
    }

    expect(trace).toBeNull();
    expect(container.textContent ?? '').not.toContain('Lệch so với bản vẽ gốc');
  });
});

/* -------------------------------------------------------------------------- */
/* [R] Luật màn hình — một thẻ mở được lớp phủ, và Esc phân lớp.               */
/* -------------------------------------------------------------------------- */

describe('[R] luật màn hình', () => {
  it('[R-73] container mở được lớp phủ bằng ĐÚNG MỘT thẻ, không một dòng logic nào thêm', async () => {
    const { container, findByText } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WallGeometryEditorContainer
          onExitEditMode={() => undefined}
          selectedWallIds={[WALL_ID]}
          wallId={WALL_ID}
        />
      </QueryClientProvider>,
    );

    const notice = await findByText(TEXT.states.forbidden.viewerRole);

    console.log(
      `${REPORT}[R-73] một thẻ container dựng ra ${String(container.childElementCount)} nút gốc; ` +
        `phiên chưa có vai nào ⇒ "${notice.textContent ?? ''}"`,
    );

    expect(container.childElementCount).toBeGreaterThan(0);
  });

  it('[A11] lượt ghi bị từ chối luôn nói ra vì sao — không có từ chối im lặng', () => {
    const refused = stateOf('error');
    const explanation = 'explanation' in refused ? refused.explanation : '';
    const offending = 'offendingEdgeIds' in refused ? refused.offendingEdgeIds : [];
    const { getByText } = render(<WallGeometryEditor state={refused} />);

    console.log(
      `${REPORT}[A11] câu từ chối hiện trên màn: "${explanation}" · số cạnh được chỉ đích danh = ` +
        `${String(offending.length)}`,
    );

    expect(explanation).not.toBe('');
    expect(getByText(explanation)).toBeVisible();
  });

  it('[A12] Esc thoát chế độ sửa khi không còn lớp nào bên trên', async () => {
    const probe = createProbe();

    renderWired({
      gateway: createCountedGateway().gateway,
      probe,
      selectedWallIds: [WALL_ID],
      wallId: WALL_ID,
    });

    await waitFor(() => {
      expect(probe.state?.kind).toBe('success');
    });

    fireEvent.keyDown(document.body, { key: 'Escape' });

    console.log(
      `${REPORT}[A12] Esc ở lớp ngoài cùng ⇒ số lần thoát chế độ sửa = ${String(probe.exits)}`,
    );

    expect(probe.exits).toBe(1);
  });
});
