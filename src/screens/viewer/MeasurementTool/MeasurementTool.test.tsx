/**
 * Lượt kiểm cấp màn của `MeasurementTool`.
 *
 * `MeasurementTool.tsx`, `MeasurementOverlay.tsx`, `MeasurementSnapChip.tsx`,
 * `measurementToolScenarios.ts`, `useMeasurementTool.ts` và
 * `MeasurementTool.container.tsx` CHƯA tồn tại trong worktree này — bốn worker
 * khác đang viết chúng song song, từ cùng hợp đồng `measurementToolTypes.ts`.
 * File này vì vậy ĐỎ ngay ở import `./MeasurementTool` cho tới khi lớp gộp nối
 * các nhánh lại; đó là kết quả ĐÚNG của lượt này (không phải `.skip`, không nới
 * điều kiện — R-70). Cùng khuôn `ExplodedView.test.tsx` / `OverlayComparison.test.tsx`:
 * chỉ props, không hook, không mạng (mục D).
 *
 * ## Ba hành động bàn phím — chốt sau một câu hỏi giữa chừng
 *
 * Đặc tả gốc đòi kiểm `M`/`Esc`/`Enter`/`Delete`, nhưng `MeasurementToolProps`
 * ban đầu không có chỗ nào cho ba hành động đầu (không `registry`, không
 * `onPin`, không `onEscape`, không `onToggleTool`) — khác hẳn khuôn
 * `ObjectSearch` (tiêm `registry?: ShortcutRegistry` thẳng vào component) và
 * khuôn `PropertyInspector` (`[N8]` kiểm phím thật trên bản ĐÃ NỐI DÂY, không
 * phải trên view thuần). Đã hỏi điều phối viên; hợp đồng được sửa (commit
 * `500c47a` trên `mungvu2004/measure-prep-contract`) để thêm
 * `onToggleTool`/`onEscape`/`onPin`, và câu trả lời chốt: phím tắt thuộc HOOK
 * (đăng ký qua `shortcutRegistry`), còn view chỉ nhận ba hàm ấy qua props. Mục
 * "Phím tắt" dưới đây vì vậy tách làm hai phần đúng như được yêu cầu:
 *
 * 1. TỪ PROPS — trên `<MeasurementTool>` thuần, phải xanh ngay khi view-overlay
 *    gộp vào (không phụ thuộc hook/container).
 * 2. PHÍM THẬT — trên `<MeasurementTool.container>` ĐÃ NỐI DÂY, đúng khuôn
 *    `PropertyInspector.test.tsx` mục `[N8]`. Phần này còn đỏ xa hơn phần 1 —
 *    nó chờ cả `useMeasurementTool.ts` lẫn `MeasurementTool.container.tsx`,
 *    cả hai đều thuộc lớp gộp/hook-core, không thuộc worker này.
 */

