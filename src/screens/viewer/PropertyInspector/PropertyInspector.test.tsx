/**
 * Lượt kiểm của PANEL THANH TRA ĐỐI TƯỢNG, đã ráp ba nhánh.
 *
 * Bốn bộ khẳng định dùng chung của repo (`expectSevenStates`,
 * `expectAccessible`, `expectVietnamese`, `expectNoRawColor`) cộng năm phép
 * nghiệm thu ĐỊNH LƯỢNG mà chỉ panel đã ráp mới trả lời được:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[N1]` | đổi độ dày 220 → 330: ghi vào mô hình, dọn sạch, MỘT cú Ctrl+Z | 220 → 330 → 220 |
 * | `[N2]` | số trường hiện ra khi chọn một bức tường | ≤ 5 trường mặc định |
 * | `[N3]` | chân panel có nhảy không khi đổi tường ↔ phòng 10 lần | 0 lần nhảy |
 * | `[N4]` | ba bức tường lệch độ dày: ô độ dày hiện gì | "—", không phải 220 |
 * | `[N5]` | `expectSevenStates` | 7/7 |
 *
 * Mọi con số ấy được **in ra** khi chạy: một bản nghiệm thu cần con số thật chứ
 * không chỉ một lời khẳng định đã xanh (E.10). Chỗ nào KHÔNG chứng minh được
 * bằng máy thì bài kiểm nói thẳng là chưa chứng minh được, kèm lý do — không
 * chỗ nào được báo "đạt" cho một bước chưa chạy.
 *
 * ## Hai lối dựng, mỗi lối cho một loại câu hỏi
 *
 * - **Từ props** (`PROPERTY_INSPECTOR_SCENARIOS`) cho bốn bộ khẳng định và cho
 *   `[N5]`: `PropertyInspector` là view thuần và hợp đồng của nó nói rõ nó phải
 *   kiểm được CHỈ từ props (mục D). Đúng bảy kịch bản ấy là bảy story.
 * - **Đã nối dây** ({@link WiredInspector}) cho `[N1]`–`[N4]`: bốn câu hỏi đó
 *   nói về LỆNH, về ngăn xếp hoàn tác và về việc giao thuộc tính khi chọn
 *   nhiều — dựng props bằng tay ở đó nghĩa là tự gõ lại đúng thứ đang cần chứng
 *   minh, và một bài kiểm như vậy không kiểm gì cả (R-70).
 *
 * Đồ thị luôn là bộ mẫu chuẩn của A14 (`@/lib/testing/fixtures` — 4 tầng, 48
 * tường, 14 phòng, 248,60 m²); không dữ liệu mẫu nào được bịa ra tại chỗ.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { sampleLevelId, sampleRoomId, sampleWallId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { SpatialGraph } from '@/domain/spatial/types';
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createTestQueryClient } from '@/lib/testing/render';
import {
  createSevenStateScenarios,
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
} from '@/lib/testing/sevenStateScenarios';
import { UndoShortcuts } from '@/routes/router';
import { useStore } from '@/store';

import { PropertyInspector } from './PropertyInspector';
import {
  INSPECTED_WALL,
  INSPECTED_WALL_INDEX,
  MULTI_SELECTED_WALLS,
  PROPERTY_INSPECTOR_SCENARIOS,
  PROPERTY_INSPECTOR_STATE_NAMES,
} from './propertyInspectorScenarios';
import {
  DEFAULT_VISIBLE_FIELD_COUNT,
  DEFAULT_WALL_FIELD_IDS,
  PROPERTY_INSPECTOR_LAYOUT,
  type PropertyInspectorContainerProps,
} from './propertyInspectorTypes';
import { PROPERTY_INSPECTOR_TEXT, usePropertyInspector } from './usePropertyInspector';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

const SCREEN_DIR = 'src/screens/viewer/PropertyInspector';

/** Ba lối ra ngoài của panel; bài kiểm này không đo chúng nên chúng không làm gì. */
const noop = (): void => {
  /* không có màn nào ở phía bên kia trong bài kiểm này. */
};

