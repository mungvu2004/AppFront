/**
 * Lượt kiểm của màn tải bản vẽ.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng bốn phép đo định lượng của bản
 * nghiệm thu:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-A]` | bảy trạng thái của A11 | 7/7 |
 * | `[NGHIEM-B]` | số lần màn được cập nhật trong 1 giây lúc đang tải | ≤ 4 |
 * | `[NGHIEM-C]` | trần dung lượng viết tay trong thư mục màn | 0 |
 * | `[NGHIEM-D]` | tên tầng thiếu, và số lần cuộn tới đúng thẻ ấy | đúng 1 |
 * | `[NGHIEM-E1]` | lớp ảnh hưởng kích thước bị đổi lúc kéo tệp qua | 0 |
 *
 * Dữ liệu kịch bản lấy từ `FloorUploadScreen.stories.tsx` — một bộ duy nhất cho
 * cả story lẫn test, vì hai bộ song song là hai bộ sẽ lệch nhau (R-70).
 *
 * `[NGHIEM-E2]` — phép đo pixel thật — **không** nằm ở đây: jsdom không chạy bộ
 * dựng bố cục, nên `getBoundingClientRect()` trả toàn số 0 và một phép trừ hai
 * số 0 luôn đúng dù mã màn làm gì. Phần đo được trong jsdom là "danh sách lớp
 * ảnh hưởng hộp có bị đổi không", và đó đúng là những gì `[NGHIEM-E1]` khẳng
 * định — không hơn.
 */

import { Profiler } from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { DrawingsApi } from '@/api/client';
import { formatFileSize } from '@/lib/format/bytes';
import type {
  NetworkMonitor,
  NetworkMonitorStatus,
  NetworkStatusListener,
} from '@/lib/offline/networkMonitor';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  createUploadTask,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  PROGRESS_EMITS_PER_SECOND,
  UPLOAD_CHUNK_SIZE_BYTES,
} from '@/lib/upload';

import { FloorUploadScreenView } from './FloorUploadScreen';
import { FloorUploadScreenContainer } from './FloorUploadScreen.container';
import { DROP_ZONE_TEST_ID, FILE_INPUT_TEST_ID } from './FloorUploadDropZone';
import { BLOCK_NOTICE_TEST_ID } from './FloorUploadFooter';
import { createFloorUploadGateway, type FloorUploadGateway } from './floorUploadGateway';
import { blockedScenario, scenarioFor, trayScenario } from './FloorUploadScreen.stories';

/* -------------------------------------------------------------------------- */
/* Khung.                                                                      */
/* -------------------------------------------------------------------------- */

/** Thư mục màn — dùng cho lượt soát mã màu thô và lượt soát trần dung lượng. */
const SCREEN_DIRECTORY = 'src/screens/upload/FloorUploadScreen';

const PROJECT_ID = 'project-1';

/**
 * Từ cho qua: đuôi tệp và đơn vị dung lượng.
 *
 * Đây là cửa thoát mà `expectVietnamese` mở sẵn cho "tên sản phẩm, định dạng
 * tệp, một đơn vị module chưa nghe qua" — không phải một lượt nới lỏng: mọi
 * chuỗi tiếng Việt khác vẫn bị soát nguyên vẹn. Danh sách đuôi tệp lấy từ hằng
 * của `src/lib/upload` nên nó không lệch được khỏi thứ màn thật sự nhận.
 */
const FORMAT_WORDS: readonly string[] = [
  ...ACCEPTED_UPLOAD_EXTENSIONS.map((extension) => extension.replace('.', '')),
  'B',
  'kB',
  'MB',
  'GB',
  'm',
  'mm',
];

/**
 * Tên tệp mẫu là chuỗi không dấu do người dùng đặt, không phải chữ của sản phẩm.
 *
 * `expectVietnamese` soát chữ mà SẢN PHẨM viết ra. Một tên tệp là dữ liệu người
 * dùng mang tới; đòi nó có dấu là đòi sai chỗ.
 */