import { existsSync, readFileSync } from 'node:fs';

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { millimetres } from '@/domain/units/types';
import { createShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { SEVEN_STATES, SEVEN_STATE_LABELS, type SevenStateScenario } from '@/lib/testing/sevenStateScenarios';

import { MeasurementList } from './MeasurementList';
import { MeasurementTool } from './MeasurementTool';
import { MeasurementToolContainer } from './MeasurementTool.container';
import {
  MEASURE_MODE_LABELS,
  SNAP_KIND_LABELS,
  SNAP_KINDS,
  type DraftMeasurement,
  type MeasurementScreenState,
  type MeasurementToolProps,
  type PinnedMeasurement,
  type PinnedMeasurementId,
  type SnapIndicator,
  type SnapKind,
} from './measurementToolTypes';
import { measurementToolScenarioFor } from './measurementToolScenarios';

/* -------------------------------------------------------------------------- */
/* Bộ dựng — props tối thiểu hợp lệ, đúng hình dạng `MeasurementToolProps`.    */
/* -------------------------------------------------------------------------- */

/** Bảy trạng thái của màn này, theo đúng thứ tự CONTRACT.md mục 5. */
const MEASUREMENT_STATES: readonly MeasurementScreenState[] = [
  'empty',
  'measuring',
  'partial',
  'error',
  'ready',
  'forbidden',
  'collapsed',
];

/** Ánh xạ bảy trạng thái CHUNG (thư viện test) sang bảy trạng thái RIÊNG của màn đo. */
const STATE_BY_GENERIC: Readonly<Record<(typeof SEVEN_STATES)[number], MeasurementScreenState>> = {
  empty: 'empty',
  loading: 'measuring',
  partial: 'partial',
  error: 'error',
  success: 'ready',
  forbidden: 'forbidden',
  collapsed: 'collapsed',
};

function pinnedMeasurement(id: string, overrides: Partial<PinnedMeasurement> = {}): PinnedMeasurement {
  return {
    id: `MS-${id}` as PinnedMeasurementId,
    name: `Phép đo ${id}`,
    mode: 'pointToPoint',
    valueLabel: '3,45 m',
    rawValueMm: millimetres(3450),
    displayValue: 3.45,
    displayFractionDigits: 2,
    unitSuffix: 'm',
    points: [
      { x: millimetres(0), y: millimetres(0) },
      { x: millimetres(3450), y: millimetres(0) },
    ],
    screenPoints: [
      { x: 120, y: 80 },
      { x: 320, y: 80 },
    ],
    visible: true,
    stale: false,
    staleReason: null,
    ...overrides,
  };
}

function buildDraft(overrides: Partial<DraftMeasurement> = {}): DraftMeasurement {
  return {
    mode: 'pointToPoint',
    points: [{ x: millimetres(0), y: millimetres(0) }],
    valueLabel: null,
    screenPoints: [{ x: 120, y: 80 }],
    cursorPx: { x: 140, y: 90 },
    snap: { kind: null, label: 'chưa bắt điểm nào' },
    ...overrides,
  };
}

function buildProps(overrides: Partial<MeasurementToolProps> = {}): MeasurementToolProps {
  return {
    state: 'ready',
    mode: 'pointToPoint',
    onModeChange: vi.fn(),
    snap: { kind: null, label: 'chưa bắt điểm nào' },
    draft: null,
    measurements: [],
    countLabel: '0 phép đo',
    highlightedId: null,
    onHighlight: vi.fn(),
    onToggleVisibility: vi.fn(),
    onDelete: vi.fn(),
    onToggleTool: vi.fn(),
    onEscape: vi.fn(),
    onPin: vi.fn(),
    unit: 'mm',
    onUnitChange: vi.fn(),
    unitJustChanged: false,
    canPin: true,
    pinBlockedCaption: null,
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    errorMessage: null,
    onRetry: vi.fn(),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* [1] [A11, R-63] Bảy trạng thái.                                             */
/* -------------------------------------------------------------------------- */

function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => {
    const props = measurementToolScenarioFor(STATE_BY_GENERIC[state]);

    return {
      state,
      label: SEVEN_STATE_LABELS[state],
      rows: [],
      totalCount: props.measurements.length,
      isLoading: state === 'loading',
      isCollapsed: state === 'collapsed',
      canView: state !== 'forbidden',
      error: null,
    };
  });
}

describe('MeasurementTool — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const props = measurementToolScenarioFor(STATE_BY_GENERIC[scenario.state]);
      const { container, unmount } = renderWithProviders(<MeasurementTool {...props} />);

      rendered += 1;

      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });
});

/* -------------------------------------------------------------------------- */
/* [2, 3] [R-72] Khả năng tiếp cận và tiếng Việt.                              */
/* -------------------------------------------------------------------------- */

describe('MeasurementTool — khả năng tiếp cận, tiếng Việt (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái xong', () => {
    const { container } = renderWithProviders(<MeasurementTool {...measurementToolScenarioFor('ready')} />);

    expectAccessible(container);
  });

  it('mọi chuỗi hiển thị ở trạng thái xong là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<MeasurementTool {...measurementToolScenarioFor('ready')} />);

    expectVietnamese(container);
  });

  it('mọi chuỗi hiển thị ở trạng thái một phần cũng là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<MeasurementTool {...measurementToolScenarioFor('partial')} />);

    expectVietnamese(container);
  });

  it('mọi chuỗi hiển thị ở trạng thái đang đo cũng là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<MeasurementTool {...measurementToolScenarioFor('measuring')} />);

    expectVietnamese(container);
  });
});

/* -------------------------------------------------------------------------- */
/* [4] expectNoRawColor + không dùng đỏ/vàng cho đường đo (điều cấm).         */
/* -------------------------------------------------------------------------- */

