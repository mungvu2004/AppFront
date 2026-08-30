/**
 * Lượt kiểm của màn "Phát hiện tệp CAD".
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng bốn phép đo của bản nghiệm thu:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11 | 7/7 |
 * | `[NGHIEM-2]` | chọn CAD → hộp thoại ĐÓNG rồi panel ánh xạ mở, KHÔNG lồng hộp thoại | 0 hộp thoại còn mở |
 * | `[NGHIEM-3]` | đổi vai trò một lớp → canvas đổi màu NGAY, không bấm gửi | nét đổi trong cùng lượt |
 * | `[NGHIEM-4]` | ô màu chú giải nhận `var(--wall-…)` hợp lệ | mọi ô |
 * | `[NGHIEM-5]` | bàn phím ở hộp thoại giai đoạn 1 (A12) | tiêu điểm vào, Tab vòng, Esc đóng, tiêu điểm về nút mở |
 *
 * Hai lớp render, cố ý — cùng khuôn `ScaleCalibration.test.tsx`:
 *
 * - **Chỉ props** cho bảy trạng thái và ba bộ soát. {@link CadBranchConfirm} là
 *   một hàm của props (mục D), nên bảy trạng thái vẽ được mà không cần mạng.
 *   Dữ liệu đến từ `CadBranchConfirm.stories.tsx`, một bộ duy nhất cho cả story
 *   lẫn test: hai bộ song song là hai bộ sẽ lệch nhau (R-70).
 * - **Qua hook thật + view thật + cổng của bộ mẫu** cho hai kịch bản nghiệm thu.
 *   `useCadBranchConfirm.test.ts` đã kiểm nửa "suy nghĩ" mà không cần DOM; ở đây
 *   điều đang được kiểm là màu ấy THẬT SỰ đi ra tới nét vẽ trên DOM.
 *
 * ## Vì sao `[role="dialog"]` bị bỏ qua trong `expectAccessible`
 *
 * `Modal.Root` (`src/components/overlay/Modal.tsx`) đặt `tabIndex={-1}` và
 * `outline-none` lên chính khung hộp thoại để bẫy tiêu điểm của
 * `src/lib/input/focusTrap` nhận được tiêu điểm lập trình mà không vẽ viền —
 * đúng khuôn `CreateProjectModal.test.tsx` đã chốt. Mọi thứ BÊN TRONG hộp thoại
 * vẫn được soát đủ: `ignoreSelector` chỉ bỏ qua đúng phần tử khớp, không bỏ qua
 * con cháu của nó.
 */

import { readdirSync } from 'node:fs';
import { useState } from 'react';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatNumber } from '@/lib/format/number';
import { getFocusableElements } from '@/lib/input/focusTrap';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import { CadBranchConfirm } from './CadBranchConfirm';
import {
  CAD_MACHINE_WORDS,
  branchHandoffScenario,
  scenarioFor,
} from './CadBranchConfirm.stories';
import { CadBranchConfirmContainer } from './CadBranchConfirm.container';
import {
  CAD_SAMPLE_LAYERS,
  clearPersistedBranchChoices,
  createMockCadBranchConfirmGateway,
} from './cadBranchConfirmGateway';
import {
  IMPORT_BUTTON_LABEL,
  PRIMARY_BUTTON_LABEL,
  SECONDARY_BUTTON_LABEL,
} from './cadBranchConfirmText';
import { CAD_ALLOWED_WORDS } from './useCadBranchConfirm';

const SCREEN_DIRECTORY = 'src/screens/pipeline/CadBranchConfirm';
const PROJECT_ID = 'project-1';
const FLOOR_ID = 'L1';

/** Nhãn thật của các vùng — hằng chuỗi của `CadBranchConfirm.tsx`. */
const SCREEN_ARIA_LABEL = 'Màn phát hiện tệp CAD';
const STAGE_TWO_ARIA_LABEL = 'Ánh xạ lớp và xem trước hình học';
const AI_HANDOFF_TITLE = 'Chuyển sang nhánh nhận dạng ảnh';
const COLLAPSE_PANEL_LABEL = 'Thu gọn bảng lớp';
const EXPAND_PANEL_LABEL = 'Mở bảng lớp';