const FILE_NAME_PATTERN = /(?:mat-bang|ban-ve)[\w.-]*/u;

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

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật đến từ `scenarioFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: 4,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/* -------------------------------------------------------------------------- */
/* (a) Bảy trạng thái.                                                         */
/* -------------------------------------------------------------------------- */

describe('FloorUploadScreenView — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <FloorUploadScreenView {...scenarioFor(scenario.state)} />,
      );

      rendered += 1;

      return { container, unmount };
    }, scenarioIndex());

    console.log(`[NGHIEM-A] trang-thai-ve-duoc=${String(rendered)}/${String(SEVEN_STATES.length)}`);
    expect(rendered).toBe(SEVEN_STATES.length);
  });

  it('lỗi của một tệp ở lại trong thẻ của nó, không thành lỗi của cả màn và không mở hộp thoại', () => {
    renderWithProviders(<FloorUploadScreenView {...trayScenario()} />);

    // Thẻ tầng thứ ba mang một tệp bị từ chối; danh sách tầng vẫn đủ bốn thẻ và
    // chân trang vẫn ở đó — lỗi không chặn được ba tệp còn lại.
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /bắt đầu xử lý/iu })).toBeEnabled();
  });

  it('màn chỉ đọc không vẽ vùng kéo thả, nhưng vẫn nói ra vì sao', () => {
    renderWithProviders(<FloorUploadScreenView {...scenarioFor('forbidden')} />);

    expect(screen.queryByTestId(DROP_ZONE_TEST_ID)).toBeNull();
    expect(screen.getByText(/chỉ được xem danh sách tệp/iu)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Bộ khẳng định dùng chung (R-72).                                            */
/* -------------------------------------------------------------------------- */

describe('FloorUploadScreenView — khả năng tiếp cận và tiếng Việt (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái đầy đủ nhất', () => {
    const { container } = renderWithProviders(<FloorUploadScreenView {...trayScenario()} />);

    expectAccessible(container);
  });

  it('đi qua expectAccessible ở trạng thái chỉ đọc', () => {
    const { container } = renderWithProviders(
      <FloorUploadScreenView {...scenarioFor('forbidden')} />,
    );

    expectAccessible(container);
  });

  it('mọi chuỗi hiển thị là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<FloorUploadScreenView {...trayScenario()} />);

    expectVietnamese(container, {
      allowWords: FORMAT_WORDS,
      ignore: [FILE_NAME_PATTERN],
    });
  });

  it('không mã màu thô trong bất kỳ file nào của thư mục màn (A1)', () => {
    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      expectNoRawColor(`${SCREEN_DIRECTORY}/${file}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* (c) Không trần dung lượng viết tay.                                         */
/* -------------------------------------------------------------------------- */