describe('MeasurementTool — không dùng đỏ hay vàng cho đường đo (điều cấm)', () => {
  it('measurementToolScenarios.ts không chứa mã màu thô', () => {
    expectNoRawColor('src/screens/viewer/MeasurementTool/measurementToolScenarios.ts');
  });

  it('view/overlay/chip không dùng token trạng thái đỏ (violation) hay vàng (attention) cho đường đo, chấm cần chú ý', () => {
    const candidateFiles = [
      'src/screens/viewer/MeasurementTool/MeasurementTool.tsx',
      'src/screens/viewer/MeasurementTool/MeasurementOverlay.tsx',
      'src/screens/viewer/MeasurementTool/MeasurementSnapChip.tsx',
    ];
    const existing = candidateFiles.filter((filePath) => existsSync(filePath));

    if (existing.length === 0) {
      // Cả ba file thuộc worker khác (view-overlay), CHƯA tồn tại tại thời điểm
      // viết bài kiểm này — đúng dự kiến (xem docblock đầu file). Ghi rõ để
      // không ai đọc nhầm 0 file quét = đã kiểm xong (E.10).
      console.log(
        '[MEASUREMENT-TOOL] chưa có file view/overlay nào để quét màu đỏ/vàng — chờ view-overlay gộp vào.',
      );
      return;
    }

    const FORBIDDEN_COLOR_PATTERN =
      /state-violation|state-attention|(?:text|bg|border|stroke|fill|ring|outline|from|via|to)-(?:red|yellow|amber)(?:-[0-9]{2,3})?/i;

    for (const filePath of existing) {
      const source = readFileSync(filePath, 'utf8');
      const match = FORBIDDEN_COLOR_PATTERN.exec(source);

      expect(match, `${filePath} dùng token màu đỏ/vàng bị cấm cho đường đo: "${String(match?.[0])}"`).toBeNull();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [5] Chip bắt điểm luôn gọi tên loại — kể cả khi kind === null.              */
/* -------------------------------------------------------------------------- */

describe('MeasurementTool — chip bắt điểm luôn gọi tên loại, kể cả khi chưa bắt được gì', () => {
  const cases: ReadonlyArray<{ readonly kind: SnapKind | null; readonly label: string }> = [
    { kind: 'vertex', label: SNAP_KIND_LABELS.vertex },
    { kind: 'midpoint', label: SNAP_KIND_LABELS.midpoint },
    { kind: 'axisIntersection', label: SNAP_KIND_LABELS.axisIntersection },
    { kind: null, label: 'chưa bắt điểm nào' },
  ];

  it.each(cases)('kind=$kind: chip hiện đúng nhãn "$label"', ({ kind, label }) => {
    const snap: SnapIndicator = { kind, label };
    const props = buildProps({ state: 'measuring', draft: buildDraft({ snap }), snap });

    const { getByText } = renderWithProviders(<MeasurementTool {...props} />);

    expect(getByText(label)).toBeInTheDocument();
  });

  it('ba loại bắt điểm của SNAP_KINDS đều có nhãn khác rỗng, không loại nào bị bỏ sót', () => {
    for (const kind of SNAP_KINDS) {
      expect(SNAP_KIND_LABELS[kind].length).toBeGreaterThan(0);
    }

    expect(SNAP_KINDS).toHaveLength(3);
  });
});

/* -------------------------------------------------------------------------- */
/* [6] Giá trị ĐANG ĐO không chạy số.                                          */
/* -------------------------------------------------------------------------- */

describe('MeasurementTool — giá trị đang đo không chạy số (điều cấm)', () => {
  it('draft.valueLabel đổi giữa hai lần render thì chuỗi hiện ra đổi NGAY, không qua giá trị trung gian', () => {
    const propsA = buildProps({
      state: 'measuring',
      draft: buildDraft({ valueLabel: '1,20 m' }),
    });
    const propsB: MeasurementToolProps = { ...propsA, draft: buildDraft({ valueLabel: '3,45 m' }) };

    const { getByText, queryByText, rerender } = renderWithProviders(<MeasurementTool {...propsA} />);

    expect(getByText('1,20 m')).toBeInTheDocument();

    rerender(<MeasurementTool {...propsB} />);

    // Đổi NGAY, không đi qua giá trị trung gian nào — không dùng act/advance
    // timer nào ở giữa, đọc DOM đúng lúc rerender() vừa trả về.
    expect(getByText('3,45 m')).toBeInTheDocument();
    expect(queryByText('1,20 m')).not.toBeInTheDocument();
  });

  it('draft.valueLabel === null (mới đặt một điểm) không ném lỗi và không hiện chữ rác', () => {
    const props = buildProps({ state: 'measuring', draft: buildDraft({ valueLabel: null }) });

    expect(() => {
      renderWithProviders(<MeasurementTool {...props} />);
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* [7] unitJustChanged === true là chỗ DUY NHẤT được chạy số.                  */
/* -------------------------------------------------------------------------- */

describe('MeasurementTool — unitJustChanged là chỗ DUY NHẤT được chạy số (điều cấm)', () => {
  it('unitJustChanged=false: đổi displayValue của một hàng đã ghim (không đổi id) vẫn hiện valueLabel MỚI ngay lập tức, không có khung hình trung gian', () => {
    const rowBefore = pinnedMeasurement('1', {
      valueLabel: '1,20 m',
      displayValue: 1.2,
      unitSuffix: 'm',
      displayFractionDigits: 2,
    });
    const rowAfter: PinnedMeasurement = { ...rowBefore, valueLabel: '5,60 m', displayValue: 5.6 };

    const propsBefore = buildProps({
      measurements: [rowBefore],
      countLabel: '1 phép đo',
      unitJustChanged: false,
    });
    const propsAfter: MeasurementToolProps = { ...propsBefore, measurements: [rowAfter] };

    const { getByText, queryByText, rerender } = renderWithProviders(<MeasurementTool {...propsBefore} />);

    expect(getByText('1,20 m')).toBeInTheDocument();

    rerender(<MeasurementTool {...propsAfter} />);

    expect(getByText('5,60 m')).toBeInTheDocument();
    expect(queryByText('1,20 m')).not.toBeInTheDocument();
  });

  it('không kịch bản chuẩn nào trong bảy trạng thái mang unitJustChanged=true — đó là một nhịp thoáng qua do hook bật, không phải một trạng thái màn hình lâu dài', () => {
    for (const state of MEASUREMENT_STATES) {
      const props = measurementToolScenarioFor(state);

      expect(
        props.unitJustChanged,
        `kịch bản "${state}" không phải chuyển tiếp đổi đơn vị — unitJustChanged phải là false`,
      ).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [8] Phím tắt (A12) — tách hai phần theo chốt của điều phối viên.           */
/* -------------------------------------------------------------------------- */

describe('MeasurementTool — bốn hành động PHẢI có đường chuột, không chỉ phím (A12, TỪ PROPS)', () => {
  it('nút "bật/tắt công cụ" gọi onToggleTool (phím M)', () => {
    const onToggleTool = vi.fn();
    const props = buildProps({ onToggleTool });

    renderWithProviders(<MeasurementTool {...props} />);

    const button = screen.getByRole('button', { name: /công cụ/iu });

    fireEvent.click(button);

    expect(onToggleTool).toHaveBeenCalledTimes(1);
  });

  it('nút "thoát chế độ" gọi onEscape khi đang đo dở (phím Esc)', () => {
    const onEscape = vi.fn();
    const props = buildProps({
      state: 'measuring',
      draft: buildDraft({ valueLabel: '2,00 m' }),
      onEscape,
    });

    renderWithProviders(<MeasurementTool {...props} />);

    const button = screen.getByRole('button', { name: /thoát/iu });

    fireEvent.click(button);

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('nút "ghim" gọi onPin khi đang có phần đo dở dang và canPin (phím Enter)', () => {
    const onPin = vi.fn();
    const props = buildProps({
      state: 'measuring',
      draft: buildDraft({ valueLabel: '2,00 m' }),
      canPin: true,
      onPin,
    });

    renderWithProviders(<MeasurementTool {...props} />);

    const button = screen.getByRole('button', { name: /ghim/iu });

    fireEvent.click(button);

    expect(onPin).toHaveBeenCalledTimes(1);
  });

  it('nút xoá trên hàng đang chọn gọi onDelete(id đúng hàng đó) (phím Delete)', () => {
    const onDelete = vi.fn();
    const row = pinnedMeasurement('7');
    const props = buildProps({
      measurements: [row],
      countLabel: '1 phép đo',
      highlightedId: row.id,
      onDelete,
    });

    // Nút xoá sống ở mục "Phép đo" của panel phải (`MeasurementList.tsx:150`,
    // aria-label `Xoá <tên>`), không ở lớp phủ trên canvas. Hook cắm danh sách
    // ấy vào `inspectorSections` của vỏ, nên `<MeasurementTool>` — vốn chỉ là
    // phần nằm trong `renderScene` — không chứa nó. Bản trước của khẳng định
    // này dựng nhầm component; ý định (hành động xoá phải có đường cho con trỏ,
    // A12) giữ nguyên, chỉ hỏi đúng chỗ nó ở.
    renderWithProviders(
      <MeasurementList
        canPin={props.canPin}
        collapsed={props.collapsed}
        countLabel={props.countLabel}
        highlightedId={props.highlightedId}
        measurements={props.measurements}
        onDelete={props.onDelete}
        onHighlight={props.onHighlight}
        onToggleCollapsed={props.onToggleCollapsed}
        onToggleVisibility={props.onToggleVisibility}
        onUnitChange={props.onUnitChange}
        pinBlockedCaption={props.pinBlockedCaption}
        unit={props.unit}
      />,
    );

    const button = screen.getByRole('button', { name: /xoá|xóa/iu });

    fireEvent.click(button);

    expect(onDelete).toHaveBeenCalledWith(row.id);
  });
});

describe('MeasurementTool — bốn phím THẬT trên bản đã nối dây (A12, SẼ ĐỎ tới khi lớp gộp viết xong container)', () => {
  it('mount container đăng ký đủ bốn tổ hợp M/Escape/Enter/Delete ở phạm vi canvas', () => {
    const registry = createShortcutRegistry({ isDev: false });

    renderWithProviders(
      <MeasurementToolContainer projectId="P-1" registry={registry} forceState="measuring" />,
    );

    const canvasCombos = registry
      .listShortcuts()
      .filter((shortcut) => shortcut.scope === 'canvas')
      .map((shortcut) => shortcut.combo);

    // `listShortcuts()` trả tổ hợp ĐÃ CHUẨN HOÁ, không phải chuỗi đã đăng ký:
    // `combo: entry.canonical` (shortcutRegistry.ts:570-578), với
    // `canonical = formatCombo(parseCombo(...))`, và `parseCombo` gọi
    // `normaliseKey` — hàm này viết hoa mọi tên phím (tools/shortcuts.ts:49-55).
    // Nên 'Escape' KHÔNG BAO GIỜ xuất hiện; dạng thật là 'ESCAPE'. Bản trước của
    // khẳng định này mong sai một sự thật về registry chứ không mong sai về màn —
    // ý định (đủ bốn phím ở phạm vi canvas) giữ nguyên. 'M' do vỏ đăng ký.
    for (const expectedCombo of ['M', 'ESCAPE', 'ENTER', 'DELETE']) {
      expect(
        canvasCombos,
        `thiếu tổ hợp "${expectedCombo}" ở phạm vi canvas — hiện có: ${canvasCombos.join(', ')}`,
      ).toContain(expectedCombo);
    }
  });

  it('Esc của công cụ đo nằm ở phạm vi canvas, KHÔNG nuốt Esc của một lớp trên nó — A12 vẫn đóng lớp trên cùng trước', () => {
    const registry = createShortcutRegistry({ isDev: false });

    renderWithProviders(
      <MeasurementToolContainer projectId="P-1" registry={registry} forceState="measuring" />,
    );

    // Mô phỏng một lớp trên cùng thật (hộp thoại) đã claim phạm vi 'dialog' —
    // theo SCOPE_PRIORITY, 'dialog' luôn thắng 'canvas'. Nếu công cụ đo lỡ đăng
    // ký Esc ở phạm vi 'dialog' hay 'global' (thay vì 'canvas'), khẳng định này
    // sẽ lộ ra: closeTopLayer của lớp trên sẽ KHÔNG được gọi.
    const dialogEscape = vi.fn();

    registry.register({
      id: 'test.dialog.escape',
      combo: 'Escape',
      scope: 'dialog',
      onTrigger: dialogEscape,
    });

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(dialogEscape).toHaveBeenCalledTimes(1);
  });

  it('gỡ đăng ký khi rời cây: bốn phím thật sau khi unmount không còn tác dụng', () => {
    const registry = createShortcutRegistry({ isDev: false });

    const { unmount } = renderWithProviders(
      <MeasurementToolContainer projectId="P-1" registry={registry} forceState="measuring" />,
    );

    unmount();

    const canvasCombos = registry
      .listShortcuts()
      .filter((shortcut) => shortcut.scope === 'canvas')
      .map((shortcut) => shortcut.combo);

    expect(canvasCombos).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* [9] Trạng thái forbidden: vẫn đo được, chỉ không ghim được.                 */
/* -------------------------------------------------------------------------- */

describe('MeasurementTool — trạng thái không có quyền vẫn đo được, chỉ không ghim được (trạng thái 6)', () => {
  it('kịch bản chuẩn "forbidden": canPin=false, pinBlockedCaption khác null', () => {
    const props = measurementToolScenarioFor('forbidden');

    expect(props.canPin).toBe(false);
    expect(props.pinBlockedCaption).not.toBeNull();
    expect((props.pinBlockedCaption ?? '').length).toBeGreaterThan(0);
  });

  it('pinBlockedCaption hiện ra trên màn, và viên thuốc đổi chế độ đo vẫn bấm được (vẫn đo được)', () => {
    const props = measurementToolScenarioFor('forbidden');
    const { container, getByText } = renderWithProviders(<MeasurementTool {...props} />);

    expect(getByText(props.pinBlockedCaption ?? '')).toBeInTheDocument();

    // "Vẫn đo được": ít nhất một nút đổi chế độ (tên khớp một trong bốn nhãn chế
    // độ của MEASURE_MODE_LABELS) phải tồn tại và KHÔNG bị disabled.
    // `SegmentedControl` dựng một `radiogroup` chứa các `radio`
    // (components/ui/SegmentedControl.tsx:66,109), không phải các `button` —
    // đó là vai ARIA đúng cho một bộ chọn loại trừ nhau. Bản trước của khẳng
    // định này hỏi sai vai; ý định (chế độ đo vẫn đổi được ở trạng thái
    // forbidden) giữ nguyên.
    const modeButtons = within(container)
      .getAllByRole('radio')
      .filter((button) => Object.values(MEASURE_MODE_LABELS).some((label) => button.textContent?.includes(label)));

    expect(modeButtons.length, 'phải có ít nhất một nút đổi chế độ đo hiện trên màn').toBeGreaterThan(0);

    for (const button of modeButtons) {
      expect(button, 'nút đổi chế độ đo không được vô hiệu ở trạng thái forbidden').not.toBeDisabled();
    }
  });

  it('nút "ghim" (nếu hiện) bị vô hiệu, hoặc bấm nó KHÔNG gọi onPin, ở trạng thái forbidden', () => {
    const onPin = vi.fn();
    const props = buildProps({
      state: 'forbidden',
      draft: buildDraft({ valueLabel: '2,00 m' }),
      canPin: false,
      pinBlockedCaption: 'không có quyền ghim số đo trong dự án này',
      onPin,
    });

    renderWithProviders(<MeasurementTool {...props} />);

    const pinButton = screen.queryByRole('button', { name: /ghim/iu });

    if (pinButton === null) {
      // Chấp nhận: màn có thể ẩn hẳn nút ghim thay vì hiện-nhưng-vô-hiệu.
      expect(onPin).not.toHaveBeenCalled();
      return;
    }

    fireEvent.click(pinButton);

    expect(onPin).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* [10] Trỏ vào một hàng đã ghim: hàng đó tô sáng, số đo khác mờ xuống 0,3.    */
/* -------------------------------------------------------------------------- */

function elementsWithOpacity(container: HTMLElement, opacity: string): readonly HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[style]')).filter(
    (element) => element.style.opacity === opacity,
  );
}

describe('MeasurementTool — trỏ vào một hàng đã ghim: hàng đó tô sáng, số đo khác mờ xuống 0,3', () => {
  it('highlightedId trỏ vào một hàng trong ba hàng: đúng hai hàng còn lại mờ xuống opacity 0,3', () => {
    const rowA = pinnedMeasurement('1');
    const rowB = pinnedMeasurement('2');
    const rowC = pinnedMeasurement('3');

    const props = buildProps({
      measurements: [rowA, rowB, rowC],
      countLabel: '3 phép đo',
      highlightedId: rowB.id,
    });

    const { container } = renderWithProviders(<MeasurementTool {...props} />);

    const dimmed = elementsWithOpacity(container, '0.3');

    expect(dimmed).toHaveLength(2);
  });

  it('highlightedId === null: không hàng nào mờ xuống 0,3', () => {
    const rowA = pinnedMeasurement('1');
    const rowB = pinnedMeasurement('2');
    const rowC = pinnedMeasurement('3');

    const props = buildProps({
      measurements: [rowA, rowB, rowC],
      countLabel: '3 phép đo',
      highlightedId: null,
    });

    const { container } = renderWithProviders(<MeasurementTool {...props} />);

    expect(elementsWithOpacity(container, '0.3')).toHaveLength(0);
  });
});