/** Panel dựng từ props — đúng thứ story dựng, không store và không cổng nào. */
function renderFromProps(state: SevenState) {
  return render(<PropertyInspector state={PROPERTY_INSPECTOR_SCENARIOS[state]} />);
}

/** Panel ĐÃ NỐI DÂY: hook thật, store thật, ngăn xếp hoàn tác thật. */
function WiredInspector(
  props: Pick<PropertyInspectorContainerProps, 'selectedEntityId' | 'selectedEntityIds'> & {
    readonly canEdit?: boolean;
  },
) {
  const model = usePropertyInspector({
    canEdit: props.canEdit ?? true,
    onDismiss: noop,
    onNavigateToObject: noop,
    onOpenRuleScreen: noop,
    selectedEntityId: props.selectedEntityId,
    selectedEntityIds: props.selectedEntityIds,
  });

  return <PropertyInspector {...model} />;
}

/** Đặt bộ mẫu chuẩn A14 vào store và mở panel phải. */
function seedStore(graph: SpatialGraph): void {
  const store = useStore.getState();

  useStore.temporal.getState().clear();
  store.setActiveFloor(sampleLevelId(0));
  store.setPanelOpen('right', true);
  store.setSpatial(normalizeSpatial(graph), 'v-test');
}

interface RenderWiredOptions {
  /**
   * Đặt panel dưới {@link UndoShortcuts} — ĐÚNG component mà `src/routes/router.tsx`
   * bọc cả ba mươi route bằng, không phải một bản dựng lại của nó. Đó là điều
   * làm cho cú gõ Ctrl+Z ở `[N1.3]`/`[N1.4]` chứng minh được điều gì: registry
   * là một thực thể dùng chung của cả ứng dụng, nên binding mà component này
   * đăng ký là binding người dùng thật sẽ gõ trúng.
   */
  readonly shellKeyboard?: boolean;
}

/** Dựng panel đã nối dây và đợi lượt đọc lớp không gian xong. */
async function renderWired(selectedIds: readonly string[], options: RenderWiredOptions = {}) {
  const panel = (
    <QueryClientProvider client={createTestQueryClient()}>
      <WiredInspector
        selectedEntityId={selectedIds[0] ?? null}
        selectedEntityIds={selectedIds}
      />
    </QueryClientProvider>
  );

  const result = render(
    options.shellKeyboard === true ? <UndoShortcuts>{panel}</UndoShortcuts> : panel,
  );

  await waitFor(() => {
    expect(
      within(result.container).queryByRole('heading', { level: 3 }),
      'panel vẫn chưa rời trạng thái "đang tải"',
    ).not.toBeNull();
  });

  return result;
}

/**
 * Số DÒNG THUỘC TÍNH đang hiện trong một cây đã dựng.
 *
 * Đếm qua ô nhãn 40% của `FieldRow` — đúng một ô cho mỗi dòng — nên con số này
 * đồng thời là bằng chứng cho bề rộng nhãn cố định của CẤM TUYỆT ĐỐI số 3.
 */
function visibleRowCount(container: HTMLElement): number {
  return container.querySelectorAll('[class*="w-[40%]"]').length;
}

/** Nhãn của mọi dòng đang hiện, theo đúng thứ tự từ trên xuống. */
function visibleRowLabels(container: HTMLElement): readonly string[] {
  return Array.from(container.querySelectorAll('[class*="w-[40%]"]')).map((cell) =>
    (cell.textContent ?? '').trim(),
  );
}

/** Bức tường của bộ mẫu mà đặc tả nghiệm thu gọi là "#W-014". */
const WALL_ID = sampleWallId(INSPECTED_WALL_INDEX);

/** Độ dày ban đầu và độ dày đích của phép nghiệm thu N1. */
const THICKNESS_BEFORE_MM = INSPECTED_WALL.thicknessMm;
const THICKNESS_AFTER_MM = 330;

/** Bức tường đang nằm trong store, đọc lại sau mỗi lượt ghi. */
function wallInStore(wallId: string) {
  const entity = useStore.getState().spatial?.byId[wallId];

  if (entity === undefined || !('thicknessMm' in entity)) {
    throw new Error(`Không còn tường ${wallId} trong store.`);
  }

  return entity;
}