/** Nhãn thật của panel ánh xạ — hằng chuỗi của `CadLayerMappingPanel.tsx`. */
const PANEL_TITLE = 'Ánh xạ lớp từ tệp CAD';

/** Nhãn trình đọc màn hình của canvas — hằng chuỗi của `cadBranchConfirmText.ts`. */
const PREVIEW_CANVAS_LABEL =
  'xem trước hình học sẽ được nhập, tô màu theo vai trò lớp đã gán';

/** Từ nước ngoài và mã máy đọc mà `expectVietnamese` phải bỏ qua trên màn này. */
const ALLOWED_WORDS: readonly string[] = [
  ...CAD_ALLOWED_WORDS,
  ...CAD_MACHINE_WORDS,
  'AI',
  'QC',
  'AutoCAD',
  'polyline',
  'circle',
  'arc',
  'text',
];

/** Lớp bộ mẫu được đổi vai trò trong kịch bản xem trước sống: lớp tường bao. */
const WALL_LAYER = CAD_SAMPLE_LAYERS[0];

/** Nhãn vai trò "tường" — hằng chuỗi của `useCadBranchConfirm.ts`. */
const WALL_ROLE_LABEL = 'tường';

/** Token nét của lớp chưa được gán vai trò — hằng của `CadLayerPreviewCanvas.tsx`. */
const IDLE_STROKE_TOKEN = 'var(--wall-idle)';

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

/* jsdom không có `matchMedia`; `matches: false` là "không giảm chuyển động". */
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  clearPersistedBranchChoices();
});

afterEach(() => {
  cleanup();
  clearPersistedBranchChoices();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Mảng thứ hai của `expectSevenStates`.                                       */
/* -------------------------------------------------------------------------- */

/** Chỉ để thoả kiểu; props thật đến từ `scenarioFor` của story. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: scenarioFor(state).model.summary?.totalLayerCount ?? 0,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Bộ dựng của kịch bản nghiệm thu — hook thật, view thật, cổng của bộ mẫu.    */
/* -------------------------------------------------------------------------- */

/** Màn thật, đã nối: container tiêm cổng giả vào đúng chỗ cổng thật đứng. */
function renderWiredScreen(onNavigate: (path: string) => void = () => undefined) {
  return renderWithProviders(
    <CadBranchConfirmContainer
      floorId={FLOOR_ID}
      gateway={createMockCadBranchConfirmGateway()}
      onNavigate={onNavigate}
      projectId={PROJECT_ID}
    />,
  );
}

/** Chờ lượt đọc tệp đầu tiên về: hộp thoại chốt nhánh mở ra với nút thật. */
async function settleDialog(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: PRIMARY_BUTTON_LABEL })).toBeEnabled();
  });
}

/** Đi đúng đường người dùng đi: bấm "Dùng đường từ CAD" ở hộp thoại giai đoạn 1. */
async function chooseCadBranch(): Promise<void> {
  await settleDialog();
  fireEvent.click(screen.getByRole('button', { name: PRIMARY_BUTTON_LABEL }));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: PANEL_TITLE })).toBeInTheDocument();
  });
}

/**
 * Mọi màu nét đang có trên canvas xem trước, đọc thẳng từ DOM.
 *
 * Vệt bắt chuột trong suốt của mỗi thực thể bị loại ra: nó không mang màu nào và
 * không phải thứ người dùng nhìn thấy.
 */
function canvasStrokes(container: HTMLElement): readonly string[] {
  const canvas = container.querySelector(`svg[aria-label="${PREVIEW_CANVAS_LABEL}"]`);

  if (canvas === null) {
    return [];
  }

  return [...canvas.querySelectorAll('polyline')]
    .map((line) => line.getAttribute('stroke'))
    .filter((stroke): stroke is string => stroke !== null && stroke !== 'transparent');
}

