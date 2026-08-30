/**
 * Lượt kiểm của màn S-11 "Một bước AI hỏng".
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng bảy phép đo của bản nghiệm thu:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11 | 7/7 |
 * | `[NGHIEM-2]` | thử lại bước hai → bước một KHÔNG chạy lại | bộ đếm cổng: 1 và 0 |
 * | `[NGHIEM-3]` | ba câu của khối lỗi, không câu nào lấy người dùng làm chủ ngữ | 3/3 sạch |
 * | `[NGHIEM-4]` | số hành động đi tiếp ở trạng thái chính | ≥ 2 |
 * | `[NGHIEM-5]` | không hộp thoại, không trang lỗi toàn màn, không nền đỏ | 0 ở cả bảy |
 * | `[NGHIEM-6]` | tiến độ đã có KHÔNG bị xoá sau lượt chạy lại | 3 dòng còn nguyên |
 * | `[NGHIEM-7]` | R-73 — màn cha mở được bằng một thẻ, ba lối ra chạy thật | 3/3 gọi tới |
 *
 * Hai lớp render, cố ý — cùng khuôn `ProcessingScreen.test.tsx`:
 *
 * - **Chỉ props** cho bảy trạng thái và ba bộ soát. {@link PipelineFailure} là
 *   một hàm của props (mục D). Dữ liệu đến từ `PipelineFailure.stories.tsx`, một
 *   bộ duy nhất cho cả story lẫn test: hai bộ song song là hai bộ sẽ lệch nhau
 *   (R-70).
 * - **Qua {@link PipelineFailureContainer} + cổng dữ liệu giả** cho mọi thứ chỉ
 *   chứng minh được bằng một lượt bấm thật: chạy lại đúng một bước, ba lối ra,
 *   khối gấp mở ra bằng bàn phím.
 *
 * ## Cổng dữ liệu giả đến từ đâu
 *
 * `createMockPipelineFailureGateway()` của `pipelineFailureGateway.ts` — đúng bộ
 * mẫu mà story và `usePipelineFailure.test.ts` dùng (R-70). Nó KHÔNG dựng trên
 * `@/api/__mocks__/client`, và không phải vì tiện: `createPipelineFailureGateway`
 * không nhận `ApiClient` nào cả (`CreatePipelineFailureGatewayOptions` chỉ có bộ
 * đo đạc, bộ chép và đồng hồ), vì cả bốn khả năng cần mạng của màn này còn là
 * NOT FOUND. Cắm một `ApiClient` giả vào đây là dựng một khe không tồn tại.
 *
 * ## BẪY ĐÃ ĐO — `expectVietnamese` ở nhánh `loading`
 *
 * `Pipeline.Step` tự đặt `aria-label={`${name} — ${status}`}`
 * (`PipelineStepper.tsx:81`), mà `status` là enum máy đọc. Ba chuỗi tiếng Anh ở
 * nhánh `retrying` đến TỪ COMPONENT chứ không từ màn này, và
 * `src/components/**` ngoài phạm vi được sửa (R-68). Nên `allowWords` được mở ở
 * ĐÚNG một trạng thái, và sáu trạng thái còn lại phải sạch mà không cần nó —
 * nới cho cả bảy là tắt phép kiểm chứ không phải vượt qua nó (R-70).
 *
 * ## A12 — vì sao không có phép kiểm "Esc đóng lớp trên cùng"
 *
 * Màn này KHÔNG mở lớp nào: không hộp thoại, không lớp phủ, không trang lỗi toàn
 * màn — `[NGHIEM-5]` đo đúng chuyện đó ở cả bảy trạng thái. Thứ duy nhất mở ra
 * được là khối gấp "Chi tiết kỹ thuật", và nó là một `<button>` thật mang
 * `aria-expanded`: `Enter` và `Space` đã mở và đóng được nó. Nên lời hứa "Esc
 * đóng lớp trên cùng" ở đây không có gì để lấy mất, và phép kiểm bên dưới khẳng
 * định đúng điều đó — Esc không làm màn đổi trạng thái và không có lớp nào để
 * đóng — thay vì đòi một phím tắt mà màn cố ý không đăng ký.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPipelineStages } from '@/lib/realtime/pipeline';
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
import { ROUTES } from '@/routes/paths';

import { PipelineFailure } from './PipelineFailure';
import {
  PipelineFailureContainer,
  type PipelineFailureScreenContainerProps,
} from './PipelineFailure.container';
import { scenarioFor } from './PipelineFailure.stories';
import {
  createMockPipelineFailureGateway,
  PIPELINE_FAILURE_SAMPLE_DETAIL,
  PIPELINE_FAILURE_SAMPLE_FLOOR_ID,
  PIPELINE_FAILURE_SAMPLE_KEPT,
  PIPELINE_FAILURE_SAMPLE_STEP_ID,
  type MockPipelineFailureGateway,
} from './pipelineFailureGateway';
import {
  attemptLabel,
  causeSentence,
  codeLabel,
  PIPELINE_FAILURE_TEXT,
  resolvedToastMessage,
  retryStepAriaLabel,
  summarySentence,
} from './pipelineFailureText';

const SCREEN_DIRECTORY = 'src/screens/pipeline/PipelineFailure';

const PROJECT_ID = 'project-1';
const FLOOR_ID = PIPELINE_FAILURE_SAMPLE_FLOOR_ID;
const FAILED_STEP_ID = PIPELINE_FAILURE_SAMPLE_STEP_ID;
/** Bước ĐÃ XONG trước bước hỏng — bộ đếm của nó là bằng chứng của `[NGHIEM-2]`. */
const FIRST_STEP_ID = 'preprocess';