/**
 * Một cú Ctrl+Z THẬT.
 *
 * `document.body` chứ không phải một ô nhập: registry tắt mọi phím tắt khi con
 * trỏ đang nằm trong `<input>`, `<textarea>` hay `<select>` — người đang gõ chữ
 * thì Ctrl+Z là của ô chữ, không phải của bản vẽ. Sự kiện nổi bọt lên `window`,
 * nơi `shortcutRegistry` gắn đúng một listener duy nhất của cả ứng dụng.
 */
const pressUndo = (): void => {
  fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
};

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* [PI-1] Bốn bộ khẳng định bắt buộc.                                          */
/* -------------------------------------------------------------------------- */

describe('[PI-1] bốn bộ khẳng định dùng chung', () => {
  it('[N5] expectSevenStates — bảy trên bảy, không trạng thái nào ra màn trắng', () => {
    const rendered: SevenState[] = [];

    expectSevenStates((scenario) => {
      const state = scenario.state as SevenState;
      const { container, unmount } = renderFromProps(state);
      rendered.push(state);

      return { container, unmount };
    }, createSevenStateScenarios());

    console.log(
      `[PROPERTY-INSPECTOR][N5] expectSevenStates = ${String(rendered.length)}/${String(SEVEN_STATES.length)} — ` +
        rendered.map((state) => SEVEN_STATE_LABELS[state]).join(', '),
    );

    expect(rendered).toStrictEqual([...SEVEN_STATES]);
    expect(rendered).toHaveLength(7);
  });

  it('expectAccessible — cả bảy trạng thái (R-72 / A12)', () => {
    for (const state of PROPERTY_INSPECTOR_STATE_NAMES) {
      const { container, unmount } = renderFromProps(state);

      expect(
        () => {
          expectAccessible(container);
        },
        `trạng thái "${SEVEN_STATE_LABELS[state]}" hỏng khả năng tiếp cận`,
      ).not.toThrow();

      unmount();
    }

    console.log(
      `[PROPERTY-INSPECTOR] expectAccessible = ${String(PROPERTY_INSPECTOR_STATE_NAMES.length)}/7 trạng thái`,
    );
  });

  it('expectVietnamese — cả bảy trạng thái, không chữ Anh và không mất dấu (R-72)', () => {
    for (const state of PROPERTY_INSPECTOR_STATE_NAMES) {
      const { container, unmount } = renderFromProps(state);

      expect(
        () => {
          expectVietnamese(container);
        },
        `trạng thái "${SEVEN_STATE_LABELS[state]}" còn chuỗi chưa phải tiếng Việt có dấu`,
      ).not.toThrow();

      unmount();
    }

    console.log(
      `[PROPERTY-INSPECTOR] expectVietnamese = ${String(PROPERTY_INSPECTOR_STATE_NAMES.length)}/7 trạng thái`,
    );
  });

  it('expectNoRawColor — cả thư mục màn, màu chỉ đến từ token (A1)', () => {
    expect(() => {
      expectNoRawColor(SCREEN_DIR);
    }).not.toThrow();

    console.log(`[PROPERTY-INSPECTOR] expectNoRawColor = 0 mã màu thô trong ${SCREEN_DIR}`);
  });
});

/* -------------------------------------------------------------------------- */
/* [N2] Ngân sách năm trường.                                                  */
/* -------------------------------------------------------------------------- */

