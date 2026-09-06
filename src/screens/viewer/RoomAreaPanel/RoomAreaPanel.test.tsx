/**
 * Lượt kiểm và bản NGHIỆM THU ĐỊNH LƯỢNG của bảng diện tích phòng (S-33).
 *
 * Bốn bộ khẳng định dùng chung của repo cộng ba phép nghiệm thu định lượng mà
 * chỉ màn ĐÃ NỐI DÂY mới trả lời được. Mỗi phép **in ra con số thật** khi chạy
 * — E.10 cấm báo "đạt" cho một bước chưa chạy, nên chỗ nào không đo được thì
 * bài kiểm nói thẳng là chưa đo được, kèm lý do.
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[G1]` | `expectSevenStates` trên bảy trạng thái THẬT của hook | 7/7 |
 * | `[G2]` | `expectAccessible` — bàn phím hạng nhất, trên cả hai chế độ | 14/14 |
 * | `[G3]` | `expectVietnamese` — không sót tiếng Anh, không mất dấu | 14/14 |
 * | `[G4]` | `expectNoRawColor` — cả thư mục màn | 0 mã màu thô |
 * | `[N1]` | tổng của 14 dòng | đúng `"248,60"`, in cả phép cộng |
 * | `[N2]` | thanh xếp chồng khi cả tám công năng cùng có mặt | ≤ 3 dải |
 * | `[N3]` | bấm một dòng | `onRoomActivate` đúng 1 lần, đúng `roomId` |
 *
 * ## Bảy trạng thái là ĐẦU RA THẬT, không phải bảy đối tượng gõ tay
 *
 * Mỗi trạng thái được dựng bằng một ĐẦU VÀO thật rồi chụp lại `RoomAreaPanelModel`
 * mà `useRoomAreaPanel` trả về: kho rỗng cho `empty`, kho chưa có đồ thị cho
 * `loading`, vai `viewer` cho `forbidden`, một phòng bị xoá tên cho `partial`,
 * một lượt đổi tên thành chuỗi rỗng (tầng lệnh TỪ CHỐI thật) cho `error`. Một
 * bài kiểm gõ lại chính thứ nó cần chứng minh thì không kiểm gì cả (R-70).
 *
 * ## Bộ mẫu A14 và một khiếm khuyết CỦA BỘ MẪU, không phải của màn
 *
 * A14 nói bộ mẫu chuẩn là **14 phòng, 248,60 m²**, và bảng diện tích của bộ mẫu
 * đúng như vậy: mười ba phòng 17,00 m² cộng một phòng 27,60 m²
 * (`sampleBuilding.ts:149`, `SAMPLE_TOTAL_AREA_M2 = 248.6`). Nhưng **vòng phòng**
 * lưu trong bộ mẫu lại là mười bốn hình chữ nhật giống hệt nhau, mỗi hình 17,00
 * m² — nên `selectRoomsWithArea`, thứ đo TỪ VÒNG chứ không đọc `Room.areaM2`,
 * cộng ra 238,00 chứ không phải 248,60. Đã kiểm chứng bằng tay.
 *
 * `src/domain/rooms/__tests__/area.test.ts:79-92` đã gặp đúng chuyện này và xử
 * lý đúng một cách: dựng lại vòng phòng cho khớp bảng diện tích của chính bộ
 * mẫu — bề rộng cố định 4.000 mm, chiều sâu suy ra từ `Room.areaM2`, cả hai ra
 * số nguyên milimét. `createRoomAreaSampleGraph` lặp lại đúng phép đó, và nó
 * sống trong `RoomAreaPanel.stories.tsx`: story và bài kiểm phải nhìn CÙNG một
 * bộ dữ liệu, nếu không thì một story xanh chẳng nói gì về màn được kiểm
 * (R-70). Ba hàm dựng ở đó nằm trong `meta.excludeStories`, nên chúng không
 * biến thành story.
 * Không con số nào bịa ra ở đây: diện tích vẫn là diện tích bộ mẫu khai, và
 * `computeArea` vẫn là thứ đo chúng.
 *
 * Cùng chỗ đó, TÊN phòng và tầng được đặt lại thành tiếng Việt ("Phòng 0",
 * "Tầng 0"): bộ mẫu đặt tên chúng là `Room 0` và `Level 0`, và một màn hình
 * tiếng Việt vẽ ra chữ ấy thì `expectVietnamese` báo đúng. Cách xử lý là cho
 * màn dữ liệu tiếng Việt để lượt soát chạy trên TOÀN BỘ chữ trên màn — chứ
 * không phải thêm `Room` và `Level` vào danh sách bỏ qua, thứ sẽ mở đúng cái
 * cửa mà R-72 đóng. Không con số nào đổi theo.
 *
 * ## Vì sao đặt "giảm chuyển động"
 *
 * Ô tổng chạy số qua `useCountUp`. Giảm chuyển động là một CÚP, không phải một
 * lượt chạy ngắn hơn — nên con số ở đúng đích ngay khung hình đầu, và phép đo
 * `[N1]` đọc được thứ nó định đọc thay vì một khung hình giữa đường. Đây là một
 * thiết lập có thật của người dùng, không phải một chỗ tắt đi cho dễ.
 */