const FLOOR_LABEL = PIPELINE_FAILURE_SAMPLE_DETAIL.floorName;

/** Nhãn tiếng Việt của một bước, tra đúng một nguồn với hook và view (R-61). */
const labelOf = (stepId: string): string =>
  getPipelineStages().find((stage) => stage.id === stepId)?.label ?? stepId;

const FAILED_STEP_LABEL = labelOf(FAILED_STEP_ID);

/** Nhãn trình đọc màn hình của nút thử lại — ghép đúng cách `PipelineFailureAlert` ghép. */
const RETRY_BUTTON_NAME = `${PIPELINE_FAILURE_TEXT.retryLabel} — ${retryStepAriaLabel(FAILED_STEP_LABEL)}`;

/**
 * Bốn từ máy đọc mà `Pipeline.Step` tự thêm vào `aria-label`.
 *
 * Mở ở ĐÚNG nhánh `loading` — xem "BẪY ĐÃ ĐO" ở đầu file.
 */
const STEPPER_STATUS_WORDS = ['done', 'running', 'queued', 'failed'];

/**
 * Chủ ngữ là người dùng — thứ mục [CẤM TUYỆT ĐỐI] cấm ở mọi câu lỗi.
 *
 * Bắt theo VỊ TRÍ chủ ngữ và theo động từ trách móc, không bắt chữ "bạn" trần:
 * "Bản vẽ gốc và các thiết lập của bạn vẫn được giữ." là sở hữu cách, chủ ngữ
 * vẫn là bản vẽ, và câu đó đúng. Một câu mở đầu bằng "Bạn" thì không.
 */
const BLAMING_PATTERNS: readonly RegExp[] = [
  /(?:^|[.!?]\s+)[Bb]ạn\b/u,
  /\bbạn (?:đã|không|chưa|nên|phải|cần|quên|sai)\b/u,
  /\b(?:lỗi|sai sót) của bạn\b/u,
];

/**
 * Nền đỏ và mã màu vi phạm thô — `[NGHIEM-5]`, đo trên chính mã nguồn.
 *
 * GHÉP TỪ MẢNH, không viết thẳng: một phép kiểm quét cả thư mục màn sẽ quét cả
 * chính nó, và một mẫu viết thẳng biến file này thành file vi phạm đầu tiên —
 * phép kiểm tự bắn vào chân mình. Cùng mẹo `[NGHIEM-4]` của
 * `ProcessingScreen.test.tsx`, ở đó dãy trọng số cũng được dựng từ dữ liệu chứ
 * không gõ tay.
 */
/* prettier-ignore */
const RED_BACKGROUND_WORDS = [
  'background',
  'red',
] as const;

/* prettier-ignore */
const VIOLATION_HEX = [
  '#',
  'C0685A',
].join('');