describe('[N2] số trường hiện ra khi chọn một bức tường', () => {
  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  it('đếm số dòng hiện ra trước khi mở khối gập, và in ra con số thật', async () => {
    const { container } = await renderWired([WALL_ID]);

    const labels = visibleRowLabels(container);
    const wallFieldLabels: readonly string[] = DEFAULT_WALL_FIELD_IDS.map(
      (id) => PROPERTY_INSPECTOR_TEXT.fields.wall[id],
    );
    const defaultFieldsShown = labels.filter((label) => wallFieldLabels.includes(label));

    console.log(
      `[PROPERTY-INSPECTOR][N2] tường ${WALL_ID}: ${String(labels.length)} dòng hiện ra trước khối gập — ` +
        labels.join(' | '),
    );
    console.log(
      `[PROPERTY-INSPECTOR][N2] trong đó ${String(defaultFieldsShown.length)}/${String(DEFAULT_VISIBLE_FIELD_COUNT)} là năm trường mặc định của DEFAULT_WALL_FIELD_IDS: ` +
        defaultFieldsShown.join(' | '),
    );
    console.log(
      `[PROPERTY-INSPECTOR][N2] ${String(labels.length - defaultFieldsShown.length)} dòng còn lại thuộc nhóm "Quan hệ" và nhóm "Kiểm tra" — ` +
        'strings.md §3 ghi rõ "Số ô mở" KHÔNG nằm trong năm trường mặc định.',
    );

    /* Ngân sách của CẤM TUYỆT ĐỐI số 1 tính trên năm trường mặc định của loại
     * đối tượng, đúng như `DEFAULT_WALL_FIELD_IDS` và `strings.md` §3 định
     * nghĩa. Con số tổng ở trên vẫn được in ra để người duyệt tự đối chiếu. */
    expect(defaultFieldsShown.length).toBeLessThanOrEqual(DEFAULT_VISIBLE_FIELD_COUNT);
    expect(defaultFieldsShown).toStrictEqual(wallFieldLabels);

    /* Khối gập đóng: năm dòng "Thông số nâng cao" KHÔNG được tính vào ngân sách. */
    expect(labels).not.toContain(PROPERTY_INSPECTOR_TEXT.fields.advanced.zOffset);
  });
});

/* -------------------------------------------------------------------------- */
/* [N4] Chọn nhiều: dấu gạch ngang, không bao giờ một giá trị đơn.             */
/* -------------------------------------------------------------------------- */

describe('[N4] ba bức tường lệch độ dày', () => {
  /** Ba mã tường của bộ mẫu, ba độ dày khác nhau do chính bài kiểm này đặt. */
  const MULTI_IDS = MULTI_SELECTED_WALLS.map((wall) => wall.id);

  /** Ba độ dày chuẩn của SegmentedControl — không phải số bịa, là ba lựa chọn của P5. */
  const THICKNESSES_MM = [110, 220, 330];

  beforeEach(() => {
    const scenario = createCleanBuildingScenario();

    MULTI_IDS.forEach((wallId, index) => {
      const wall = scenario.graph.walls.find((candidate) => candidate.id === wallId);

      if (wall === undefined) {
        throw new Error(`Bộ mẫu chuẩn không còn tường ${wallId}.`);
      }

      wall.thicknessMm = THICKNESSES_MM[index] ?? wall.thicknessMm;
    });

    seedStore(scenario.graph);
  });

  it('ô độ dày hiện DẤU GẠCH NGANG, không hiện 220', async () => {
    const { container } = await renderWired(MULTI_IDS);

    const thicknessLabel = PROPERTY_INSPECTOR_TEXT.fields.wall.thickness;
    const labelCell = Array.from(container.querySelectorAll('[class*="w-[40%]"]')).find(
      (cell) => (cell.textContent ?? '').trim() === thicknessLabel,
    );

    expect(labelCell, `không tìm thấy dòng "${thicknessLabel}"`).toBeDefined();

    const row = labelCell?.parentElement;
    const controlText = (row?.lastElementChild?.textContent ?? '').trim();

    console.log(
      `[PROPERTY-INSPECTOR][N4] ba tường ${MULTI_IDS.join(', ')} dày ${THICKNESSES_MM.join(' / ')} mm ` +
        `⇒ ô "${thicknessLabel}" render ra: "${controlText}"`,
    );

    expect(controlText).toBe('—');
    expect(controlText).not.toContain(String(THICKNESS_BEFORE_MM));
  });
});

/* -------------------------------------------------------------------------- */
/* [N3] Bố cục không nhảy khi đổi loại đối tượng.                              */
/* -------------------------------------------------------------------------- */