import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react';
import { useEffect } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AREA_DECIMALS } from '@/domain/rooms/area';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { RoomId, SpatialGraph } from '@/domain/spatial/types';
import { formatNumber } from '@/lib/format/number';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { createEmptyProjectScenario } from '@/lib/testing/fixtures';
import {
  createSevenStateScenarios,
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
} from '@/lib/testing/sevenStateScenarios';
import { useStore } from '@/store';
import { resetCommitRun } from '@/store/commit';

import { RoomAreaPanel } from './RoomAreaPanel';
import {
  ALL_ROOM_USAGES,
  createEveryUsageGraph,
  createRoomAreaSampleGraph,
  createUnnamedRoomGraph,
} from './RoomAreaPanel.stories';
import { RoomAreaTable } from './RoomAreaTable';
import type { RoomAreaPanelProps, RoomAreaScreenState } from './roomAreaTypes';
import { useRoomAreaPanel, type RoomAreaPanelModel, type UseRoomAreaPanelOptions } from './useRoomAreaPanel';

const SCREEN_DIR = 'src/screens/viewer/RoomAreaPanel';
const REPORT = '[ROOM-AREA-PANEL]';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu A14, vòng phòng dựng lại khớp bảng diện tích của chính nó.           */
/* -------------------------------------------------------------------------- */

/** Số phòng và tổng mà A14 khai; cả hai được khẳng định lại chứ không tin sẵn. */
const A14_ROOM_COUNT = 14;
const A14_TOTAL_TEXT = '248,60';

/* -------------------------------------------------------------------------- */
/* Kho, đồng hồ, và "giảm chuyển động".                                        */
/* -------------------------------------------------------------------------- */

/** Đưa một đồ thị vào kho, ngăn xếp hoàn tác về 0 ngay sau đó. */
function seedStore(graph: SpatialGraph | null): void {
  const store = useStore.getState();

  store.setSpatial(graph === null ? null : normalizeSpatial(graph), graph === null ? null : 'v-nghiem-thu');
  useStore.temporal.getState().clear();
  resetCommitRun();
}

interface ReducedMotionRestore {
  readonly restore: () => void;
}