/* -------------------------------------------------------------------------- */
/* [NGHIEM-1] Bảy trạng thái (A11, R-63).                                      */
/* -------------------------------------------------------------------------- */

describe('CadBranchConfirm — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <CadBranchConfirm {...scenarioFor(scenario.state)} />,
      );
      rendered += 1;
      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('trạng thái không có quyền: nút "Nhập hình học" biến MẤT, không phải mờ đi', () => {
    renderWithProviders(<CadBranchConfirm {...scenarioFor('forbidden')} />);

    expect(screen.queryByRole('button', { name: IMPORT_BUTTON_LABEL })).not.toBeInTheDocument();
  });

  it('trạng thái lỗi nói cả câu hậu quả lẫn mã máy đọc, và vẫn mở đường sang nhánh AI', () => {
    const scenario = scenarioFor('error');

    renderWithProviders(<CadBranchConfirm {...scenario} />);

    expect(screen.getAllByText(new RegExp(scenario.model.errorCode ?? '', 'u')).length).toBeGreaterThan(0);

    // Nhánh AI KHÔNG BAO GIỜ bị khoá — cấm tuyệt đối của đặc tả.
    for (const button of screen.getAllByRole('button', { name: SECONDARY_BUTTON_LABEL })) {
      expect(button).toBeEnabled();
    }
  });

  it('trạng thái thu gọn: bảng lớp thu lại, canvas xem trước vẫn còn', () => {
    renderWithProviders(<CadBranchConfirm {...scenarioFor('collapsed')} />);

    expect(screen.queryByRole('heading', { name: PANEL_TITLE })).not.toBeInTheDocument();
    expect(screen.getByLabelText(PREVIEW_CANVAS_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: EXPAND_PANEL_LABEL })).toBeInTheDocument();
  });

  it('giai đoạn 2 mở ra thì có nút thu gọn, dòng tóm tắt và nút nhập hình học', () => {
    renderWithProviders(<CadBranchConfirm {...scenarioFor('partial')} />);

    expect(screen.getByRole('button', { name: COLLAPSE_PANEL_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: IMPORT_BUTTON_LABEL })).toBeInTheDocument();
    expect(screen.getByLabelText(STAGE_TWO_ARIA_LABEL)).toBeInTheDocument();
  });

  it('hộp thoại đóng mà chưa chốt nhánh: khối bàn giao nhánh AI hiện ra, đủ hai lựa chọn', () => {
    renderWithProviders(<CadBranchConfirm {...branchHandoffScenario()} />);

    expect(screen.getByText(AI_HANDOFF_TITLE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PRIMARY_BUTTON_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SECONDARY_BUTTON_LABEL })).toBeEnabled();
  });
});

/* -------------------------------------------------------------------------- */
/* Dòng tóm tắt: chuỗi của hook, view không tự ghép số.                        */
/* -------------------------------------------------------------------------- */

describe('CadBranchConfirm — dòng tóm tắt chân màn (A15)', () => {
  it('đặt nguyên hai chuỗi đã ghép của hook xuống màn', () => {
    const scenario = scenarioFor('partial');
    const summary = scenario.model.summary;

    if (summary === null) {
      throw new Error('kịch bản "một phần" phải có dòng tóm tắt');
    }

    renderWithProviders(<CadBranchConfirm {...scenario} />);

    const line = screen.getByRole('status', { name: 'Tóm tắt số lớp đã ánh xạ' });

    expect(line).toHaveTextContent(summary.mappedCountLabel);
    expect(line).toHaveTextContent(summary.objectCountLabel);
  });
});

/* -------------------------------------------------------------------------- */
/* Khả năng tiếp cận, tiếng Việt, màu (R-72, A1).                              */
/* -------------------------------------------------------------------------- */