describe('[N3] đổi qua lại tường ↔ phòng mười lần', () => {
  const SWITCH_COUNT = 10;

  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  it('đo bố cục của chân panel qua mười lượt đổi, và in mọi con số đo được', async () => {
    const roomId = sampleRoomId(0);
    const rowCounts: number[] = [];
    const footerTops: number[] = [];
    const labelWidths = new Set<string>();
    const rowMinHeights = new Set<string>();
    /* Bằng chứng THAY THẾ cho phép đo pixel: chân panel có thật sự bị ghim
     * không, và vùng co giãn có thật sự là vùng các nhóm không. */
    const footerPinned: boolean[] = [];
    const scrollingRegions: number[] = [];

    for (let turn = 0; turn < SWITCH_COUNT; turn += 1) {
      const targetId = turn % 2 === 0 ? WALL_ID : roomId;
      const { container, unmount } = await renderWired([targetId]);

      rowCounts.push(visibleRowCount(container));

      const footer = container.querySelector('[class*="border-t"][class*="p-5"]');
      footerTops.push(footer instanceof HTMLElement ? footer.getBoundingClientRect().top : Number.NaN);
      footerPinned.push(footer?.parentElement?.className.includes('shrink-0') === true);
      scrollingRegions.push(container.querySelectorAll('[class*="flex-1"][class*="overflow-y-auto"]').length);

      for (const cell of container.querySelectorAll('[class*="w-[40%]"]')) {
        labelWidths.add(cell.className.includes('w-[40%]') ? '40%' : cell.className);
      }

      for (const row of container.querySelectorAll('[class*="min-h-[36px]"]')) {
        rowMinHeights.add(row.className.includes('min-h-[36px]') ? '36px' : row.className);
      }

      unmount();
    }

    const wallRows = rowCounts.filter((_count, index) => index % 2 === 0);
    const roomRows = rowCounts.filter((_count, index) => index % 2 === 1);
    const jumps = rowCounts.filter((count, index) => index > 0 && count !== rowCounts[index - 1]).length;

    console.log(
      `[PROPERTY-INSPECTOR][N3] ${String(SWITCH_COUNT)} lượt đổi — số dòng mỗi lượt: ${rowCounts.join(', ')}`,
    );
    console.log(
      `[PROPERTY-INSPECTOR][N3] tường = ${String(wallRows[0])} dòng, phòng = ${String(roomRows[0])} dòng, ` +
        `số lần số dòng đổi giữa hai lượt liên tiếp = ${String(jumps)}`,
    );
    console.log(
      `[PROPERTY-INSPECTOR][N3] bề rộng nhãn quan sát được: ${[...labelWidths].join(', ')} ` +
        `(hằng số hợp đồng: ${String(PROPERTY_INSPECTOR_LAYOUT.rowLabelWidthPercent)}%); ` +
        `chiều cao dòng quan sát được: ${[...rowMinHeights].join(', ')} ` +
        `(hằng số hợp đồng: ${String(PROPERTY_INSPECTOR_LAYOUT.rowHeightPx)}px)`,
    );
    console.log(
      `[PROPERTY-INSPECTOR][N3] offsetTop của chân panel qua ${String(SWITCH_COUNT)} lượt: ${footerTops.join(', ')} — ` +
        'CHƯA CHỨNG MINH ĐƯỢC bằng máy: jsdom không có bộ dựng bố cục nên mọi ' +
        'getBoundingClientRect() trả 0; con số này KHÔNG phải bằng chứng panel đứng yên. ' +
        'R-58: không báo "đạt" cho phép đo pixel này.',
    );
    console.log(
      `[PROPERTY-INSPECTOR][N3] BẰNG CHỨNG THAY THẾ — chân panel nằm trong khối shrink-0: ` +
        `${String(footerPinned.filter(Boolean).length)}/${String(SWITCH_COUNT)} lượt; ` +
        `số vùng "flex-1 + overflow-y-auto" (vùng DUY NHẤT được co giãn và cuộn): ` +
        `${[...new Set(scrollingRegions)].join(', ')} mỗi lượt.`,
    );

    /* Hai số đo mà CẤM TUYỆT ĐỐI số 3 nêu đích danh — bề rộng nhãn cố định,
     * chiều cao dòng cố định — đo được thật và phải là một giá trị duy nhất. */
    expect([...labelWidths]).toStrictEqual(['40%']);
    expect([...rowMinHeights]).toStrictEqual(['36px']);
    expect(PROPERTY_INSPECTOR_LAYOUT.rowLabelWidthPercent).toBe(40);
    expect(PROPERTY_INSPECTOR_LAYOUT.rowHeightPx).toBe(36);

    /* Số dòng của mỗi loại đối tượng phải ỔN ĐỊNH qua các lượt đổi: cùng một
     * loại luôn cho cùng một bố cục, nên panel không nhảy khi quay lại. */
    expect(new Set(wallRows).size).toBe(1);
    expect(new Set(roomRows).size).toBe(1);

    /* Số dòng KHÁC nhau giữa tường (7) và phòng (6) là sự thật của dữ liệu, nên
     * thứ giữ chân panel đứng yên không thể là "số dòng bằng nhau" — mà phải là
     * cấu trúc: chân panel bị ghim, vùng các nhóm là chỗ duy nhất co giãn/cuộn. */
    expect(footerPinned).toStrictEqual(Array.from({ length: SWITCH_COUNT }, () => true));
    expect([...new Set(scrollingRegions)]).toStrictEqual([1]);
  });
});

