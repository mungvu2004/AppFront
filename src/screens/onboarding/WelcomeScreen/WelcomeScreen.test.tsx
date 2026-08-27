/**
 * Bộ kiểm của màn chào — bốn bộ khẳng định dùng chung, cộng phần logic mà bảy
 * trạng thái không với tới.
 *
 * Hai nửa, đúng theo mục D:
 *
 * - **Nửa view.** Bảy trạng thái dựng thẳng từ props, không provider nào. Bảy
 *   `props` ấy dẫn ra từ `createSevenStateScenarios()` chứ không viết tay, nên
 *   ngày bộ kịch bản chung đổi hình thì file này đỏ thay vì lặng lẽ trôi.
 * - **Nửa hook.** `useWelcomeScreen` chạy thật, dữ liệu tiêm qua `fetchList`, và
 *   những gì được đo là những thứ một ảnh chụp bảy trạng thái không thấy được:
 *   ba bước suy ra từ số tường của dự án mới nhất, cờ "đã xem" đọc và ghi vào
 *   `localStorage`, và vai Người xem làm mảng thẻ còn đúng một phần tử.
 *
 * Cộng một bài kiểm cho mối nối R-73: bấm nút của thẻ 1 phải mở hộp thoại tạo dự
 * án THẬT. `onCreateProject` là một tuỳ chọn của hook, và một tuỳ chọn không ai
 * truyền là đúng thứ lỗ hổng R-73 sinh ra để chặn — nên nó được đo, không được tin.
 *
 * Phiên đăng nhập là thứ duy nhất bị thay: `useSession` đọc một kho ngoài React
 * mà bài kiểm không có đường đặt vào, và cả hai vai cần đo (kỹ sư, người xem) chỉ
 * khác nhau ở đúng giá trị đó.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { QueryFunction } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionSnapshot } from '@/lib/auth/types';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  createSevenStateScenarios,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import type { DashboardProject } from '../../dashboard/ProjectDashboard/projectsGateway';
import { WelcomeScreen } from './WelcomeScreen';
import type { OnboardingStepCard, WelcomeScreenProps } from './WelcomeScreen';
import { WelcomeScreenContainer } from './WelcomeScreen.container';
import {
  readWelcomeSeen,
  useWelcomeScreen,
  type UseWelcomeScreenOptions,
  type WelcomeScreenViewModel,
} from './useWelcomeScreen';

/* -------------------------------------------------------------------------- */
/* Phiên đăng nhập — thứ duy nhất bị thay.                                     */
/* -------------------------------------------------------------------------- */

/**
 * jsdom không có `matchMedia`, mà hộp thoại tạo dự án hỏi nó để biết mình đang ở
 * bề rộng nào. `matches: false` là bản để bàn — cùng bản
 * `ProjectDashboard.test.tsx:15-29` và `CreateProjectModal.test.tsx` dựng.
 */
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
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

const USER_ID = 'u-minh';

const auth = vi.hoisted(() => ({
  session: {
    status: 'authenticated',
    user: { id: 'u-minh', name: 'Minh' },
    roles: ['engineer'],
  } as SessionSnapshot,
}));

vi.mock('@/hooks/useSession', () => ({
  useSession: (): SessionSnapshot => auth.session,
}));

function signInAs(roles: SessionSnapshot['roles']): void {
  auth.session = {
    status: 'authenticated',
    user: { id: USER_ID, name: 'Minh' },
    roles,
  };
}

