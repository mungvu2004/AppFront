/**
 * Bộ kiểm của `EditorTour` — lớp dạy việc sáu bước, chạy đè lên màn QC và 3D.
 *
 * Hợp đồng đông cứng (mục 3 của `CONTRACT.md`) nói `EditorTour.tsx` là view
 * THUẦN: nhận `EditorTourProps` đã tính sẵn, không tự đọc registry, không tự dò
 * neo. Vì vậy bộ kiểm này có hai nửa:
 *
 * - **Nửa view** (bảy trạng thái, tiếp cận, tiếng Việt, không chặn, giảm
 *   chuyển động) dựng thẳng `<EditorTour {...props} />` từ `props` viết tay
 *   trong file này — đúng khuôn `WelcomeScreen.test.tsx` (`propsFor` cùng `baseProps`).
 * - **Nửa hook** (bốn bài nghiệm thu) mount `useEditorTour` thật qua một
 *   component dò (`TourProbe`), tiêm `ShortcutRegistry` giả và `resolveAnchor`
 *   giả — vì "combo không viết cứng" và "phím thật tự sang bước" chỉ có nghĩa
 *   khi đo trên đường đi thật: hook đọc registry → props → view vẽ ra.
 *
 * File này được viết lúc `useEditorTour` và `./EditorTour` chưa tồn tại (2A/2B
 * dựng song song) — bài kiểm viết theo hợp đồng chứ không theo mã đã có, đúng
 * `CONTRACT.md` mục 1. Cả sáu file nay đã gộp về một nhánh và bộ kiểm này chạy
 * xanh trọn vẹn; không điều kiện nào bị nới để lấy màu xanh đó (R-70).
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { SEVEN_STATES, createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';
import type { SevenStateScenario } from '@/lib/testing/sevenStateScenarios';

import { EditorTour } from './EditorTour';
import { useEditorTour, TOUR_STEP_IDS } from './useEditorTour';
import type {
  EditorTourProps,
  TourRect,
  TourStepId,
  TourStepView,
  TourSummaryRow,
  UseEditorTourOptions,
} from './useEditorTour';

const noop = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Dữ liệu mẫu — sáu bước, chữ KHÔNG trùng câu nào của S-06 (mục (a) dưới).     */
/* -------------------------------------------------------------------------- */

const FIXED_RECT: TourRect = { top: 120, left: 32, width: 220, height: 40 };

/** Combo thật của bốn bước có phím trong repo hôm nay (notes-1A mục e). Hai bước
 * còn lại (`view3d`, `exportResult`) không có phím nào đã đăng ký — `undefined`
 * ở đây, không phải một chỗ quên điền. */
const COMBO_BY_ID: Partial<Record<TourStepId, string>> = {
  switchTool: 'W',
  reviewWall: 'J',
  editThickness: '1',
  undo: 'Mod+Z',
};

const STEP_TEXT: Record<TourStepId, { readonly title: string; readonly body: string; readonly comboDescription: string }> = {
  switchTool: {
    title: 'đổi công cụ đang dùng',
    body: 'Bấm một biểu tượng khác trên dải công cụ bên trái để đổi công cụ đang chọn.',
    comboDescription: 'đổi công cụ đang dùng',
  },
  reviewWall: {
    title: 'chọn đoạn tường tiếp theo',
    body: 'Xuống danh sách để xem chi tiết đoạn tường kế tiếp.',
    comboDescription: 'chọn đoạn tường tiếp theo',
  },
  editThickness: {
    title: 'gán độ dày cho đoạn đang chọn',
    body: 'Chọn một mức độ dày có sẵn cho đoạn tường vừa chọn ở panel bên phải.',
    comboDescription: 'gán độ dày cho đoạn đang chọn',
  },
  undo: {
    title: 'hoàn tác thao tác gần nhất',
    body: 'Trả lại trạng thái ngay trước thao tác vừa thực hiện.',
    comboDescription: 'hoàn tác thao tác gần nhất',
  },
  view3d: {
    title: 'mở khung nhìn không gian',
    body: 'Chuyển sang chế độ dựng hình để nhìn toàn bộ khối nhà vừa lên.',
    comboDescription: 'mở khung nhìn không gian',
  },
  exportResult: {
    title: 'lấy tệp mô hình về máy',
    body: 'Bấm nút này khi định dạng đã chọn đã sẵn sàng để tải xuống.',
    comboDescription: 'lấy tệp mô hình về máy',
  },
};