describe('CadBranchConfirm — khả năng tiếp cận, tiếng Việt, màu (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái đầy đủ nhất', () => {
    const { container } = renderWithProviders(<CadBranchConfirm {...scenarioFor('partial')} />);

    expectAccessible(container, { ignoreSelector: '[role="dialog"]' });
  });

  it('đi qua expectAccessible ở trạng thái lỗi, nơi hộp thoại còn mở', () => {
    const { container } = renderWithProviders(<CadBranchConfirm {...scenarioFor('error')} />);

    expectAccessible(container, { ignoreSelector: '[role="dialog"]' });
  });

  it('mọi chuỗi hiển thị của giai đoạn 2 là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<CadBranchConfirm {...scenarioFor('partial')} />);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS });
  });

  it('mọi chuỗi hiển thị của trạng thái lỗi cũng là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<CadBranchConfirm {...scenarioFor('error')} />);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS });
  });

  it('không mã màu thô trong bất kỳ file nào của thư mục màn (A1)', () => {
    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      expectNoRawColor(`${SCREEN_DIRECTORY}/${file}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Ô màu chú giải nhận một token CSS hợp lệ.                        */
/* -------------------------------------------------------------------------- */

describe('CadBranchConfirm — chú giải độ dày tường [NGHIEM-4]', () => {
  it('mỗi ô màu chú giải nhận đúng một `var(--wall-…)`, không phải tên trần', () => {
    const scenario = scenarioFor('partial');
    const legend = scenario.model.preview?.wallThicknessLegend ?? [];

    expect(legend.length).toBeGreaterThan(0);

    const { container } = renderWithProviders(<CadBranchConfirm {...scenario} />);
    const swatches = [...container.querySelectorAll('li > span[aria-hidden="true"]')];

    expect(swatches).toHaveLength(legend.length);

    for (const swatch of swatches) {
      const background = (swatch as HTMLElement).style.backgroundColor;

      expect(background).toMatch(/^var\(--wall-/u);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Hai giai đoạn nối tiếp, không lồng hộp thoại.                    */
/* -------------------------------------------------------------------------- */

describe('CadBranchConfirm — hai giai đoạn trong một route [NGHIEM-2]', () => {
  it('chọn nhánh CAD thì hộp thoại ĐÓNG rồi panel ánh xạ mở ra, không cái nào lồng cái nào', async () => {
    renderWiredScreen();

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await chooseCadBranch();

    // Hộp thoại rời màn hẳn — `AnimatePresence` giữ nó lại cho tới hết lượt đóng,
    // nên phép chờ ở đây là chờ lượt đóng ấy xong, không phải chờ một khung hình.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText(PREVIEW_CANVAS_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText(SCREEN_ARIA_LABEL)).toBeInTheDocument();
  });

  it('nhánh AI luôn còn đường về: bấm "Vẫn dùng AI" điều hướng sang phần cài đặt AI', async () => {
    const onNavigate = vi.fn();

    renderWiredScreen(onNavigate);
    await settleDialog();

    fireEvent.click(screen.getByRole('button', { name: SECONDARY_BUTTON_LABEL }));

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] Xem trước sống: đổi vai trò → canvas đổi màu NGAY.               */
/* -------------------------------------------------------------------------- */

describe('CadBranchConfirm — xem trước cập nhật trực tiếp [NGHIEM-3]', () => {
  it('đổi vai trò một lớp thì nét của lớp đó đổi màu ngay, không có nút gửi nào được bấm', async () => {
    if (WALL_LAYER === undefined) {
      throw new Error('bộ mẫu phải có ít nhất một lớp CAD');
    }

    const { container } = renderWiredScreen();

    await chooseCadBranch();

    // Trước khi gán: mọi lớp còn ở vai trò "bỏ qua", nên mọi nét là nét chờ.
    const before = canvasStrokes(container);

    expect(before.length).toBeGreaterThan(0);
    expect(new Set(before)).toEqual(new Set([IDLE_STROKE_TOKEN]));

    // Đúng đường người dùng đi: mở Select vai trò của hàng, chọn "tường".
    fireEvent.click(
      screen.getByRole('combobox', { name: `vai trò của lớp ${WALL_LAYER.name}` }),
    );
    fireEvent.click(await screen.findByRole('option', { name: WALL_ROLE_LABEL }));

    // Không một nút "gửi" nào tồn tại giữa hai bước: nét đổi ngay sau lượt gán.
    await waitFor(() => {
      expect(canvasStrokes(container)).toContain('var(--wall-330)');
    });
  });

  it('dòng tóm tắt chạy theo lượt gán, và số của nó là số của hook', async () => {
    if (WALL_LAYER === undefined) {
      throw new Error('bộ mẫu phải có ít nhất một lớp CAD');
    }

    renderWiredScreen();
    await chooseCadBranch();

    const line = screen.getByRole('status', { name: 'Tóm tắt số lớp đã ánh xạ' });

    expect(line).toHaveTextContent(
      `Đã ánh xạ ${formatNumber(0)}/${formatNumber(CAD_SAMPLE_LAYERS.length)} lớp`,
    );

    fireEvent.click(
      screen.getByRole('combobox', { name: `vai trò của lớp ${WALL_LAYER.name}` }),
    );
    fireEvent.click(await screen.findByRole('option', { name: WALL_ROLE_LABEL }));

    await waitFor(() => {
      expect(line).toHaveTextContent(
        `${formatNumber(WALL_LAYER.entityCount)} đối tượng sẽ được nhập`,
      );
    });
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-5] Bàn phím ở hộp thoại giai đoạn 1 (A12).                          */
/* -------------------------------------------------------------------------- */

/**
 * Bảo đảm bàn phím của hộp thoại đến từ `Modal.Root` dùng chung
 * (`createFocusTrap` + `useShortcut` scope `'dialog'`), và L2-A cố ý KHÔNG bẫy
 * tiêu điểm lần thứ hai ở màn này. Thừa hưởng là đúng về cài đặt, nhưng lời hứa
 * của A12 phải được đo TẠI ĐÂY: một màn có thể vô tình phá nó bằng một nút mọc
 * ngoài khung hộp thoại hay một lượt đóng bỏ quên tiêu điểm.
 *
 * Ba điều kiện kỹ thuật của khối này:
 *
 * - **Nhường một khung hình trước mọi khẳng định về tiêu điểm.** `Modal.tsx:66-67`
 *   gọi `trap.activate()` trong `requestAnimationFrame`, nên trước khung hình đó
 *   tiêu điểm chưa vào hộp thoại. `nextFrame` chép đúng cách của
 *   `src/components/overlay/Modal.test.tsx:10` — không hằng thời gian viết tay (R-71).
 * - **Mở màn từ một nút THẬT.** Đó là cách một màn khác mở màn này (R-73), và là
 *   thứ duy nhất làm câu hỏi "tiêu điểm quay về đâu" có nghĩa: bẫy tiêu điểm ghi
 *   nhớ `document.activeElement` lúc `activate()`, nên phải có một phần tử đang
 *   giữ tiêu điểm trước khi hộp thoại mở.
 * - **Hỏi `getFocusableElements` chứ không tự viết bộ chọn.** Đó chính là hàm bẫy
 *   tiêu điểm dùng để quyết định Tab đi đâu (`src/lib/input/focusTrap.ts`), nên
 *   test đọc đúng danh sách mà mã chạy đọc, không dựng một bản sao sẽ lệch.
 *
 * Khẳng định (a) dừng ở mức "tiêu điểm nằm TRONG hộp thoại", cố ý không nêu tên
 * nút: `activate()` hiện lấy phần tử focus được đầu tiên, và đóng đinh nút ấy vào
 * test là khoá lại một hành vi còn phải đổi — xem chú thích đầu
 * `CadBranchConfirmDialog.tsx` về prop `initialFocus` còn thiếu của `Modal.Root`.
 */

/** Đúng một khung hình thật — `activate()` của bẫy tiêu điểm chạy ở khung kế. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Nhãn nút mở màn trong khuôn dựng dưới đây — nút này thuộc về test, không thuộc màn. */
const OPENER_BUTTON_LABEL = 'mở hộp thoại chốt nhánh';

/**
 * Khuôn dựng đúng hình một màn khác mở màn này: một nút, và màn chỉ được gắn
 * sau khi nút ấy được bấm.
 */
function CadBranchConfirmOpener({ onNavigate }: { readonly onNavigate: (path: string) => void }) {
  const [isScreenOpen, setIsScreenOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsScreenOpen(true)}>
        {OPENER_BUTTON_LABEL}
      </button>

      {isScreenOpen && (
        <CadBranchConfirmContainer
          floorId={FLOOR_ID}
          gateway={createMockCadBranchConfirmGateway()}
          onNavigate={onNavigate}
          projectId={PROJECT_ID}
        />
      )}
    </>
  );
}

/**
 * Mở màn đúng đường bàn phím đi: đưa tiêu điểm vào nút mở rồi kích hoạt nó, chờ
 * hộp thoại có nút thật, rồi nhường một khung hình cho bẫy tiêu điểm.
 */
async function openScreenFromButton(onNavigate: (path: string) => void = () => undefined): Promise<{
  readonly opener: HTMLElement;
  readonly dialog: HTMLElement;
}> {
  renderWithProviders(<CadBranchConfirmOpener onNavigate={onNavigate} />);

  const opener = screen.getByRole('button', { name: OPENER_BUTTON_LABEL });

  opener.focus();
  expect(document.activeElement).toBe(opener);

  fireEvent.click(opener);
  await settleDialog();

  await act(async () => {
    await nextFrame();
  });

  return { opener, dialog: screen.getByRole('dialog') };
}

describe('CadBranchConfirm — bàn phím ở hộp thoại chốt nhánh [NGHIEM-5]', () => {
  it('mở màn ở giai đoạn 1 thì tiêu điểm đi vào trong hộp thoại, không ở lại nền phía sau', async () => {
    const { opener, dialog } = await openScreenFromButton();

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(opener);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('Tab đi vòng TRONG hộp thoại, không thoát ra nút phía sau', async () => {
    const { opener, dialog } = await openScreenFromButton();

    const focusable = getFocusableElements(dialog);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (first === undefined || last === undefined) {
      throw new Error('hộp thoại chốt nhánh phải có phần tử nhận tiêu điểm được');
    }

    // Nút mở nằm NGOÀI hộp thoại, nên nó không được có mặt trong vòng Tab.
    expect(focusable).not.toContain(opener);

    // Từ phần tử cuối, Tab vòng về phần tử đầu — không sang nút mở phía sau.
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });

    expect(document.activeElement).toBe(first);

    // Và chiều ngược lại: Shift+Tab từ phần tử đầu vòng về phần tử cuối.
    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(last);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('bấm Esc thì hộp thoại đóng mà KHÔNG chốt nhánh nào', async () => {
    const onNavigate = vi.fn();
    const { dialog } = await openScreenFromButton(onNavigate);

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Không nhánh nào được chốt: panel ánh xạ của nhánh CAD không mở ra, và
    // không lượt điều hướng nào sang nhánh AI được gọi.
    expect(screen.queryByRole('heading', { name: PANEL_TITLE })).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();

    // Màn không trắng (A11) và vẫn còn ĐÚNG HAI lựa chọn để chốt lại.
    expect(screen.getByText(AI_HANDOFF_TITLE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PRIMARY_BUTTON_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SECONDARY_BUTTON_LABEL })).toBeEnabled();
  });

  it('đóng hộp thoại thì tiêu điểm quay về đúng nút đã mở nó', async () => {
    const { opener, dialog } = await openScreenFromButton();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await act(async () => {
      await nextFrame();
    });

    expect(document.activeElement).toBe(opener);
  });
});