/* -------------------------------------------------------------------------- */
/* [N1] Đổi độ dày 220 → 330, dọn sạch, hoàn tác một lần.                      */
/* -------------------------------------------------------------------------- */

describe('[N1] đổi độ dày tường từ 220 sang 330', () => {
  let clock: FakeClock;

  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  afterEach(() => {
    clock?.restore();
  });

  it('bước 1 — "3D đổi ngay trong lúc kéo": in ra vì sao chưa chứng minh được', () => {
    console.log(
      '[PROPERTY-INSPECTOR][N1.1] xem trước 3D tức thời TRONG LÚC KÉO: CHƯA CHỨNG MINH ĐƯỢC. ' +
        'Mục C5 của commands.md ghi bốn chỗ chặn độc lập: draftSlice không ai sản xuất ' +
        'trong production và bị ESLint khoá ngoài src/store; không ai đọc draftOperations; ' +
        'handle.update(frame) không nhận hình học; DragPreview chỉ dành cho gizmo 3D. ' +
        'Panel vì thế phát lệnh khi giá trị ĐỨNG YÊN hết một cửa sổ ' +
        `${String(MERGE_WINDOW_MS)} ms, không phát mỗi khung hình. Không có phép đo nào ở đây báo "đạt".`,
    );

    expect(MERGE_WINDOW_MS).toBeGreaterThan(0);
  });

  it('bước 2 — lượt ghi vào mô hình: 220 → 330, và panel đọc lại đúng con số đó', async () => {
    const { container } = await renderWired([WALL_ID]);

    const before = wallInStore(WALL_ID).thicknessMm;
    const option = within(container).getByRole('radio', {
      name: new RegExp(String(THICKNESS_AFTER_MM)),
    });

    await act(async () => {
      fireEvent.click(option);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(wallInStore(WALL_ID).thicknessMm).toBe(THICKNESS_AFTER_MM);
    });

    const after = wallInStore(WALL_ID).thicknessMm;
    const commitLabel = useStore.getState().lastCommitLabel;

    console.log(
      `[PROPERTY-INSPECTOR][N1.2] ${WALL_ID}: độ dày trong mô hình ${String(before)} mm → ${String(after)} mm; ` +
        `nhãn lượt ghi = "${String(commitLabel)}"`,
    );

    expect(before).toBe(THICKNESS_BEFORE_MM);
    expect(after).toBe(THICKNESS_AFTER_MM);
    expect(commitLabel).not.toBeNull();
  });

  it('bước 3 — MỘT cú Ctrl+Z THẬT trả độ dày về 220', async () => {
    const { container } = await renderWired([WALL_ID], { shellKeyboard: true });

    const option = within(container).getByRole('radio', {
      name: new RegExp(String(THICKNESS_AFTER_MM)),
    });

    await act(async () => {
      fireEvent.click(option);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(wallInStore(WALL_ID).thicknessMm).toBe(THICKNESS_AFTER_MM);
    });

    const stepsBefore = useStore.temporal.getState().pastStates.length;

    await act(async () => {
      pressUndo();
      await Promise.resolve();
    });

    const afterUndo = wallInStore(WALL_ID).thicknessMm;
    const stepsAfter = useStore.temporal.getState().pastStates.length;

    console.log(
      `[PROPERTY-INSPECTOR][N1.3] một cú Ctrl+Z: độ dày ${String(THICKNESS_AFTER_MM)} mm → ${String(afterUndo)} mm; ` +
        `số bước trong ngăn xếp hoàn tác ${String(stepsBefore)} → ${String(stepsAfter)}`,
    );
    console.log(
      '[PROPERTY-INSPECTOR][N1.3] thứ được kiểm là CÚ GÕ PHÍM: một sự kiện keydown thật ' +
        'trên document.body, đi qua đúng một listener mà shortcutRegistry gắn, tới binding ' +
        'mà `UndoShortcuts` (src/routes/router.tsx) đăng ký — cùng component bọc cả ba mươi ' +
        'route của bảng route. Bài kiểm KHÔNG gọi thẳng useStore.temporal.undo() ở đâu cả.',
    );

    expect(afterUndo).toBe(THICKNESS_BEFORE_MM);
    expect(stepsAfter).toBe(stepsBefore - 1);
  });

  it('bước 4 — một mạch kéo trong cửa sổ gộp là MỘT bước, và một cú Ctrl+Z trả về 220', async () => {
    /* Đồng hồ giả lắp SAU lượt dựng: `waitFor` của `renderWired` chạy trên đồng
     * hồ thật, và đổi đồng hồ dưới chân nó thì lượt đọc react-query treo. */
    const { container } = await renderWired([WALL_ID], { shellKeyboard: true });

    clock = installFakeClock();
    useStore.temporal.getState().clear();

    const before = wallInStore(WALL_ID).thicknessMm;
    const wide = within(container).getByRole('radio', { name: /330/ });
    const narrow = within(container).getByRole('radio', { name: /110/ });

    await act(async () => {
      fireEvent.click(wide);
      await clock.flushMicrotasks();
    });

    await act(async () => {
      await clock.advance(Math.floor(MERGE_WINDOW_MS / 2));
      fireEvent.click(narrow);
      await clock.flushMicrotasks();
    });

    const steps = useStore.temporal.getState().pastStates.length;
    const afterDrag = wallInStore(WALL_ID).thicknessMm;

    await act(async () => {
      pressUndo();
      await clock.flushMicrotasks();
    });

    const afterUndo = wallInStore(WALL_ID).thicknessMm;

    console.log(
      `[PROPERTY-INSPECTOR][N1.4] hai lượt đổi cách nhau ${String(Math.floor(MERGE_WINDOW_MS / 2))} ms ` +
        `(cửa sổ gộp ${String(MERGE_WINDOW_MS)} ms) ⇒ ${String(steps)} bước trong ngăn xếp hoàn tác của store; ` +
        `độ dày ${String(before)} → ${String(afterDrag)} → (một cú Ctrl+Z) → ${String(afterUndo)} mm.`,
    );
    console.log(
      '[PROPERTY-INSPECTOR][N1.4] hai cửa sổ gộp nay nói cùng một câu: `commit()` ' +
        '(src/store/commit.ts) gấp một mạch ghi lại trước khi nó tới zundo, theo đúng ' +
        'điều kiện `canMergeCommands` dùng — cùng phép, cùng thực thể, cùng trường, cách ' +
        'nhau dưới MERGE_WINDOW_MS, và không lượt ghi lạ nào chen vào giữa. Con số in ra ' +
        'là con số THẬT của ngăn xếp zundo, không phải của HistoryStack.',
    );

    /* Đây là điều mục N1 đòi và trước lượt này KHÔNG chứng minh được: một mạch
     * kéo, MỘT cú gõ phím, và giá trị trở về đúng chỗ nó đứng trước khi kéo. */
    expect(before).toBe(THICKNESS_BEFORE_MM);
    expect(afterDrag).toBe(110);
    expect(steps).toBe(1);
    expect(afterUndo).toBe(THICKNESS_BEFORE_MM);
  });
});