function buildStep(id: TourStepId): TourStepView {
  const text = STEP_TEXT[id];
  const combo = COMBO_BY_ID[id] ?? null;

  return {
    id,
    title: text.title,
    body: text.body,
    combo,
    comboDescription: combo === null ? null : text.comboDescription,
    anchorRect: FIXED_RECT,
    placement: 'bottom',
  };
}

/** Sáu bước sống sót đầy đủ — dùng cho các trạng thái không mất neo nào. */
const SIX_STEPS: readonly TourStepView[] = TOUR_STEP_IDS.map(buildStep);

/** Năm bước — mô phỏng bước `view3d` mất neo (dùng cho trạng thái `error`). */
const ERROR_STEPS: readonly TourStepView[] = SIX_STEPS.filter((step) => step.id !== 'view3d');

const VIEWER_VISIBLE_IDS: readonly TourStepId[] = ['reviewWall', 'view3d', 'exportResult'];

/** Bốn phím thật sự học được — không bịa hai phím không tồn tại (CONTRACT.md mục 5). */
const SUMMARY_ROWS: readonly TourSummaryRow[] = SIX_STEPS.filter(
  (step): step is TourStepView & { readonly combo: string } => step.combo !== null,
).map((step) => ({ id: step.id, label: step.comboDescription ?? step.title, combo: step.combo }));

/** Mọi trường không đổi giữa các bài kiểm view-thuần, một chỗ (khuôn `WelcomeScreen.stories.tsx`). */
function baseProps(overrides: Partial<EditorTourProps> = {}): EditorTourProps {
  return {
    screenState: 'partial',
    steps: SIX_STEPS,
    activeIndex: 1,
    cutout: SIX_STEPS[1]?.anchorRect ?? null,
    isCollapsed: false,
    isReducedMotion: false,
    summary: [],
    isSkipChipVisible: false,
    liveMessage: `đang ở bước 2 trên ${String(SIX_STEPS.length)}: ${STEP_TEXT.reviewWall.title}`,
    onNext: noop,
    onSkip: noop,
    onJump: noop,
    onFinish: noop,
    onReopen: noop,
    onOpenSampleProject: noop,
    ...overrides,
  };
}