const RED_BACKGROUND_PATTERNS: readonly RegExp[] = [
  new RegExp(RED_BACKGROUND_WORDS.join('.*'), 'iu'),
  new RegExp(VIOLATION_HEX, 'iu'),
];

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật từ `scenarioFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: PIPELINE_FAILURE_SAMPLE_DETAIL.floors.length,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

type MountOptions = Omit<
  PipelineFailureScreenContainerProps,
  'projectId' | 'floorId' | 'stepId' | 'gateway'
>;

/**
 * Màn thật, đã nối, chờ lượt đọc mồi xong.
 *
 * Trước khi lượt đọc xong `state` là `'loading'` cho mọi kịch bản, nên mọi phép
 * kiểm qua container đều đi qua đây thay vì tự chờ mỗi nơi một kiểu.
 */
async function mountScreen(
  gateway: MockPipelineFailureGateway,
  options: MountOptions = {},
): Promise<HTMLElement> {
  const { container } = renderWithProviders(
    <PipelineFailureContainer
      floorId={FLOOR_ID}
      gateway={gateway}
      projectId={PROJECT_ID}
      roles={['engineer']}
      stepId={FAILED_STEP_ID}
      {...options}
    />,
  );

  await screen.findByText(summarySentence(FAILED_STEP_LABEL, FLOOR_LABEL));

  return container;
}

/** Mọi chuỗi người đọc đang có trên màn, để soi câu nào lấy người dùng làm chủ ngữ. */
function visibleSentences(container: HTMLElement): readonly string[] {
  return (container.textContent ?? '')
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function blamesTheUser(sentence: string): boolean {
  return BLAMING_PATTERNS.some((pattern) => pattern.test(sentence));
}

/* -------------------------------------------------------------------------- */
/* [NGHIEM-1] Bảy trạng thái (A11, R-63).                                      */
/* -------------------------------------------------------------------------- */

describe('PipelineFailure — bảy trạng thái [NGHIEM-1]', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <PipelineFailure {...scenarioFor(scenario.state)} />,
      );
      rendered += 1;
      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('trạng thái thu gọn còn câu tóm tắt và nút mở lại — không nhánh nào trả về rỗng', () => {
    const collapsed = scenarioFor('collapsed');

    renderWithProviders(<PipelineFailure {...collapsed} />);

    expect(screen.getByText(collapsed.collapsedSummaryLine)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.expandLabel }),
    ).toBeInTheDocument();
  });

  it('trạng thái không có quyền: ba hướng và khối nhật ký biến mất, KHÔNG khoá mờ', () => {
    const { container } = renderWithProviders(<PipelineFailure {...scenarioFor('forbidden')} />);

    expect(
      screen.queryByRole('button', { name: PIPELINE_FAILURE_TEXT.skipFloorLabel }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: PIPELINE_FAILURE_TEXT.technicalToggleLabel }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll('button[disabled]')).toHaveLength(0);
    // Vẫn còn câu tóm tắt: màn trắng là thất bại duy nhất A11 tồn tại để chặn.
    expect(container.textContent?.trim()).not.toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* Khả năng tiếp cận, tiếng Việt, màu (R-72).                                   */
/* -------------------------------------------------------------------------- */

describe('PipelineFailure — khả năng tiếp cận, tiếng Việt, màu (R-72)', () => {
  it('đi qua expectAccessible ở CẢ BẢY trạng thái', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = renderWithProviders(
        <PipelineFailure {...scenarioFor(state)} />,
      );

      expectAccessible(container);
      unmount();
    }
  });

  it('sáu trạng thái không phải `loading` là tiếng Việt có dấu, KHÔNG cần nới điều kiện', () => {
    for (const state of SEVEN_STATES.filter((candidate) => candidate !== 'loading')) {
      const { container, unmount } = renderWithProviders(
        <PipelineFailure {...scenarioFor(state)} />,
      );

      expectVietnamese(container);
      unmount();
    }
  });

  it('`loading` sạch khi bỏ qua bốn từ trạng thái do `Pipeline.Step` tự thêm', () => {
    const { container } = renderWithProviders(<PipelineFailure {...scenarioFor('loading')} />);

    expectVietnamese(container, { allowWords: STEPPER_STATUS_WORDS });
  });

  it('bốn từ đó THẬT SỰ đến từ component — bỏ `allowWords` ra thì phép kiểm đỏ', () => {
    const { container } = renderWithProviders(<PipelineFailure {...scenarioFor('loading')} />);

    expect(() => {
      expectVietnamese(container);
    }).toThrow(/expectVietnamese/u);
  });

  it('không mã màu thô trong bất kỳ file nào của thư mục màn (A1)', () => {
    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      expectNoRawColor(`${SCREEN_DIRECTORY}/${file}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Chạy lại ĐÚNG một bước — đo bằng số lần gọi cổng dữ liệu.         */
/* -------------------------------------------------------------------------- */