beforeEach(() => {
  signInAs(['engineer']);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/* -------------------------------------------------------------------------- */
/* Dữ liệu mẫu — bộ chuẩn của A14: 48 tường trên tầng trệt.                    */
/* -------------------------------------------------------------------------- */

const SAMPLE_WALL_COUNT = 48;

/** Một dự án của bảng điều khiển, chỉ khác nhau ở phần bài kiểm đang đo. */
function sampleProject(patch: Partial<DashboardProject> = {}): DashboardProject {
  return {
    id: 'p-hq',
    name: 'Tòa nhà HQ',
    floorCount: 3,
    areaM2: 248.6,
    status: 'processing',
    wallsReviewedCount: 0,
    wallsTotalCount: 0,
    updatedAgoMs: 1_000,
    members: [],
    planVariant: 0,
    defaultFloorId: 'f-tret',
    ...patch,
  };
}

/* -------------------------------------------------------------------------- */
/* i. Bảy trạng thái, đo trên view thuần.                                      */
/* -------------------------------------------------------------------------- */

const noop = (): void => undefined;

function stepCard(
  id: OnboardingStepCard['id'],
  ordinal: string,
  title: string,
  sentence: string,
  actionLabel: string,
  state: OnboardingStepCard['state'],
  isPrimary: boolean,
  lockedReason: string | null,
): OnboardingStepCard {
  return {
    id,
    ordinal,
    title,
    sentence,
    actionLabel,
    state,
    isPrimary,
    lockedReason: state === 'locked' ? lockedReason : null,
    onActivate: noop,
  };
}

function cardOne(state: OnboardingStepCard['state'], isPrimary: boolean): OnboardingStepCard {
  return stepCard(
    'createProject',
    '1',
    'Tạo dự án',
    'Khai báo tên công trình và danh sách tầng.',
    'Tạo dự án',
    state,
    isPrimary,
    null,
  );
}

function cardTwo(state: OnboardingStepCard['state'], isPrimary: boolean): OnboardingStepCard {
  return stepCard(
    'uploadDrawings',
    '2',
    'Tải bản vẽ theo từng tầng',
    'Kéo ảnh quét hoặc tệp CAD vào từng tầng.',
    'Tải bản vẽ',
    state,
    isPrimary,
    'Cần tạo dự án trước.',
  );
}

function cardThree(state: OnboardingStepCard['state'], isPrimary: boolean): OnboardingStepCard {
  return stepCard(
    'reviewAndBuild',
    '3',
    'Duyệt kết quả và dựng 3D',
    'Kiểm tra tường, cửa, phòng rồi xem mô hình.',
    'Duyệt kết quả',
    state,
    isPrimary,
    'Cần tải bản vẽ trước.',
  );
}

/**
 * Ba thẻ của một kịch bản, đọc ra từ chính kịch bản đó.
 *
 * `rows` là số tường đã tới, `totalCount` là số tường có — đúng hai con số hook
 * thật đọc khỏi dự án mới nhất, nên bảng ánh xạ ở mục 4 của hợp đồng dựng lại
 * được từ bộ kịch bản chung mà không phải chép tay bảy lần.
 */
function cardsFor(scenario: SevenStateScenario): readonly OnboardingStepCard[] {
  if (!scenario.canView) return [cardThree('open', true)];

  const hasProject = scenario.totalCount > 0 || scenario.rows.length > 0;
  const hasWalls = scenario.rows.length > 0;
  const allReviewed = hasWalls && scenario.rows.length === scenario.totalCount;

  if (allReviewed) {
    return [cardOne('done', false), cardTwo('done', false), cardThree('done', false)];
  }

  if (hasWalls) {
    return [cardOne('done', false), cardTwo('done', false), cardThree('open', true)];
  }

  if (hasProject) {
    return [cardOne('done', false), cardTwo('open', true), cardThree('locked', false)];
  }

  return [cardOne('open', true), cardTwo('locked', false), cardThree('locked', false)];
}

/** Kịch bản chung → props của view, một hàm cho cả bảy. */
function propsFor(scenario: SevenStateScenario): WelcomeScreenProps {
  const isError = scenario.error !== null;
  const cards = cardsFor(scenario);
  const isDone = cards.length === 3 && cards.every((card) => card.state === 'done');

  return {
    screenState: scenario.state,
    isCollapsed: scenario.isCollapsed,
    greeting: 'Chào Minh, bắt đầu trong ba bước',
    intro:
      'AppFront đọc bản vẽ kiến trúc của bạn và dò ra trục, tường, phòng, ô mở. Ba bước dưới đây đưa bạn từ tệp bản vẽ tới mô hình không gian xem được.',
    cards,
    sampleProjectLink: { label: 'Xem dự án mẫu', disabledReason: null, onActivate: noop },
    tutorialLink: {
      label: 'Xem hướng dẫn 2 phút',
      disabledReason: 'Hướng dẫn hai phút chưa sẵn sàng.',
      onActivate: noop,
    },
    skipLink: { label: 'Bỏ qua', disabledReason: null, onActivate: noop },
    errorMessage: isError
      ? 'Chưa lấy được danh sách dự án nên chưa biết bạn đang ở bước nào.'
      : null,
    onRetry: noop,
    finishLabel: isDone ? 'Vào danh sách dự án' : null,
    onFinish: noop,
    isDissolving: false,
    skipNotice: 'Có thể xem lại hướng dẫn trong menu trợ giúp.',
  };
}

/** Kịch bản của một trạng thái, hoặc một lỗi nói rõ trạng thái nào thiếu. */
function scenarioOf(state: SevenStateScenario['state']): SevenStateScenario {
  const found = createSevenStateScenarios().find((one) => one.state === state);

  if (found === undefined) {
    throw new Error(`bộ kịch bản không có trạng thái "${state}"`);
  }

  return found;
}

describe('A11 — bảy trạng thái, đo trên cả màn', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<WelcomeScreen {...propsFor(scenario)} />);
    }, createSevenStateScenarios());

    console.log(
      `[L3-H] expectSevenStates = ${String(covered.length)}/${String(SEVEN_STATES.length)} — ${covered.join(', ')}`,
    );

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });

  it('mỗi trạng thái vẽ ra thứ riêng của nó, không phải bảy lần cùng một trang', () => {
    const byState = new Map<string, string>();

    for (const scenario of createSevenStateScenarios()) {
      const { container, unmount } = render(<WelcomeScreen {...propsFor(scenario)} />);

      byState.set(scenario.state, container.innerHTML);
      unmount();
    }

    for (const state of ['empty', 'loading', 'partial', 'error', 'forbidden', 'collapsed']) {
      expect(byState.get(state)).not.toEqual(byState.get('success'));
    }
  });

  it('trạng thái 2 thay ba thẻ bằng ba khung xương, không tiêu đề và không nút', () => {
    render(<WelcomeScreen {...propsFor(scenarioOf('loading'))} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo dự án' })).not.toBeInTheDocument();
  });

  it('trạng thái 4 nói ra lý do và mời thử lại', () => {
    render(<WelcomeScreen {...propsFor(scenarioOf('error'))} />);

    expect(screen.getByText('Không đọc được tiến độ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('trạng thái 6 còn đúng một thẻ, và nói ra vì sao', () => {
    render(<WelcomeScreen {...propsFor(scenarioOf('forbidden'))} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(
      screen.getByText(
        'Vai Người xem chỉ duyệt được kết quả, không tạo dự án và không tải bản vẽ.',
      ),
    ).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* ii. Đếm lựa chọn — 3 thẻ + 2 liên kết phụ + 1 liên kết bỏ qua.              */
/* -------------------------------------------------------------------------- */

describe('màn cho đúng sáu lựa chọn, không nhiều hơn', () => {
  it('ba nút thẻ, hai liên kết chìm, một liên kết bỏ qua', () => {
    render(<WelcomeScreen {...propsFor(scenarioOf('empty'))} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Xem dự án mẫu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem hướng dẫn 2 phút' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Bỏ qua' })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* iii. Tiếng Việt, khả năng tiếp cận, và màu.                                 */
/* -------------------------------------------------------------------------- */

describe('cả màn: tiếng Việt có dấu, tiếp cận được, không mã màu thô', () => {
  it('expectVietnamese và expectAccessible chạy trên cây render của trạng thái đầy đủ', () => {
    const { container } = render(<WelcomeScreen {...propsFor(scenarioOf('success'))} />);

    // Tên sản phẩm là tên riêng, không phải câu chữ của giao diện — cùng ngoại lệ
    // mà `expectVietnamese` mở sẵn cho `allowWords`.
    expectVietnamese(container, { ignore: ['AppFront'] });
    expectAccessible(container);
  });

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/onboarding/WelcomeScreen');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* iv. Hook — thứ bảy trạng thái không với tới.                                */
/* -------------------------------------------------------------------------- */

let observed: WelcomeScreenViewModel | null = null;

function Probe({ options }: { readonly options: UseWelcomeScreenOptions }) {
  observed = useWelcomeScreen(options);

  return null;
}

/** Dựng hook thật, trong router và query client thật, không dựng view. */
function mountHook(options: UseWelcomeScreenOptions) {
  observed = null;

  return renderWithProviders(
    <MemoryRouter>
      <Probe options={options} />
    </MemoryRouter>,
  );
}

/** View model mới nhất, hoặc một lỗi đọc được thay cho `null` lặng lẽ. */
function vm(): WelcomeScreenViewModel {
  if (observed === null) throw new Error('hook chưa chạy lần nào');

  return observed;
}

function listOf(projects: readonly DashboardProject[]): QueryFunction<readonly DashboardProject[]> {
  return () => Promise.resolve(projects);
}

describe('useWelcomeScreen suy ra ba bước từ dữ liệu truy vấn', () => {
  it('không dự án nào: thẻ 1 mở, hai thẻ sau khoá kèm lý do', async () => {
    mountHook({ fetchList: listOf([]) });

    await waitFor(() => {
      expect(vm().screenState).toBe('empty');
    });

    expect(vm().cards.map((card) => card.state)).toEqual(['open', 'locked', 'locked']);
    expect(vm().cards[1]?.lockedReason).toBe('Cần tạo dự án trước.');
    expect(vm().cards[2]?.lockedReason).toBe('Cần tải bản vẽ trước.');
  });

  it('có dự án nhưng chưa dò ra tường nào: bước 2 là bước đang mở', async () => {
    mountHook({ fetchList: listOf([sampleProject()]) });

    await waitFor(() => {
      expect(vm().screenState).toBe('partial');
    });

    expect(vm().cards.map((card) => card.state)).toEqual(['done', 'open', 'locked']);
    expect(vm().cards[1]?.isPrimary).toBe(true);
  });

  it('có tường nhưng chưa duyệt hết: bước 3 mở, và màn chưa phải thành công', async () => {
    mountHook({
      fetchList: listOf([
        sampleProject({ wallsTotalCount: SAMPLE_WALL_COUNT, wallsReviewedCount: 14 }),
      ]),
    });

    await waitFor(() => {
      expect(vm().screenState).toBe('partial');
    });

    expect(vm().cards.map((card) => card.state)).toEqual(['done', 'done', 'open']);
    expect(vm().finishLabel).toBeNull();
  });

  it('duyệt hết tường: cả ba xong và nút đi tiếp hiện ra', async () => {
    mountHook({
      fetchList: listOf([
        sampleProject({
          wallsTotalCount: SAMPLE_WALL_COUNT,
          wallsReviewedCount: SAMPLE_WALL_COUNT,
        }),
      ]),
    });

    await waitFor(() => {
      expect(vm().screenState).toBe('success');
    });

    expect(vm().cards.map((card) => card.state)).toEqual(['done', 'done', 'done']);
    expect(vm().finishLabel).toBe('Vào danh sách dự án');
  });

  it('đọc dự án cập nhật gần nhất, không phải dự án đầu mảng', async () => {
    mountHook({
      fetchList: listOf([
        sampleProject({ id: 'p-cu', updatedAgoMs: 90_000 }),
        sampleProject({
          id: 'p-moi',
          updatedAgoMs: 1_000,
          wallsTotalCount: SAMPLE_WALL_COUNT,
          wallsReviewedCount: SAMPLE_WALL_COUNT,
        }),
      ]),
    });

    await waitFor(() => {
      expect(vm().screenState).toBe('success');
    });
  });

  it('truy vấn hỏng: câu lỗi hiện ra, và không thẻ nào bịa ra là đã xong', async () => {
    mountHook({ fetchList: () => Promise.reject(new Error('network: fetch failed')) });

    await waitFor(() => {
      expect(vm().screenState).toBe('error');
    });

    expect(vm().errorMessage).toBe(
      'Chưa lấy được danh sách dự án nên chưa biết bạn đang ở bước nào.',
    );
  });
});

describe('useWelcomeScreen và vai Người xem', () => {
  it('vai viewer: mảng thẻ còn đúng một phần tử, và nó là thẻ duyệt kết quả', async () => {
    signInAs(['viewer']);
    mountHook({ fetchList: listOf([]) });

    await waitFor(() => {
      expect(vm().screenState).toBe('forbidden');
    });

    expect(vm().cards).toHaveLength(1);
    expect(vm().cards[0]?.id).toBe('reviewAndBuild');
    expect(vm().cards[0]?.state).toBe('open');
    expect(vm().cards[0]?.lockedReason).toBeNull();
  });
});

describe('cờ "đã xem màn chào" đọc và ghi vào localStorage', () => {
  it('chưa xem lần nào thì đọc ra false', () => {
    expect(readWelcomeSeen(USER_ID)).toBe(false);
  });

  it('không có ai đăng nhập thì không đọc gì, và cũng không ném', () => {
    expect(readWelcomeSeen(null)).toBe(false);
  });

  it('đi hết ba bước là ghi cờ, và lần đọc sau thấy nó', async () => {
    mountHook({
      fetchList: listOf([
        sampleProject({
          wallsTotalCount: SAMPLE_WALL_COUNT,
          wallsReviewedCount: SAMPLE_WALL_COUNT,
        }),
      ]),
    });

    await waitFor(() => {
      expect(readWelcomeSeen(USER_ID)).toBe(true);
    });
  });

  it('bấm "Bỏ qua" cũng ghi cờ — người bỏ qua không phải bỏ qua hai lần', async () => {
    const mounted = mountHook({ fetchList: listOf([]) });

    await waitFor(() => {
      expect(vm().screenState).toBe('empty');
    });

    expect(readWelcomeSeen(USER_ID)).toBe(false);

    act(() => {
      vm().skipLink.onActivate();
    });

    expect(readWelcomeSeen(USER_ID)).toBe(true);

    // Gỡ màn ngay: `leave()` đang giữ một hẹn giờ chuyển trang, và phần dọn dẹp
    // của hook là thứ huỷ nó — đo luôn cả việc đó.
    mounted.unmount();
  });

  it('màn chưa đi hết ba bước thì không ghi gì', async () => {
    mountHook({ fetchList: listOf([sampleProject()]) });

    await waitFor(() => {
      expect(vm().screenState).toBe('partial');
    });

    expect(readWelcomeSeen(USER_ID)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* v. R-73 — container nối được, và nối vào hộp thoại thật.                    */
/* -------------------------------------------------------------------------- */

describe('WelcomeScreenContainer — mối nối R-73', () => {
  it('bấm nút của thẻ 1 mở hộp thoại tạo dự án thật', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WelcomeScreenContainer fetchList={listOf([])} />
      </MemoryRouter>,
    );

    const create = await screen.findByRole('button', { name: 'Tạo dự án' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(create);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('người gọi truyền onCreateProject riêng thì hộp thoại ở đây không mở', async () => {
    const onCreateProject = vi.fn();

    renderWithProviders(
      <MemoryRouter>
        <WelcomeScreenContainer fetchList={listOf([])} onCreateProject={onCreateProject} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Tạo dự án' }));

    expect(onCreateProject).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