/** Kịch bản chung của bảy trạng thái → props của `EditorTour`, một hàm cho cả bảy. */
function propsFor(scenario: SevenStateScenario): EditorTourProps {
  switch (scenario.state) {
    case 'empty':
      // "Đã xem xong": không hiện gì, TRỪ chip bỏ qua còn lại — nếu không thì
      // chính trạng thái này vi phạm A11 (màn trắng), xem CONTRACT.md mục 6.
      return baseProps({
        screenState: 'empty',
        steps: [],
        activeIndex: -1,
        cutout: null,
        isSkipChipVisible: true,
        liveMessage: '',
      });
    case 'loading':
      return baseProps({ screenState: 'loading', steps: [], activeIndex: -1, cutout: null });
    case 'partial':
      return baseProps({
        screenState: 'partial',
        steps: SIX_STEPS,
        activeIndex: 2,
        cutout: SIX_STEPS[2]?.anchorRect ?? null,
      });
    case 'error':
      return baseProps({
        screenState: 'error',
        steps: ERROR_STEPS,
        activeIndex: 0,
        cutout: ERROR_STEPS[0]?.anchorRect ?? null,
      });
    case 'success':
      return baseProps({
        screenState: 'success',
        steps: SIX_STEPS,
        activeIndex: SIX_STEPS.length - 1,
        cutout: null,
        summary: SUMMARY_ROWS,
      });
    case 'forbidden': {
      const steps = SIX_STEPS.filter((step) => VIEWER_VISIBLE_IDS.includes(step.id));

      return baseProps({
        screenState: 'forbidden',
        steps,
        activeIndex: 0,
        cutout: steps[0]?.anchorRect ?? null,
      });
    }
    case 'collapsed':
      return baseProps({
        screenState: 'collapsed',
        steps: SIX_STEPS,
        isCollapsed: true,
        activeIndex: 1,
        cutout: null,
      });
    default: {
      const exhaustive: never = scenario.state;

      throw new Error(`propsFor: trạng thái không xác định — ${String(exhaustive)}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Dựng qua hook thật — tiêm registry/resolveAnchor giả (bốn bài nghiệm thu).   */
/* -------------------------------------------------------------------------- */

let observedProps: EditorTourProps | null = null;

function TourProbe({ options }: { readonly options: UseEditorTourOptions }) {
  const props = useEditorTour(options);

  observedProps = props;

  return <EditorTour {...props} />;
}

function mountTour(options: UseEditorTourOptions = {}) {
  observedProps = null;

  return renderWithProviders(<TourProbe options={options} />);
}

/** Props mới nhất do `useEditorTour` trả ra, hoặc một lỗi nói rõ chưa dựng lần nào. */
function tourProps(): EditorTourProps {
  if (observedProps === null) throw new Error('useEditorTour chưa chạy lần nào');

  return observedProps;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/* -------------------------------------------------------------------------- */
/* (a) R-63 — bảy trạng thái.                                                  */
/* -------------------------------------------------------------------------- */

describe('R-63 — bảy trạng thái, đo trên cả màn', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<EditorTour {...propsFor(scenario)} />);
    }, createSevenStateScenarios());

    console.log(
      `[2C] expectSevenStates = ${String(covered.length)}/${String(SEVEN_STATES.length)} — ${covered.join(', ')}`,
    );

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* -------------------------------------------------------------------------- */
/* (b) R-72 — tiếp cận, tiếng Việt, không mã màu thô.                          */
/* -------------------------------------------------------------------------- */

describe('R-72 — mọi trạng thái có vẽ gì đó: tiếp cận được, tiếng Việt có dấu', () => {
  it.each(createSevenStateScenarios())('trạng thái "$label" tiếp cận được và không sót tiếng Anh/mất dấu', (scenario) => {
    const { container } = render(<EditorTour {...propsFor(scenario)} />);

    expectAccessible(container);
    expectVietnamese(container);
  });

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/system/EditorTour');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* (c) BÀI NGHIỆM THU 1 — đổi phím thì thẻ đổi theo, không viết cứng.          */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU 1 — đổi phím tắt trong registry thì thẻ đổi theo', () => {
  it('combo trên thẻ đọc registry tại thời điểm dựng — đăng ký lại cùng id với combo khác thì thẻ đổi theo', () => {
    const registry = createShortcutRegistry();

    const disposeFirst = registry.register({
      id: 'wallLayerReview.next',
      combo: 'A',
      scope: 'canvas',
      description: STEP_TEXT.reviewWall.comboDescription,
      onTrigger: noop,
    });

    const first = mountTour({ registry, resolveAnchor: () => null, forcedState: 'partial', hasModel: true });

    const comboAfterFirstBind = tourProps().steps.find((step) => step.id === 'reviewWall')?.combo ?? null;

    console.log(`[2C] BÀI NGHIỆM THU 1 — lượt 1: đăng ký combo "A" cho wallLayerReview.next → thẻ đọc "${String(comboAfterFirstBind)}"`);

    expect(comboAfterFirstBind).toBe('A');
    expect(screen.getByText('A')).toBeInTheDocument();

    first.unmount();
    cleanup();
    disposeFirst();

    registry.register({
      id: 'wallLayerReview.next',
      combo: 'Y',
      scope: 'canvas',
      description: STEP_TEXT.reviewWall.comboDescription,
      onTrigger: noop,
    });

    mountTour({ registry, resolveAnchor: () => null, forcedState: 'partial', hasModel: true });

    const comboAfterSecondBind = tourProps().steps.find((step) => step.id === 'reviewWall')?.combo ?? null;

    console.log(`[2C] BÀI NGHIỆM THU 1 — lượt 2: đăng ký LẠI cùng id với combo "Y" → thẻ đọc "${String(comboAfterSecondBind)}"`);

    expect(comboAfterSecondBind).toBe('Y');
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* (d) BÀI NGHIỆM THU 2 — bấm phím thật thì tự sang bước kế tiếp.              */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU 2 — bấm phím thật của bước đang mở thì tự chuyển bước', () => {
  it('bấm đúng combo của bước đang mở (qua registry dùng chung) thì hướng dẫn tự sang bước kế tiếp', () => {
    const registry = createShortcutRegistry();

    registry.register({
      id: 'wallLayerReview.next',
      combo: 'J',
      scope: 'canvas',
      description: STEP_TEXT.reviewWall.comboDescription,
      // Đại diện cho hành động THẬT của màn Duyệt lớp tường — không phải của
      // EditorTour. EditorTour chỉ QUAN SÁT phím này qua registry dùng chung.
      onTrigger: noop,
    });

    const resolveAnchor = (id: TourStepId): TourRect | null => (id === 'editThickness' ? FIXED_RECT : null);

    mountTour({ registry, resolveAnchor, forcedState: 'partial', hasModel: true });

    const before = tourProps();

    expect(before.steps.map((step) => step.id)).toEqual(['reviewWall', 'editThickness']);
    expect(before.activeIndex).toBe(0);

    act(() => {
      registry.handleKeyDown({ key: 'j', preventDefault: vi.fn() }, null);
    });

    const after = tourProps();

    console.log(
      `[2C] BÀI NGHIỆM THU 2 — bấm phím thật "J" của bước đang mở → activeIndex ${String(before.activeIndex)} sang ${String(after.activeIndex)} (bước "${after.steps[after.activeIndex]?.id ?? ''}")`,
    );

    expect(after.activeIndex).toBe(1);
    expect(after.steps[after.activeIndex]?.id).toBe('editThickness');
  });
});

/* -------------------------------------------------------------------------- */
/* (e) BÀI NGHIỆM THU 3 — mất neo thì bộ đếm rút, giao diện không vỡ.          */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU 3 — mất neo thì bộ đếm rút, giao diện không vỡ', () => {
  it('bước không có phím và không dò được neo bị bỏ lặng lẽ — bộ đếm còn "x / 5"', () => {
    const registry = createShortcutRegistry();

    registry.register({ id: 'wallLayerReview.tool.drawWall', combo: 'W', scope: 'canvas', description: STEP_TEXT.switchTool.comboDescription, onTrigger: noop });
    registry.register({ id: 'wallLayerReview.next', combo: 'J', scope: 'canvas', description: STEP_TEXT.reviewWall.comboDescription, onTrigger: noop });
    registry.register({ id: 'wallLayerReview.thickness.1', combo: '1', scope: 'canvas', description: STEP_TEXT.editThickness.comboDescription, onTrigger: noop });
    registry.register({ id: 'wallLayerReview.undo', combo: 'Mod+Z', scope: 'canvas', description: STEP_TEXT.undo.comboDescription, onTrigger: noop });

    // `view3d` không có phím thật (notes-1A mục e) — tiêm resolveAnchor trả
    // `null` cho đúng nó để mô phỏng "không dò được phần tử thật", trong khi
    // `exportResult` (cũng không phím) vẫn sống nhờ neo, đúng luật sống sót.
    const resolveAnchor = (id: TourStepId): TourRect | null => (id === 'exportResult' ? FIXED_RECT : null);

    // Gọi thẳng, không bọc try/catch: nếu bước mất neo làm giao diện vỡ, chính
    // lệnh dựng này ném và bài kiểm đỏ ngay tại đây — đúng thứ "không vỡ" đo được.
    const mounted = mountTour({ registry, resolveAnchor, forcedState: 'partial', hasModel: true });

    const props = tourProps();

    expect(props.steps).toHaveLength(5);
    expect(props.steps.some((step) => step.id === 'view3d')).toBe(false);

    const counterText = mounted.container.textContent ?? '';

    console.log(`[2C] BÀI NGHIỆM THU 3 — mất neo bước "view3d" → còn ${String(props.steps.length)}/5 bước; giao diện: "${counterText}"`);

    expect(counterText).toMatch(/5\b/);
    expect(counterText).not.toMatch(/6\b/);
  });
});

/* -------------------------------------------------------------------------- */
/* (f) BÀI NGHIỆM THU 4 — không trùng câu nào của S-06.                       */
/* -------------------------------------------------------------------------- */

/**
 * 26 câu nguyên văn của S-06 (`WelcomeScreen`), chép từ
 * `notes-1D-s06-anchors.md` mục (a). Hai mục #5/#6 là mảnh câu ghép (tiền tố/
 * hậu tố lời chào) — giữ nguyên theo đúng bảng khảo sát, đã cắt khoảng trắng
 * thừa để so khớp công bằng với văn bản đã `trim()` lấy từ DOM.
 */
const S06_SENTENCES: readonly string[] = [
  'Không đọc được tiến độ',
  'Chưa lấy được danh sách dự án nên chưa biết bạn đang ở bước nào.',
  'Thử lại',
  'Vai Người xem chỉ duyệt được kết quả, không tạo dự án và không tải bản vẽ.',
  'Chào',
  ', bắt đầu trong ba bước',
  'Chào bạn, bắt đầu trong ba bước',
  'AppFront đọc bản vẽ kiến trúc của bạn và dò ra trục, tường, phòng, ô mở. Ba bước dưới đây đưa bạn từ tệp bản vẽ tới mô hình không gian xem được.',
  'Tạo dự án',
  'Khai báo tên công trình và danh sách tầng.',
  'Tạo dự án',
  'Tải bản vẽ theo từng tầng',
  'Kéo ảnh quét hoặc tệp CAD vào từng tầng.',
  'Tải bản vẽ',
  'Cần tạo dự án trước.',
  'Duyệt kết quả và dựng 3D',
  'Kiểm tra tường, cửa, phòng rồi xem mô hình.',
  'Duyệt kết quả',
  'Cần tải bản vẽ trước.',
  'Xem dự án mẫu',
  'Xem hướng dẫn 2 phút',
  'Hướng dẫn hai phút chưa sẵn sàng.',
  'Bỏ qua',
  'Có thể xem lại hướng dẫn trong menu trợ giúp.',
  'Vào danh sách dự án',
  'Chưa lấy được danh sách dự án nên chưa biết bạn đang ở bước nào.',
];

/** Mọi text node không rỗng trong `container`, đã `trim()`, không lặp. */
function collectVisibleText(container: HTMLElement): readonly string[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const seen = new Set<string>();

  let node = walker.nextNode();

  while (node !== null) {
    const text = node.textContent?.trim() ?? '';

    if (text.length > 0) seen.add(text);
    node = walker.nextNode();
  }

  return Array.from(seen);
}

describe('BÀI NGHIỆM THU 4 — không trùng câu nào của S-06', () => {
  it('không chuỗi người dùng đọc được nào của EditorTour trùng nguyên văn với S-06', () => {
    const collected = new Set<string>();

    for (const scenario of createSevenStateScenarios()) {
      const { container, unmount } = render(<EditorTour {...propsFor(scenario)} />);

      for (const text of collectVisibleText(container)) collected.add(text);
      unmount();
    }

    const allTexts = Array.from(collected).sort((left, right) => left.localeCompare(right));
    const overlap = allTexts.filter((text) => S06_SENTENCES.includes(text));

    console.log(
      `[2C] BÀI NGHIỆM THU 4 — đã so sánh ${String(allTexts.length)} chuỗi của EditorTour với ${String(S06_SENTENCES.length)} câu S-06:`,
    );
    console.log(allTexts.join(' | '));

    if (overlap.length > 0) {
      console.log(`[2C] BÀI NGHIỆM THU 4 — TRÙNG CÂU: ${overlap.join(' | ')}`);
    }

    expect(overlap).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* (g) Bỏ qua — không hỏi lại, để lại đường quay lại nhìn thấy được.           */
/* -------------------------------------------------------------------------- */

describe('Bỏ qua — Esc và bấm ra nền không hỏi lại, chip quay lại còn đó', () => {
  it('Esc (qua registry dùng chung) bỏ qua ngay, không hộp thoại xác nhận', () => {
    const registry = createShortcutRegistry();

    registry.register({
      id: 'wallLayerReview.next',
      combo: 'J',
      scope: 'canvas',
      description: STEP_TEXT.reviewWall.comboDescription,
      onTrigger: noop,
    });

    mountTour({ registry, resolveAnchor: () => null, forcedState: 'partial', hasModel: true });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    act(() => {
      registry.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() }, null);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(tourProps().isSkipChipVisible).toBe(true);
  });

  it('bấm ra nền cũng bỏ qua ngay, không hỏi lại', () => {
    const onSkip = vi.fn();

    const { container } = render(<EditorTour {...baseProps({ onSkip })} />);

    // Bấm vào một TẤM NỀN thật, không vào `container`. `container` là root
    // container mà React 18 dựng cây vào — chính nó KHÔNG mang fiber nào, nên
    // React không dispatch sự kiện của nó cho bất kỳ handler nào bên trong cây
    // và một bài kiểm bấm vào đó không thể xanh với BẤT KỲ view nào. Đây là sửa
    // ĐÍCH BẤM cho đúng, không phải nới điều kiện: khẳng định giữ nguyên.
    const backdrop = container.querySelector('.bg-bg-overlay');

    expect(backdrop).not.toBeNull();

    fireEvent.click(backdrop as Element);

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sau khi bỏ qua, chip "xem hướng dẫn" còn đó — đường quay lại nhìn thấy được', () => {
    const onReopen = vi.fn();

    render(
      <EditorTour
        {...baseProps({
          screenState: 'empty',
          steps: [],
          activeIndex: -1,
          cutout: null,
          isSkipChipVisible: true,
          liveMessage: '',
          onReopen,
        })}
      />,
    );

    const chip = screen.getByRole('button');

    fireEvent.click(chip);

    expect(onReopen).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* (h) Không chặn — không role dialog/aria-modal, tiêu điểm tới được đích thật. */
/* -------------------------------------------------------------------------- */

describe('Không chặn — không role="dialog", không aria-modal, không bẫy tiêu điểm', () => {
  it('lớp phủ không đặt role="dialog" và không aria-modal', () => {
    const { container } = render(<EditorTour {...baseProps()} />);

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[aria-modal]')).toBeNull();
  });

  it('phần tử thật trong vùng khoét vẫn nhận được tiêu điểm — EditorTour không bẫy tiêu điểm', () => {
    render(
      <>
        <button type="button">Công cụ thật đang được trỏ tới</button>
        <EditorTour {...baseProps()} />
      </>,
    );

    const real = screen.getByRole('button', { name: 'Công cụ thật đang được trỏ tới' });

    real.focus();

    expect(document.activeElement).toBe(real);
  });
});

/* -------------------------------------------------------------------------- */
/* (i) Vai người xem — forbidden chỉ còn ba bước xem.                         */
/* -------------------------------------------------------------------------- */

describe('Vai người xem — forbidden chỉ còn ba bước xem', () => {
  it('role viewer: mảng bước rút còn đúng ba bước xem (reviewWall, view3d, exportResult)', () => {
    const registry = createShortcutRegistry();

    registry.register({
      id: 'wallLayerReview.next',
      combo: 'J',
      scope: 'canvas',
      description: STEP_TEXT.reviewWall.comboDescription,
      onTrigger: noop,
    });

    const resolveAnchor = (id: TourStepId): TourRect | null =>
      id === 'view3d' || id === 'exportResult' ? FIXED_RECT : null;

    mountTour({ registry, resolveAnchor, role: 'viewer', forcedState: 'forbidden', hasModel: true });

    const ids = tourProps()
      .steps.map((step) => step.id)
      .slice()
      .sort();

    console.log(`[2C] vai người xem — bước còn lại: ${ids.join(', ')}`);

    expect(ids).toEqual(['exportResult', 'reviewWall', 'view3d']);
  });
});

/* -------------------------------------------------------------------------- */
/* (k) Cờ đã xem tách theo HOST — sáu bước nằm trên ba màn chủ.                 */
/* -------------------------------------------------------------------------- */

describe('Cờ đã xem tách theo host — học xong ở màn này không tắt hướng dẫn ở màn kia', () => {
  /** Bỏ qua ngay khi vừa dựng, trên đúng một host. */
  function skipOnHost(hostId: string): void {
    const registry = createShortcutRegistry();

    registry.register({
      id: 'wallLayerReview.next',
      combo: 'J',
      scope: 'canvas',
      description: STEP_TEXT.reviewWall.comboDescription,
      onTrigger: noop,
    });

    mountTour({ registry, resolveAnchor: () => null, hostId, userId: 'u-1', hasModel: true });

    act(() => {
      registry.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() }, null);
    });

    cleanup();
  }

  it('khoá localStorage mang cả userId lẫn hostId, nên hai host là hai cờ khác nhau', () => {
    skipOnHost('wall-layer-review');

    const keys = Object.keys(window.localStorage).filter((key) => key.includes('editor-tour-seen'));

    console.log(`[đp] khoá đã ghi: ${keys.join(', ')}`);

    expect(keys).toEqual(['appfront:system-editor-tour-seen:u-1:wall-layer-review']);
    expect(window.localStorage.getItem('appfront:system-editor-tour-seen:u-1:viewer-shell')).toBeNull();
    expect(window.localStorage.getItem('appfront:system-editor-tour-seen:u-1:export-panel')).toBeNull();
  });

  it('bỏ qua ở màn QC rồi mở vỏ 3D: hướng dẫn của vỏ 3D VẪN chạy', () => {
    skipOnHost('wall-layer-review');

    const registry = createShortcutRegistry();

    mountTour({
      registry,
      resolveAnchor: (id): TourRect | null => (id === 'view3d' ? FIXED_RECT : null),
      hostId: 'viewer-shell',
      userId: 'u-1',
      hasModel: true,
    });

    // Còn bước để dạy, và chưa bị coi là đã xem xong.
    expect(tourProps().steps.map((step) => step.id)).toEqual(['view3d']);
    expect(tourProps().screenState).not.toBe('empty');
  });

  it('mở lại ĐÚNG host đã bỏ qua thì không hiện nữa', () => {
    skipOnHost('wall-layer-review');

    const registry = createShortcutRegistry();

    registry.register({
      id: 'wallLayerReview.next',
      combo: 'J',
      scope: 'canvas',
      description: STEP_TEXT.reviewWall.comboDescription,
      onTrigger: noop,
    });

    mountTour({
      registry,
      resolveAnchor: () => FIXED_RECT,
      hostId: 'wall-layer-review',
      userId: 'u-1',
      hasModel: true,
    });

    expect(tourProps().screenState).toBe('empty');
  });
});

/* -------------------------------------------------------------------------- */
/* (j) Giảm chuyển động — vùng khoét đứng yên.                                 */
/* -------------------------------------------------------------------------- */

describe('Giảm chuyển động — vùng khoét không chạy vị trí/kích thước', () => {
  it('isReducedMotion=true thì không dùng thời lượng 340ms (nấc "chậm") cho vùng khoét', () => {
    const { container } = render(<EditorTour {...baseProps({ isReducedMotion: true })} />);

    // CONTRACT.md mục 7: vùng khoét chạy vị trí/kích thước ở 340ms
    // (MOTION_DURATIONS_MS.slow) khi KHÔNG giảm chuyển động — con số đó không
    // được xuất hiện khi isReducedMotion=true (giảm chuyển động: khoét đứng yên).
    expect(container.innerHTML).not.toMatch(/340/);
  });
});