describe('PipelineFailure — chạy lại đúng một bước [NGHIEM-2]', () => {
  it('bấm "Thử lại bước này" ở bước hai: bước hai chạy 1 lần, bước một chạy 0 lần', async () => {
    const gateway = createMockPipelineFailureGateway();
    await mountScreen(gateway);

    // Chưa bấm gì: chưa bước nào được yêu cầu chạy lại.
    expect(gateway.stepRunCounts.size).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: RETRY_BUTTON_NAME }));

    await waitFor(() => {
      expect(gateway.stepRunCounts.get(FAILED_STEP_ID)).toBe(1);
    });

    // ĐÂY là lời hứa của màn, khẳng định bằng bộ đếm chứ không bằng bình luận.
    expect(gateway.stepRunCounts.get(FIRST_STEP_ID) ?? 0).toBe(0);
    expect([...gateway.stepRunCounts.keys()]).toEqual([FAILED_STEP_ID]);
    expect([...gateway.stepRunCounts.values()].reduce((sum, count) => sum + count, 0)).toBe(1);
  });

  it('lượt chạy lại xong thì dải đổi TẠI CHỖ sang toast, không đổi trang', async () => {
    const gateway = createMockPipelineFailureGateway();
    const container = await mountScreen(gateway);

    fireEvent.click(screen.getByRole('button', { name: RETRY_BUTTON_NAME }));

    const toast = await screen.findByText(
      resolvedToastMessage(FAILED_STEP_LABEL, FLOOR_LABEL),
    );

    expect(toast).toBeInTheDocument();
    // Vẫn đúng một màn: không hộp thoại nào mở ra để nói câu đó.
    expect(container.querySelectorAll('[role="dialog"], [aria-modal]')).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-6] Tiến độ đã có KHÔNG bị xoá.                                      */
/* -------------------------------------------------------------------------- */

describe('PipelineFailure — không xoá tiến độ đã có [NGHIEM-6]', () => {
  it('dải bốn tầng và ba dòng "Kết quả đã có" còn nguyên SAU lượt chạy lại', async () => {
    const gateway = createMockPipelineFailureGateway();
    const container = await mountScreen(gateway);

    const keptList = screen.getByRole('list', { name: 'Kết quả đã có' });
    expect(keptList.querySelectorAll('li')).toHaveLength(PIPELINE_FAILURE_SAMPLE_KEPT.length);
    expect(keptList.querySelectorAll('li')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: RETRY_BUTTON_NAME }));
    await screen.findByText(resolvedToastMessage(FAILED_STEP_LABEL, FLOOR_LABEL));

    const keptAfter = screen.getByRole('list', { name: 'Kết quả đã có' });
    expect(keptAfter.querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByText(PIPELINE_FAILURE_TEXT.keptWorkCaption)).toBeInTheDocument();

    const floors = screen.getByRole('list', { name: 'Tiến độ theo tầng' });
    expect(floors.querySelectorAll('li')).toHaveLength(
      PIPELINE_FAILURE_SAMPLE_DETAIL.floors.length,
    );
    expect(container.textContent).toContain(FLOOR_LABEL);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] Ba câu của khối lỗi.                                             */
/* -------------------------------------------------------------------------- */

describe('PipelineFailure — ba câu lỗi [NGHIEM-3]', () => {
  it('khối lỗi có đủ ba trường đúng thứ tự, và mã lỗi nhỏ nhưng chép được', async () => {
    const gateway = createMockPipelineFailureGateway();
    await mountScreen(gateway);

    const three = [
      summarySentence(FAILED_STEP_LABEL, FLOOR_LABEL),
      causeSentence(PIPELINE_FAILURE_SAMPLE_DETAIL.cause),
      codeLabel('SEG-2041', '8f2a-41'),
    ];

    for (const line of three) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }

    // Mã lỗi có mặt nhưng nhỏ, và có nút chép đi kèm — mục [CẤM TUYỆT ĐỐI].
    fireEvent.click(screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.copyCodeAriaLabel }));

    await waitFor(() => {
      expect(gateway.copiedTexts).toContain(codeLabel('SEG-2041', '8f2a-41'));
    });
  });

  it('không câu nào trên màn lấy người dùng làm chủ ngữ, ở CẢ BẢY trạng thái', () => {
    const offenders: string[] = [];

    for (const state of SEVEN_STATES) {
      const { container, unmount } = renderWithProviders(
        <PipelineFailure {...scenarioFor(state)} />,
      );

      offenders.push(...visibleSentences(container).filter(blamesTheUser));
      unmount();
    }

    expect(offenders).toEqual([]);
  });

  it('phép kiểm giọng điệu đo được thứ thật — một câu trách người dùng thì bị bắt', () => {
    expect(blamesTheUser('Bạn đã tải lên một bản vẽ sai định dạng.')).toBe(true);
    // Sở hữu cách thì không: chủ ngữ vẫn là bản vẽ.
    expect(blamesTheUser(PIPELINE_FAILURE_TEXT.keptWorkLine)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Luôn có ít nhất hai đường đi tiếp.                               */
/* -------------------------------------------------------------------------- */

describe('PipelineFailure — hai đường đi tiếp [NGHIEM-4]', () => {
  it('trạng thái chính có bốn hành động đi tiếp bấm được, tối thiểu là hai', async () => {
    await mountScreen(createMockPipelineFailureGateway());

    const actionNames = [
      PIPELINE_FAILURE_TEXT.retryLowerThresholdLabel,
      PIPELINE_FAILURE_TEXT.uploadClearerLabel,
      PIPELINE_FAILURE_TEXT.skipFloorLabel,
      RETRY_BUTTON_NAME,
    ];

    const found = actionNames.filter(
      (name) => screen.queryByRole('button', { name }) !== null,
    );

    expect(found).toHaveLength(4);
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('hành động mất mát nói ra cái mất TRƯỚC khi được bấm, và nối vào nút (A9)', async () => {
    await mountScreen(createMockPipelineFailureGateway());

    const skip = screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.skipFloorLabel });
    const describedBy = skip.getAttribute('aria-describedby');

    expect(describedBy).not.toBeNull();
    expect(
      screen.getByText(PIPELINE_FAILURE_TEXT.skipFloorWarning, { exact: false }),
    ).toBeInTheDocument();
    expect(document.getElementById(describedBy ?? '')?.textContent).toContain(
      PIPELINE_FAILURE_TEXT.skipFloorWarning,
    );
  });

  it('bấm "Bỏ qua tầng đó" gọi đúng cổng dữ liệu, đúng một lần, đúng tầng đang hỏng', async () => {
    const base = createMockPipelineFailureGateway();
    const skipped: string[] = [];
    const gateway: MockPipelineFailureGateway = {
      ...base,
      skipFloor: async (input) => {
        skipped.push(input.floorId);
        return base.skipFloor(input);
      },
    };

    await mountScreen(gateway);

    fireEvent.click(screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.skipFloorLabel }));

    await waitFor(() => {
      expect(skipped).toEqual([FLOOR_ID]);
    });
    // Bỏ qua một tầng KHÔNG chạy lại bước nào.
    expect(gateway.stepRunCounts.size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-5] Không hộp thoại, không trang lỗi toàn màn, không nền đỏ.          */
/* -------------------------------------------------------------------------- */

describe('PipelineFailure — không hộp thoại, không nền đỏ [NGHIEM-5]', () => {
  it('không trạng thái nào dựng role="dialog", role="alertdialog" hay aria-modal', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = renderWithProviders(
        <PipelineFailure {...scenarioFor(state)} />,
      );

      expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
      expect(container.querySelectorAll('[role="alertdialog"]')).toHaveLength(0);
      expect(container.querySelectorAll('[aria-modal]')).toHaveLength(0);
      unmount();
    }
  });

  it('mẫu tìm nền đỏ đo được thứ thật — một dòng vi phạm dựng tại chỗ thì bị bắt', () => {
    const offending = RED_BACKGROUND_WORDS.join(': ');

    expect(RED_BACKGROUND_PATTERNS.some((pattern) => pattern.test(offending))).toBe(true);
    expect(RED_BACKGROUND_PATTERNS.some((pattern) => pattern.test(VIOLATION_HEX))).toBe(true);
  });

  it('không file nào của thư mục màn viết nền đỏ hay mã màu vi phạm thô', () => {
    const offenders: string[] = [];

    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      const source = readFileSync(`${SCREEN_DIRECTORY}/${file}`, 'utf8');

      if (RED_BACKGROUND_PATTERNS.some((pattern) => pattern.test(source))) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('A12 — Esc không có lớp nào để đóng, và khối gấp mở/đóng bằng một nút thật', async () => {
    const container = await mountScreen(createMockPipelineFailureGateway());
    const toggle = screen.getByRole('button', {
      name: PIPELINE_FAILURE_TEXT.technicalToggleLabel,
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).not.toBeNull();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.technicalToggleLabel }),
      ).toHaveAttribute('aria-expanded', 'true');
    });

    // Không lớp phủ nào được mở ra cùng nó, nên Esc không lấy mất được gì.
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(container.querySelectorAll('[role="dialog"], [aria-modal]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.technicalToggleLabel })).toBeInTheDocument();
    expect(screen.getByText(summarySentence(FAILED_STEP_LABEL, FLOOR_LABEL))).toBeInTheDocument();
  });

  it('vết lỗi kỹ thuật dài chỉ tồn tại SAU khi khối gấp được mở', async () => {
    await mountScreen(createMockPipelineFailureGateway());

    expect(screen.queryByRole('list', { name: 'Nhật ký kỹ thuật' })).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.technicalToggleLabel }),
    );

    expect(await screen.findByRole('list', { name: 'Nhật ký kỹ thuật' })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-7] R-73 — màn cha mở được bằng một thẻ, ba lối ra chạy thật.         */
/* -------------------------------------------------------------------------- */

describe('PipelineFailureContainer — R-73 [NGHIEM-7]', () => {
  it('một thẻ là đủ: không provider riêng, không route, và màn không trắng', async () => {
    const container = await mountScreen(createMockPipelineFailureGateway());

    expect(container.textContent?.trim()).not.toBe('');
    expect(screen.getByText('Xử lý')).toBeInTheDocument();
    expect(screen.getByText(attemptLabel(PIPELINE_FAILURE_SAMPLE_DETAIL.attemptCount))).toBeInTheDocument();
  });

  it('lối ra 1 — "Tải lên bản vẽ rõ hơn" đẩy đường dẫn qua onNavigate, container không viết đường dẫn', async () => {
    const paths: string[] = [];
    await mountScreen(createMockPipelineFailureGateway(), {
      onNavigate: (path) => paths.push(path),
    });

    fireEvent.click(
      screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.uploadClearerLabel }),
    );

    expect(paths).toEqual([ROUTES.project.upload(PROJECT_ID)]);
  });

  it('lối ra 2 — thử lại xong rồi bấm "Xem kết quả" thì onResolved được gọi', async () => {
    const resolved = vi.fn();
    const dismissed = vi.fn();

    await mountScreen(createMockPipelineFailureGateway(), {
      onDismiss: dismissed,
      onResolved: resolved,
    });

    fireEvent.click(screen.getByRole('button', { name: RETRY_BUTTON_NAME }));
    await screen.findByText(resolvedToastMessage(FAILED_STEP_LABEL, FLOOR_LABEL));

    fireEvent.click(
      screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.continueLabel }),
    );

    expect(resolved).toHaveBeenCalledTimes(1);
    expect(dismissed).not.toHaveBeenCalled();
  });

  it('lối ra 3 — màn cha không nối onResolved thì onDismiss nhận việc gỡ dải', async () => {
    const dismissed = vi.fn();

    await mountScreen(createMockPipelineFailureGateway(), { onDismiss: dismissed });

    fireEvent.click(screen.getByRole('button', { name: RETRY_BUTTON_NAME }));
    await screen.findByText(resolvedToastMessage(FAILED_STEP_LABEL, FLOOR_LABEL));

    fireEvent.click(
      screen.getByRole('button', { name: PIPELINE_FAILURE_TEXT.continueLabel }),
    );

    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('vai trò chỉ đọc: ba hướng và khối nhật ký biến mất, màn vẫn còn câu tóm tắt', async () => {
    const container = await mountScreen(createMockPipelineFailureGateway(), { roles: ['viewer'] });

    expect(
      screen.queryByRole('button', { name: PIPELINE_FAILURE_TEXT.skipFloorLabel }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: PIPELINE_FAILURE_TEXT.technicalToggleLabel }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll('button[disabled]')).toHaveLength(0);
    expectAccessible(container);
  });

  it('ép thu gọn: còn đúng câu tóm tắt và nút mở lại', async () => {
    renderWithProviders(
      <PipelineFailureContainer
        floorId={FLOOR_ID}
        forceCollapsed
        gateway={createMockPipelineFailureGateway()}
        projectId={PROJECT_ID}
        roles={['engineer']}
        stepId={FAILED_STEP_ID}
      />,
    );

    const expand = await screen.findByRole('button', {
      name: PIPELINE_FAILURE_TEXT.expandLabel,
    });

    expect(expand).toBeInTheDocument();
    expect(
      screen.queryByText(summarySentence(FAILED_STEP_LABEL, FLOOR_LABEL)),
    ).not.toBeInTheDocument();
  });
});