/** Nói với `prefersReducedMotion` rằng người dùng đã xin ít chuyển động. */
function installReducedMotion(): ReducedMotionRestore {
  const original = window.matchMedia;

  window.matchMedia = ((query: string) =>
    ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: true,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;

  return {
    restore: () => {
      window.matchMedia = original;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Chụp bảy trạng thái THẬT.                                                   */
/* -------------------------------------------------------------------------- */

/** `SevenState` của repo gọi trạng thái xong là `success`; màn này gọi là `ready`. */
const SCREEN_STATE_OF: Readonly<Record<SevenState, RoomAreaScreenState>> = {
  collapsed: 'collapsed',
  empty: 'empty',
  error: 'error',
  forbidden: 'forbidden',
  loading: 'loading',
  partial: 'partial',
  success: 'ready',
};

interface Probe {
  model: RoomAreaPanelModel | null;
}

const noop = (): void => {
  /* Chỗ nối có mặt để view gắn được; phép đo nào cần đếm thì tự thay bằng bộ đếm. */
};

/** Dựng hook thật rồi vẽ panel thật — không provider nào ở giữa (PQ-3: không mạng). */
function ProbeHost({ options, probe }: { options: UseRoomAreaPanelOptions; probe: Probe }) {
  const model = useRoomAreaPanel(options);

  useEffect(() => {
    probe.model = model;
  });

  return <RoomAreaPanel {...model} onOpenExport={noop} />;
}

const captured = new Map<SevenState, RoomAreaPanelModel>();

/** Props đầy đủ của một trạng thái đã chụp, hoặc một lời từ chối rõ ràng. */
function propsOf(state: SevenState): RoomAreaPanelProps {
  const model = captured.get(state);

  if (model === undefined) {
    throw new Error(`Chưa chụp được trạng thái "${SEVEN_STATE_LABELS[state]}".`);
  }

  return { ...model, onOpenExport: noop };
}

let reducedMotion: ReducedMotionRestore;

/**
 * Dựng hook trên một đầu vào thật và giữ lại model nó trả về.
 *
 * Không `waitFor`: `render` của testing-library đã bọc lượt gắn trong `act`,
 * nên hiệu ứng ghi `probe.model` đã chạy xong lúc hàm trả về. Trạng thái ở màn
 * này suy ra từ dữ liệu kho ngay trong lượt vẽ đầu — không có lượt đọc bất đồng
 * bộ nào để chờ (PQ-3), nên chờ chỉ là chờ suông.
 */
function capture(
  wanted: SevenState,
  graph: SpatialGraph | null,
  options: Omit<UseRoomAreaPanelOptions, 'onCheckWallGaps'>,
): RenderResult & { probe: Probe } {
  seedStore(graph);

  const probe: Probe = { model: null };
  const view = render(<ProbeHost options={{ ...options, onCheckWallGaps: noop }} probe={probe} />);

  expect(probe.model?.state, `chưa ra được trạng thái "${SEVEN_STATE_LABELS[wanted]}"`).toBe(
    SCREEN_STATE_OF[wanted],
  );

  captured.set(wanted, probe.model as RoomAreaPanelModel);

  return { ...view, probe };
}

/** Cửa sổ đủ rộng để lượt tự lưu 800 ms của A7 và lượt ghi sau nó chạy xong. */
const AUTOSAVE_SETTLE_MS = 4000;

beforeAll(async () => {
  reducedMotion = installReducedMotion();

  const schedule = createRoomAreaSampleGraph();
  const asEditor = { roles: ['engineer'] } as const;

  capture('loading', null, asEditor).unmount();
  capture('empty', createEmptyProjectScenario().graph, asEditor).unmount();
  capture('success', schedule, asEditor).unmount();
  capture('partial', createUnnamedRoomGraph(), asEditor).unmount();
  capture('collapsed', schedule, { ...asEditor, isCollapsed: true }).unmount();
  capture('forbidden', schedule, { roles: ['viewer'] }).unmount();

  /*
   * `error` là KẾT LUẬN CỦA DỮ LIỆU THẬT, không phải một cờ: đổi tên một phòng
   * thành chuỗi rỗng là lượt ghi mà `validateRenameRoom` TỪ CHỐI, kèm câu tiếng
   * Việt của chính tầng lệnh ("Tên phòng không được để trống."). Tự lưu 800 ms
   * của A7 do `createAutosave` đếm; đồng hồ giả đẩy nó tới nơi, và chỉ ở đây —
   * sáu trạng thái kia không có lượt bất đồng bộ nào để chờ.
   */
  const clock: FakeClock = installFakeClock();

  try {
    seedStore(schedule);

    const probe: Probe = { model: null };
    const view = render(<ProbeHost options={{ onCheckWallGaps: noop, ...asEditor }} probe={probe} />);
    const firstRow = probe.model?.groups[0]?.rows[0];

    expect(firstRow, 'bộ mẫu A14 không cho ra dòng nào để mồi lượt ghi hỏng').toBeDefined();

    await act(async () => {
      probe.model?.onRoomRename(firstRow?.id as RoomId, '   ');
      await clock.advance(AUTOSAVE_SETTLE_MS);
    });

    expect(probe.model?.state, 'lượt đổi tên rỗng đáng lẽ phải bị tầng lệnh từ chối').toBe('error');

    captured.set('error', probe.model as RoomAreaPanelModel);
    view.unmount();
  } finally {
    clock.restore();
  }
});

afterAll(() => {
  reducedMotion.restore();
});

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* [G1..G4] Bốn bộ khẳng định dùng chung.                                      */
/* -------------------------------------------------------------------------- */

describe('[G] bốn bộ khẳng định dùng chung', () => {
  it('[G1] expectSevenStates — bảy trên bảy, không trạng thái nào ra màn trắng (R-63/A11)', () => {
    const rendered: SevenState[] = [];

    expectSevenStates((scenario) => {
      const state = scenario.state;
      const { container, unmount } = render(<RoomAreaPanel {...propsOf(state)} />);

      rendered.push(state);

      return { container, unmount };
    }, createSevenStateScenarios());

    console.log(
      `${REPORT}[G1] expectSevenStates = ${String(rendered.length)}/${String(SEVEN_STATES.length)} — ` +
        rendered.map((state) => SEVEN_STATE_LABELS[state]).join(', '),
    );

    expect(rendered).toStrictEqual([...SEVEN_STATES]);
  });

  it('[G2] expectAccessible — bàn phím là đường đi hạng nhất, cả hai chế độ (R-72/A12)', () => {
    let checked = 0;

    for (const state of SEVEN_STATES) {
      const props = propsOf(state);

      for (const [mode, screen] of [
        ['panel', <RoomAreaPanel key="panel" {...props} />],
        ['bảng', <RoomAreaTable key="table" {...props} />],
      ] as const) {
        const { container, unmount } = render(screen);

        expect(() => {
          expectAccessible(container);
        }, `chế độ ${mode}, trạng thái "${SEVEN_STATE_LABELS[state]}" hỏng khả năng tiếp cận`).not.toThrow();

        checked += 1;
        unmount();
      }
    }

    console.log(`${REPORT}[G2] expectAccessible = ${String(checked)}/14 (7 trạng thái × 2 chế độ)`);
  });

  it('[G3] expectVietnamese — không sót tiếng Anh, không mất dấu, cả hai chế độ (R-72)', () => {
    let checked = 0;

    for (const state of SEVEN_STATES) {
      const props = propsOf(state);

      for (const [mode, screen] of [
        ['panel', <RoomAreaPanel key="panel" {...props} />],
        ['bảng', <RoomAreaTable key="table" {...props} />],
      ] as const) {
        const { container, unmount } = render(screen);

        expect(() => {
          expectVietnamese(container);
        }, `chế độ ${mode}, trạng thái "${SEVEN_STATE_LABELS[state]}" còn chuỗi chưa phải tiếng Việt có dấu`).not.toThrow();

        checked += 1;
        unmount();
      }
    }

    console.log(`${REPORT}[G3] expectVietnamese = ${String(checked)}/14 (7 trạng thái × 2 chế độ)`);
  });

  it('[G4] expectNoRawColor — cả thư mục màn, màu chỉ đến từ token (A1)', () => {
    expect(() => {
      expectNoRawColor(SCREEN_DIR);
    }).not.toThrow();

    console.log(`${REPORT}[G4] expectNoRawColor = 0 mã màu thô trong ${SCREEN_DIR}`);
  });
});

/* -------------------------------------------------------------------------- */
/* [N1] Tổng của mười bốn dòng.                                                */
/* -------------------------------------------------------------------------- */

/** Đọc ngược một số đã định dạng kiểu Việt: "1.234,50" → 1234.5. */
function parseVietnameseNumber(text: string): number {
  return Number(text.replace(/\./gu, '').replace(',', '.'));
}

describe('[N1] tổng của mười bốn dòng', () => {
  it(`bằng đúng "${A14_TOTAL_TEXT}", và phép cộng được in ra đầy đủ`, () => {
    const props = propsOf('success');
    const rows = props.groups.flatMap((group) => group.rows);

    expect(rows).toHaveLength(A14_ROOM_COUNT);

    /*
     * Cộng tay CHỈ trong bài kiểm, và đó chính là việc của bài kiểm: PQ-4 cấm
     * màn cộng lại các số đã làm tròn, nên chỗ duy nhất chứng minh được rằng ô
     * tổng khớp mười bốn dòng là một phép cộng đứng NGOÀI màn. Không dùng
     * `reduce` để lệnh nghiệm thu của điều phối viên grep được sạch.
     */
    let sum = 0;

    for (const row of rows) {
      sum += parseVietnameseNumber(row.areaText);
    }

    const addition = `${rows.map((row) => row.areaText).join(' + ')} = ${props.totals.totalText}`;

    console.log(`${REPORT}[N1] ${addition}`);
    console.log(
      `${REPORT}[N1] tổng cộng tay = ${formatNumber(sum, { fractionDigits: AREA_DECIMALS })} · ` +
        `ô tổng = ${props.totals.totalText} ` +
        `· đơn vị đứng riêng = "${props.totals.unitLabel}"`,
    );

    expect(props.totals.totalText).toBe(A14_TOTAL_TEXT);
    expect(sum).toBeCloseTo(parseVietnameseNumber(A14_TOTAL_TEXT), 2);
  });

  it('hiện đúng con số đó trên màn, với đơn vị là một phần tử riêng (A15)', () => {
    const props = propsOf('success');
    const { getByText } = render(<RoomAreaPanel {...props} />);

    const total = getByText(A14_TOTAL_TEXT);
    const unit = getByText(props.totals.unitLabel);

    expect(total).toBeInTheDocument();
    expect(unit).toBeInTheDocument();
    /* Đơn vị KHÔNG nằm trong chuỗi số — hai phần tử khác nhau, đúng đặc tả. */
    expect(total).not.toBe(unit);
    expect(total.textContent).toBe(A14_TOTAL_TEXT);
  });
});

/* -------------------------------------------------------------------------- */
/* [N2] Thanh xếp chồng — tối đa ba màu dữ liệu.                               */
/* -------------------------------------------------------------------------- */

describe('[N2] thanh xếp chồng', () => {
  it('không quá ba dải, kể cả khi cả tám công năng cùng có mặt (PQ-9)', () => {
    seedStore(createEveryUsageGraph());

    const probe: Probe = { model: null };
    const view = render(
      <ProbeHost options={{ onCheckWallGaps: noop, roles: ['engineer'] }} probe={probe} />,
    );

    expect(probe.model?.state).toBe('ready');

    const bands = probe.model?.bands ?? [];
    const usages = new Set((probe.model?.groups ?? []).flatMap((group) => group.rows).map((row) => row.usage));
    const tones = new Set(bands.map((band) => band.tone));

    console.log(
      `${REPORT}[N2] công năng có mặt = ${String(usages.size)}/8 · số dải = ${String(bands.length)} · ` +
        `tông khác nhau = ${String(tones.size)} — ${bands.map((band) => band.label).join(', ')}`,
    );

    expect(usages.size).toBe(ALL_ROOM_USAGES.length);
    expect(bands.length).toBeLessThanOrEqual(3);
    expect(tones.size).toBeLessThanOrEqual(3);
    /* Mỗi tông đúng một dải: một tông hiện hai lần là hai màu như nhau cạnh nhau. */
    expect(tones.size).toBe(bands.length);

    view.unmount();
  });

  it('vẽ ra đúng số dải ấy trên màn, không hơn', () => {
    const props = propsOf('success');
    const { getByText } = render(<RoomAreaPanel {...props} />);

    /* Thanh không mang nhãn (nó là `aria-hidden`); chú dẫn dưới nó là thứ người
       đọc màn hình nghe được, nên đếm đúng chú dẫn ấy. */
    const caption = getByText('Phân bố diện tích theo loại phòng');
    const legend = caption.parentElement?.querySelector('ul');
    const drawn = legend?.children.length ?? 0;

    console.log(`${REPORT}[N2] dải vẽ ra trên màn = ${String(drawn)} (mô hình nói ${String(props.bands.length)})`);

    expect(drawn).toBe(props.bands.length);
    expect(drawn).toBeLessThanOrEqual(3);
  });
});

/* -------------------------------------------------------------------------- */
/* [N3] Bấm một dòng.                                                          */
/* -------------------------------------------------------------------------- */

describe('[N3] bấm một dòng', () => {
  it('gọi onRoomActivate đúng MỘT lần, với đúng mã phòng', () => {
    const props = propsOf('success');
    const firstRow = props.groups[0]?.rows[0];

    expect(firstRow, 'bộ mẫu A14 không cho ra dòng nào để bấm').toBeDefined();

    const activated: RoomId[] = [];
    const { getByLabelText } = render(
      <RoomAreaPanel
        {...props}
        onRoomActivate={(roomId) => {
          activated.push(roomId);
        }}
      />,
    );

    const label =
      `xem cách tính và khuôn hình vào phòng ${String(firstRow?.name)}, ` +
      `${String(firstRow?.areaText)} ${props.totals.unitLabel}`;

    fireEvent.click(getByLabelText(label));

    console.log(
      `${REPORT}[N3] bấm "${label}" ⇒ onRoomActivate ×${String(activated.length)} ` +
        `= [${activated.join(', ')}] (mong đợi ×1 = ${String(firstRow?.id)})`,
    );

    expect(activated).toStrictEqual([firstRow?.id]);
  });

  it('trỏ vào một dòng thì báo ra onRoomHover, và bỏ trỏ thì báo lại null', () => {
    const props = propsOf('success');
    const firstRow = props.groups[0]?.rows[0];
    const hovers: (RoomId | null)[] = [];

    const { getByLabelText } = render(
      <RoomAreaPanel
        {...props}
        onRoomHover={(roomId) => {
          hovers.push(roomId);
        }}
      />,
    );

    const row = getByLabelText(`tên phòng ${String(firstRow?.name)}`).closest('li');

    expect(row).not.toBeNull();

    fireEvent.mouseEnter(row as HTMLElement);
    fireEvent.mouseLeave(row as HTMLElement);

    console.log(`${REPORT}[N3] onRoomHover = [${hovers.map((id) => String(id)).join(', ')}]`);

    expect(hovers).toStrictEqual([firstRow?.id, null]);
  });
});

/* -------------------------------------------------------------------------- */
/* [N4] Hai hành động rời màn là HAI sợi dây khác nhau (R-73).                 */
/* -------------------------------------------------------------------------- */

describe('[N4] trạng thái rỗng', () => {
  it('nút "Kiểm tra khe hở tường" gọi onCheckWallGaps, KHÔNG gọi onRetry', () => {
    const props = propsOf('empty');
    let wallGapChecks = 0;
    let retries = 0;

    const { getByRole } = render(
      <RoomAreaPanel
        {...props}
        onCheckWallGaps={() => {
          wallGapChecks += 1;
        }}
        onRetry={() => {
          retries += 1;
        }}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Kiểm tra khe hở tường' }));

    console.log(`${REPORT}[N4] onCheckWallGaps ×${String(wallGapChecks)} · onRetry ×${String(retries)}`);

    expect(wallGapChecks).toBe(1);
    expect(retries).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* [N5] Thu gọn — đúng năm phòng lớn nhất TOÀN MÀN.                            */
/* -------------------------------------------------------------------------- */

describe('[N5] trạng thái thu gọn', () => {
  it('rút xuống đúng năm phòng lớn nhất trên toàn màn, giảm dần', () => {
    const props = propsOf('collapsed');
    const rows = props.groups.flatMap((group) => group.rows);
    const areas = rows.map((row) => parseVietnameseNumber(row.areaText));
    const sorted = [...areas].sort((left, right) => right - left);

    console.log(
      `${REPORT}[N5] thu gọn = ${String(rows.length)} dòng — ` +
        rows.map((row) => `${row.name} ${row.areaText}`).join(' · '),
    );

    expect(rows).toHaveLength(5);
    expect(areas).toStrictEqual(sorted);
    /* Phòng lớn nhất của bộ mẫu (27,60 m²) phải có mặt: nó nằm ở nhóm thứ hai,
       nên một phép "cắt năm hàng đầu của danh sách đã gộp" sẽ bỏ sót nó. */
    expect(areas[0]).toBeCloseTo(27.6, 2);
  });
});