describe('FloorUploadScreen — không tự viết giới hạn dung lượng', () => {
  it('không file nào trong thư mục màn chứa trần dung lượng dưới dạng byte hay dạng chữ', () => {
    // Ba dạng viết mà lệnh soát của bản nghiệm thu tìm, dựng TỪ HẰNG chứ không
    // gõ tay: gõ tay vào đây thì chính file test này thành một kết quả của lệnh
    // soát ấy.
    const forbidden = [
      String(UPLOAD_CHUNK_SIZE_BYTES),
      String(MAX_UPLOAD_FILE_SIZE_BYTES),
      // Hai cách viết của cùng con số: bản có một chữ số thập phân mà
      // `formatFileSize` trả về mặc định, và bản tròn mà người ta hay gõ vào
      // chú thích.
      formatFileSize(MAX_UPLOAD_FILE_SIZE_BYTES),
      formatFileSize(MAX_UPLOAD_FILE_SIZE_BYTES, { fractionDigits: 0 }),
    ];

    const hits: string[] = [];

    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      const source = readFileSync(`${SCREEN_DIRECTORY}/${file}`, 'utf8');

      for (const needle of forbidden) {
        if (source.includes(needle)) {
          hits.push(`${file}: ${needle}`);
        }
      }
    }

    console.log(`[NGHIEM-C] tran-dung-luong-viet-tay=${String(hits.length)}`);
    expect(hits, `thư mục màn không được viết lại trần dung lượng: ${hits.join(', ')}`).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* (d) Nút chặn nêu tên tầng thiếu và cuộn tới đó.                             */
/* -------------------------------------------------------------------------- */

describe('FloorUploadScreenView — nút chính bị chặn (tiêu chí d)', () => {
  it('nêu tên tầng còn thiếu và cuộn tới đúng thẻ ấy, đúng một lần', () => {
    const scrollSpy = vi.fn();

    // jsdom không cài đặt cuộn, nên `scrollIntoView` không tồn tại cho tới khi
    // test gán nó. `mock.contexts[0]` sau đó là chính phần tử mã màn đã gọi lên.
    Element.prototype.scrollIntoView = scrollSpy;

    const missingFloorName = 'Tầng 2';
    const scenario = blockedScenario(2);

    expect(scenario.footer.canSubmit).toBe(false);

    renderWithProviders(<FloorUploadScreenView {...scenario} />);

    const submitButton = screen.getByRole('button', { name: /bắt đầu xử lý/iu });

    // Cấm "vô hiệu nút chính mà không nêu lý do": nút bấm được, lý do nằm trên
    // trang, không phải trong một thuộc tính `disabled` im lặng.
    expect(submitButton).toBeEnabled();

    const notice = screen.getByTestId(BLOCK_NOTICE_TEST_ID);

    expect(within(notice).getByText(new RegExp(missingFloorName, 'u'))).toBeInTheDocument();

    expect(scrollSpy).toHaveBeenCalledTimes(1);

    const scrolled = scrollSpy.mock.contexts[0] as HTMLElement;

    expect(
      scrolled.textContent,
      `scrollIntoView phải gọi trên thẻ chứa tên tầng thiếu, đã gọi trên: "${String(scrolled.textContent)}"`,
    ).toContain(missingFloorName);

    console.log(
      `[NGHIEM-D] ten-tang-thieu="${missingFloorName}" scroll-called=${String(scrollSpy.mock.calls.length)}`,
    );
  });

  it('không cuộn lần nào khi chưa có lời chặn nào', () => {
    const scrollSpy = vi.fn();

    Element.prototype.scrollIntoView = scrollSpy;

    renderWithProviders(<FloorUploadScreenView {...scenarioFor('partial')} />);

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* (e) phần 1 — vùng thả không đổi kích thước khi kéo tệp qua.                 */
/* -------------------------------------------------------------------------- */

/** Tiền tố của mọi lớp Tailwind có thể đổi hộp của một phần tử. */
const SIZE_AFFECTING_CLASS =
  /^(w-|h-|min-w-|min-h-|max-w-|max-h-|p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|border-[0-9]|inset-|top-|right-|bottom-|left-|gap-)/u;

const classSetOf = (element: Element): Set<string> =>
  new Set(element.className.split(/\s+/u).filter((token) => token.length > 0));

describe('FloorUploadScreenView — vùng thả lúc kéo tệp qua (tiêu chí e, phần 1)', () => {
  it('đổi màu viền và nền nhưng không đổi lớp nào ảnh hưởng kích thước', () => {
    const scenario = scenarioFor('partial');

    const { container, rerender } = renderWithProviders(
      <FloorUploadScreenView {...scenario} isDragActive={false} />,
    );

    const zone = screen.getByTestId(DROP_ZONE_TEST_ID);
    const classesBefore = classSetOf(zone);
    const styleBefore = zone.getAttribute('style');

    // Kéo tệp qua trang: view thuần không tự giữ trạng thái, nên test đóng vai
    // hook và dựng lại nó với `isDragActive` bật — đúng thứ
    // `useFloorUploadScreen` làm khi `dragDepth > 0`.
    const dataTransfer = { files: [], items: [{ kind: 'file', type: 'image/png' }], types: ['Files'] };

    fireEvent.dragEnter(zone, { dataTransfer });
    fireEvent.dragOver(zone, { dataTransfer });
    rerender(<FloorUploadScreenView {...scenario} isDragActive />);

    const zoneAfter = screen.getByTestId(DROP_ZONE_TEST_ID);
    const classesAfter = classSetOf(zoneAfter);
    const styleAfter = zoneAfter.getAttribute('style');

    const added = [...classesAfter].filter((token) => !classesBefore.has(token));
    const removed = [...classesBefore].filter((token) => !classesAfter.has(token));
    const sizeAffecting = [...added, ...removed].filter((token) =>
      SIZE_AFFECTING_CLASS.test(token),
    );

    console.log(`[NGHIEM-E1] lop-doi-kich-thuoc=${String(sizeAffecting.length)}`);

    expect(
      sizeAffecting,
      `kéo tệp qua không được đổi lớp ảnh hưởng kích thước, nhưng đã đổi: ${sizeAffecting.join(', ')}`,
    ).toEqual([]);
    expect(
      added.length + removed.length,
      'phải có ít nhất một lớp đổi, nếu không thì vùng thả không phản hồi gì cả',
    ).toBeGreaterThan(0);
    expect(styleBefore).toBeNull();
    expect(styleAfter).toBeNull();
    expect(container).toBeTruthy();
  });

  it('báo cho hook biết tệp đã vào và đã ra khỏi trang', () => {
    const onDragEnter = vi.fn();
    const onDragLeave = vi.fn();

    renderWithProviders(
      <FloorUploadScreenView
        {...scenarioFor('partial')}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
      />,
    );

    const zone = screen.getByTestId(DROP_ZONE_TEST_ID);

    fireEvent.dragEnter(zone, { dataTransfer: { files: [], items: [], types: ['Files'] } });
    fireEvent.dragLeave(zone, { dataTransfer: { files: [], items: [], types: ['Files'] } });

    expect(onDragEnter).toHaveBeenCalledTimes(1);
    expect(onDragLeave).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* (b) Tốc độ cập nhật tiến trình.                                             */
/* -------------------------------------------------------------------------- */

/** Độ trễ giả của mỗi khúc, để một lượt tải kéo dài hơn cửa sổ đo một giây. */
const CHUNK_LATENCY_MS = 40;

/** Khúc nhỏ để một tệp bé sinh ra nhiều nhịp tiến trình như một tệp thật. */
const TEST_CHUNK_SIZE_BYTES = 128;

/** Dung lượng tệp mẫu: 32 khúc × 40 ms ⇒ lượt tải dài hơn một giây mô phỏng. */
const TEST_FILE_BYTES = 4096;

/** Cửa sổ đo, tính bằng mili-giây mô phỏng. */
const MEASURE_WINDOW_MS = 1000;

/** Một nhịp nhỏ để cho các lượt hẹn giờ của react-query chạy hết. */
const SETTLE_STEP_MS = 10;

function createFakeNetworkMonitor(): NetworkMonitor {
  const listeners = new Set<NetworkStatusListener>();
  const statusOf = (): NetworkMonitorStatus => ({
    browserOnline: true,
    checkedAt: 0,
    online: true,
    pingOnline: true,
  });

  return {
    checkNow: async () => statusOf(),
    getStatus: statusOf,
    start: () => undefined,
    stop: () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Cổng thật, chạy trên client giả, với một lượt tải **thật** của
 * `createUploadTask`.
 *
 * Đây là điểm mấu chốt của phép đo: cái bị đo là bộ tiết chế thật trong
 * `src/lib/upload`, không phải một bản giả dựng tại chỗ. Chỉ hai thứ bị thay —
 * kích thước khúc (để một tệp 4 KiB sinh ra 32 nhịp như một tệp thật) và độ trễ
 * mạng (để thời gian mô phỏng thật sự trôi).
 */
function createChunkyGateway(): FloorUploadGateway {
  const client = createMockApiClient();

  const slowDrawings: DrawingsApi = {
    ...client.drawings,
    sendChunk: async (input) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, CHUNK_LATENCY_MS);
      });

      return client.drawings.sendChunk(input);
    },
  };

  const real = createFloorUploadGateway(client, { networkMonitor: createFakeNetworkMonitor() });

  return {
    ...real,
    createUpload: ({ file, floorId, id, onProgress, projectId }) =>
      createUploadTask({
        api: slowDrawings,
        chunkSizeBytes: TEST_CHUNK_SIZE_BYTES,
        file,
        floorId,
        onProgress,
        projectId,
        ...(id === undefined ? {} : { id }),
      }),
  };
}

/** Phần trăm mà thẻ Tầng 2 đang đọc lên, lấy từ chính phần tử trình đọc màn hình nghe. */
function uploadPercentText(): string {
  return document.querySelector('[data-floor-id="L2"] [role="progressbar"]')?.textContent ?? '';
}

describe('FloorUploadScreen — tốc độ cập nhật tiến trình (tiêu chí b)', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  it(`cập nhật không quá ${String(PROGRESS_EMITS_PER_SECOND)} lần mỗi giây, và vẫn tới được 100%`, async () => {
    let commits = 0;

    renderWithProviders(
      <Profiler
        id="floor-upload"
        onRender={() => {
          commits += 1;
        }}
      >
        <FloorUploadScreenContainer gateway={createChunkyGateway()} projectId={PROJECT_ID} />
      </Profiler>,
    );

    // `renderWithProviders` không bọc Router nhưng có `QueryClientProvider`;
    // lượt đọc danh sách tầng đi qua vài vòng promise cộng một nhịp hẹn giờ của
    // react-query, nên phải cho đồng hồ giả chạy vài lượt chứ không chỉ vét
    // microtask một lần.
    await act(async () => {
      await clock.advance(SETTLE_STEP_MS);
      await clock.flushMicrotasks();
      await clock.advance(SETTLE_STEP_MS);
      await clock.flushMicrotasks();
    });

    // Bốn tầng của bộ mẫu đã đọc xong.
    expect(screen.getByText('Tầng 2')).toBeInTheDocument();

    const file = new File(['x'.repeat(TEST_FILE_BYTES)], 'mat-bang-tang-2.png', {
      type: 'image/png',
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId(FILE_INPUT_TEST_ID), { target: { files: [file] } });
      await clock.flushMicrotasks();
    });

    // Bỏ qua các lần vẽ của lúc mở màn và lúc thả tệp; đo đúng cửa sổ một giây
    // sau khi lượt tải đã chạy.
    const percentBefore = uploadPercentText();

    commits = 0;

    // Tua theo từng nhịp nhỏ, mỗi nhịp một `act` riêng: gói cả giây vào MỘT
    // `act` thì React dồn mọi cập nhật lại thành đúng một lần vẽ và phép đếm
    // luôn ra 1 dù bộ tiết chế có tồn tại hay không. Chia nhỏ ra thì mỗi nhịp
    // được vẽ riêng, nên con số đếm được đúng là "màn hình được cập nhật mấy
    // lần trong một giây".
    for (let elapsed = 0; elapsed < MEASURE_WINDOW_MS; elapsed += SETTLE_STEP_MS) {
      await act(async () => {
        await clock.advance(SETTLE_STEP_MS);
      });
    }

    const percentAfter = uploadPercentText();

    // Phép đo chỉ có nghĩa nếu lượt tải thật sự chạy trong cửa sổ ấy. Không có
    // khẳng định này thì một màn đứng yên cũng "đạt" ngưỡng ≤ 4.
    expect(
      percentAfter,
      `lượt tải phải tiến trong cửa sổ đo, nhưng vẫn ở "${percentBefore}"`,
    ).not.toBe(percentBefore);

    const measured = commits;

    console.log(`[NGHIEM-B] cap-nhat-trong-1-giay=${String(measured)}`);

    expect(
      measured,
      `cập nhật tiến trình phải ≤ ${String(PROGRESS_EMITS_PER_SECOND)} lần mỗi giây, đo được ${String(measured)} lần trong cửa sổ ${String(MEASURE_WINDOW_MS)} ms mô phỏng`,
    ).toBeLessThanOrEqual(PROGRESS_EMITS_PER_SECOND);

    // Cạnh biên: mốc cuối không được bị bộ tiết chế nuốt mất.
    await act(async () => {
      await clock.runAllTimers();
    });

    // Bộ tiết chế bỏ bớt các nhịp giữa chừng, không được bỏ nhịp cuối: đúng
    // thẻ tầng vừa nhận tệp phải kết thúc ở "đã gắn kèm".
    const uploadedCard = document.querySelector('[data-floor-id="L2"]');

    expect(uploadedCard, 'thẻ của Tầng 2 phải còn trên trang').not.toBeNull();
    expect(uploadedCard?.textContent).toContain('đã gắn kèm');
  });
});
