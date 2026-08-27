/**
 * Màn chào `onboarding`: nó nghĩ gì, nó nói gì, bấm vào thì đi đâu.
 *
 * Mục D chia đôi: file này giữ trạng thái và mọi phép suy luận; `WelcomeScreen.tsx`
 * chỉ vẽ. Mọi chuỗi người đọc — lời chào đã ghép tên, câu trên từng thẻ, lý do một
 * thẻ bị khoá — đều dựng ở đây, nên view không còn gì để ghép sai (A15).
 *
 * ## Cái này gọi lại thứ đã có, không dựng lại thứ nào
 *
 * - **Danh sách dự án** — `useQuery({ queryKey: queryKeys.project.list(), queryFn })`,
 *   đúng hình dạng `useProjectDashboard.ts:220-223` đang chạy. `staleTime` 30 s
 *   thừa kế từ `queryClient.ts`; hook này không viết lại con số đó ở đâu cả (R-64).
 * - **Hàm nạp mặc định** — `fetchProjectList` của `ProjectDashboard/projectsGateway`,
 *   tái dùng qua import chứ không chép lại (contract-data.md Q9, lựa chọn A).
 * - **Thời lượng hoà tan** — `durationMs('standard')` từ `@/lib/motion/tokens`.
 *   Không con số mili giây nào viết tay trong file này (R-71, `local/no-raw-duration`).
 * - **Đường dẫn** — `ROUTES` của `@/routes/paths`. Không chuỗi nào bắt đầu bằng
 *   dấu gạch chéo hay `http` trong mã chạy được (R-65).
 *
 * ## Vì sao nguồn dữ liệu được tiêm vào
 *
 * `fetchList` có mặc định nhưng vẫn là một tuỳ chọn, cùng lý do
 * `useProjectDashboard` làm thế: một bài kiểm dựng đủ bảy trạng thái bằng cách
 * cho lời hứa xong / hỏng / không bao giờ xong, không cần mạng và không cần đồng
 * hồ giả cắm vào bộ nhớ đệm truy vấn.
 *
 * ## Cái này từ chối quyết định
 *
 * **Hộp thoại tạo dự án.** Luồng tạo dự án trong repo là một hộp thoại
 * (`screens/project/CreateProjectModal`) mở bằng trạng thái cục bộ của container
 * (`ProjectDashboard.container.tsx:71`), không phải một URL — `ROUTES` không có
 * mục nào cho nó. Một hook không được nhập component, nên hành động đó ra ngoài
 * dưới dạng `options.onCreateProject`, đúng khuôn `UseProjectDashboardOptions`
 * (`useProjectDashboard.ts:170,447`). Mặc định là về `ROUTES.dashboard` — nơi
 * hộp thoại đó thật sự sống — để prop này không bao giờ là một lỗ hổng im lặng.
 *
 * **Bước 2 và bước 3 "xong" nghĩa là gì.** Gate G1 đã chốt: bước 2 xong ⇔
 * `wallsTotalCount > 0`, bước 3 xong ⇔ `wallsTotalCount > 0 && wallsReviewedCount
 * === wallsTotalCount` — đúng luật `isFullyReviewed` mà `useProjectDashboard.ts:181`
 * đang dùng, và không bao giờ đọc thẳng trường `status`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, type QueryFunction } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { useSession } from '@/hooks/useSession';
import { durationMs } from '@/lib/motion/tokens';
import { queryKeys } from '@/lib/query/queryKeys';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

import { fetchProjectList, type DashboardProject } from '../../dashboard/ProjectDashboard/projectsGateway';

/* -------------------------------------------------------------------------- */
/* View model — khối này chép nguyên văn từ hợp đồng đông cứng, mục 2.         */
/* `WelcomeScreen.tsx` khai LẠI đúng khối này dưới tên `WelcomeScreenProps`;   */
/* người tích hợp ở Layer 3 gộp hai bản thành một `import type`.               */
/* -------------------------------------------------------------------------- */

export type OnboardingStepId = 'createProject' | 'uploadDrawings' | 'reviewAndBuild';

export type OnboardingStepState = 'done' | 'open' | 'locked';

export interface OnboardingStepCard {
  readonly id: OnboardingStepId;
  /** '1' | '2' | '3' — hiện bằng chữ đều (tabular-nums). */
  readonly ordinal: string;
  readonly title: string;
  /** ĐÚNG MỘT CÂU. Không bao giờ là một đoạn. */
  readonly sentence: string;
  readonly actionLabel: string;
  readonly state: OnboardingStepState;
  /** Thẻ chính của màn lúc này — đúng một thẻ có true, hoặc không thẻ nào. */
  readonly isPrimary: boolean;
  /** Câu chú giải vì sao khoá. null khi state !== 'locked'. */
  readonly lockedReason: string | null;
  readonly onActivate: () => void;
}

export interface OnboardingLink {
  readonly label: string;
  /** null = bấm được. Chuỗi = vô hiệu, và chuỗi này là lý do hiện cho người đọc. */
  readonly disabledReason: string | null;
  readonly onActivate: () => void;
}

export interface WelcomeScreenViewModel {
  readonly screenState: SevenState;
  /** true khi phải xếp dọc — story/test bật tay, lúc chạy thật CSS tự lo dưới 1024. */
  readonly isCollapsed: boolean;
  /** 'Chào Minh, bắt đầu trong ba bước' — đã ghép tên, view không ghép gì. */
  readonly greeting: string;
  /** Đoạn hai câu nói sản phẩm làm gì. */
  readonly intro: string;
  /** Luôn đúng thứ tự 1,2,3. Ở 'forbidden' mảng chỉ còn ĐÚNG một phần tử: thẻ 3. */
  readonly cards: readonly OnboardingStepCard[];
  readonly sampleProjectLink: OnboardingLink;
  readonly tutorialLink: OnboardingLink;
  readonly skipLink: OnboardingLink;
  /** Chỉ khác null ở screenState === 'error'. */
  readonly errorMessage: string | null;
  readonly onRetry: () => void;
  /** Chỉ khác null ở screenState === 'success'. */
  readonly finishLabel: string | null;
  readonly onFinish: () => void;
  /** true trong lúc nội dung hoà tan trước khi chuyển trang. */
  readonly isDissolving: boolean;
  /** Câu hiện sau khi bấm 'Bỏ qua'. */
  readonly skipNotice: string;
}

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt — nguồn duy nhất, hợp đồng đông cứng mục 3.                */
/* -------------------------------------------------------------------------- */

const STRINGS = Object.freeze({
  greetingPrefix: 'Chào ',
  greetingSuffix: ', bắt đầu trong ba bước',
  greetingFallback: 'Chào bạn, bắt đầu trong ba bước',
  intro:
    'AppFront đọc bản vẽ kiến trúc của bạn và dò ra trục, tường, phòng, ô mở. Ba bước dưới đây đưa bạn từ tệp bản vẽ tới mô hình không gian xem được.',
  step1Title: 'Tạo dự án',
  step1Sentence: 'Khai báo tên công trình và danh sách tầng.',
  step1Action: 'Tạo dự án',
  step2Title: 'Tải bản vẽ theo từng tầng',
  step2Sentence: 'Kéo ảnh quét hoặc tệp CAD vào từng tầng.',
  step2Action: 'Tải bản vẽ',
  step2Locked: 'Cần tạo dự án trước.',
  step3Title: 'Duyệt kết quả và dựng 3D',
  step3Sentence: 'Kiểm tra tường, cửa, phòng rồi xem mô hình.',
  step3Action: 'Duyệt kết quả',
  step3Locked: 'Cần tải bản vẽ trước.',
  sampleProject: 'Xem dự án mẫu',
  tutorial: 'Xem hướng dẫn 2 phút',
  tutorialDisabled: 'Hướng dẫn hai phút chưa sẵn sàng.',
  skip: 'Bỏ qua',
  skipNotice: 'Có thể xem lại hướng dẫn trong menu trợ giúp.',
  finish: 'Vào danh sách dự án',
  errorDescription: 'Chưa lấy được danh sách dự án nên chưa biết bạn đang ở bước nào.',
});

/* -------------------------------------------------------------------------- */
/* Cờ "đã xem màn chào".                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Tên khoá `localStorage` này VIẾT TAY, ngay trong một màn.
 *
 * Nói thẳng ra vì R-71 bình thường cấm đúng việc này: hằng số — thời lượng,
 * ngưỡng, tên khoá lưu trữ — không được sinh ra trong một màn hình. Gate G1
 * (`gate_daac5b385955`, quyết định 1) vẫn chấp nhận ngoại lệ này, lý do là repo
 * KHÔNG có kho tuỳ chọn theo từng người dùng nào để cắm vào: `flags.ts` là cờ
 * tính năng của cả ứng dụng chứ không phải trạng thái riêng của một người, và
 * `src/store` không giữ gì bền theo `user.id`. Kỹ thuật đọc/ghi bên dưới chép
 * từ `src/hooks/useTheme.ts:12-27`. Khi nào có kho tuỳ chọn thật, chỗ phải sửa
 * là ba hàm ngay dưới đây và không chỗ nào khác.
 */
const WELCOME_SEEN_KEY_PREFIX = 'appfront:onboarding-welcome-seen:';

/** Giá trị ghi vào khoá trên. Chỉ có một giá trị "đã xem"; thiếu khoá là "chưa xem". */
const WELCOME_SEEN_VALUE = 'true';

function welcomeSeenKey(userId: string): string {
  return `${WELCOME_SEEN_KEY_PREFIX}${userId}`;
}

/**
 * Người này đã xem màn chào chưa.
 *
 * Xuất ra vì chốt chặn định tuyến ở Layer 3 cần đọc nó trước khi dựng màn — cùng
 * một khoá, một chỗ. Cửa sổ ẩn danh ném ngay ở `localStorage.getItem`, nên mọi
 * lần đọc đều nằm trong try/catch và "không đọc được" quy về "chưa xem".
 */
export function readWelcomeSeen(userId: string | null): boolean {
  if (userId === null) return false;
  try {
    return window.localStorage.getItem(welcomeSeenKey(userId)) === WELCOME_SEEN_VALUE;
  } catch {
    return false;
  }
}

/** Ghi cờ. Cửa sổ ẩn danh ném ở `setItem`; hỏng cũng không được làm hỏng lượt chuyển trang. */
function markWelcomeSeen(userId: string | null): void {
  if (userId === null) return;
  if (readWelcomeSeen(userId)) return;
  try {
    window.localStorage.setItem(welcomeSeenKey(userId), WELCOME_SEEN_VALUE);
  } catch {
    // Không có chỗ lưu thì màn chào hiện lại lần sau — phiền, không hỏng.
  }
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export interface UseWelcomeScreenOptions {
  /** Cùng khuôn `UseProjectDashboardOptions.fetchList` — test tiêm để dựng bảy trạng thái. */
  readonly fetchList?: QueryFunction<readonly DashboardProject[]>;
  /** Mở hộp thoại tạo dự án. Không truyền thì về `ROUTES.dashboard`, nơi hộp thoại đó sống. */
  readonly onCreateProject?: () => void;
  /** Story/test bật tay trạng thái xếp dọc; lúc chạy thật CSS lo phần dưới 1024. */
  readonly forceCollapsed?: boolean;
}

/** Ổn định giữa các lần vẽ, để memo không đổi trong lúc `listQuery.data` còn `undefined`. */
const EMPTY_PROJECTS: readonly DashboardProject[] = [];

/**
 * Dự án được nhắc tới trên màn này: dự án cập nhật gần đây nhất.
 *
 * `updatedAgoMs` là "cách đây bao lâu", nên nhỏ nhất là mới nhất — cùng luật sắp
 * xếp `'updated'` của `useProjectDashboard.ts:253`.
 */
function mostRecentProject(projects: readonly DashboardProject[]): DashboardProject | null {
  let recent: DashboardProject | null = null;
  for (const project of projects) {
    if (recent === null || project.updatedAgoMs < recent.updatedAgoMs) recent = project;
  }
  return recent;
}

export function useWelcomeScreen(options: UseWelcomeScreenOptions = {}): WelcomeScreenViewModel {
  const navigate = useNavigate();
  const session = useSession();

  const listQuery = useQuery({
    queryKey: queryKeys.project.list(),
    queryFn: options.fetchList ?? fetchProjectList,
  });

  const projects = useMemo(() => listQuery.data ?? EMPTY_PROJECTS, [listQuery.data]);
  const latest = useMemo(() => mostRecentProject(projects), [projects]);

  /* -- Hoà tan rồi mới chuyển trang. --------------------------------------- */

  const [isDissolving, setIsDissolving] = useState(false);
  const leaveTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  const leave = useCallback((go: () => void): void => {
    // Lần bấm thứ hai trong lúc đang hoà tan không được xếp thêm một chuyến đi nữa.
    if (leaveTimer.current !== null) return;
    setIsDissolving(true);
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      go();
    }, durationMs('standard'));
  }, []);

  /* -- Ba bước, suy ra từ dữ liệu truy vấn và không từ đâu khác. ------------ */

  const step1Done = projects.length > 0;
  const step2Done = latest !== null && latest.wallsTotalCount > 0;
  const step3Done =
    latest !== null &&
    latest.wallsTotalCount > 0 &&
    latest.wallsReviewedCount === latest.wallsTotalCount;

  /* -- Trạng thái màn (A11). `forbidden` thắng mọi thứ còn lại. ------------- */

  const isViewer = session.roles[0] === 'viewer';
  const isCollapsed = options.forceCollapsed ?? false;

  const screenState = useMemo<SevenState>(() => {
    if (isViewer) return 'forbidden';
    if (isCollapsed) return 'collapsed';
    if (listQuery.isPending) return 'loading';
    if (listQuery.isError) return 'error';
    if (!step1Done) return 'empty';
    if (step3Done) return 'success';
    return 'partial';
  }, [isViewer, isCollapsed, listQuery.isPending, listQuery.isError, step1Done, step3Done]);

  /* -- Cờ: ghi khi đi hết ba bước, và khi người ta bấm "Bỏ qua". ------------ */

  const userId = session.user?.id ?? null;

  useEffect(() => {
    if (screenState !== 'success') return;
    markWelcomeSeen(userId);
  }, [screenState, userId]);

  /* -- Lời chào: tên → phần trước '@' của email → 'bạn'. -------------------- */

  const greeting = useMemo(() => {
    const name = session.user?.name?.trim();
    if (name !== undefined && name !== '') {
      return `${STRINGS.greetingPrefix}${name}${STRINGS.greetingSuffix}`;
    }
    const localPart = session.user?.email?.split('@')[0]?.trim();
    if (localPart !== undefined && localPart !== '') {
      return `${STRINGS.greetingPrefix}${localPart}${STRINGS.greetingSuffix}`;
    }
    return STRINGS.greetingFallback;
  }, [session.user]);

  /* -- Ba thẻ. -------------------------------------------------------------- */

  const onCreateProject = options.onCreateProject;

  const goCreateProject = useCallback((): void => {
    if (onCreateProject !== undefined) {
      onCreateProject();
      return;
    }
    leave(() => navigate(ROUTES.dashboard));
  }, [onCreateProject, leave, navigate]);

  const goUpload = useCallback((): void => {
    if (latest === null) return;
    leave(() => navigate(ROUTES.project.upload(latest.id)));
  }, [latest, leave, navigate]);

  const goReview = useCallback((): void => {
    if (latest === null) return;
    leave(() => navigate(ROUTES.project.walls(latest.id, latest.defaultFloorId)));
  }, [latest, leave, navigate]);

  const goDashboard = useCallback((): void => {
    leave(() => navigate(ROUTES.dashboard));
  }, [leave, navigate]);

  const cards = useMemo<readonly OnboardingStepCard[]>(() => {
    const card1State: OnboardingStepState = step1Done ? 'done' : 'open';
    const card2State: OnboardingStepState = step2Done ? 'done' : step1Done ? 'open' : 'locked';
    const card3State: OnboardingStepState = step3Done ? 'done' : step2Done ? 'open' : 'locked';

    // Đúng một thẻ là thẻ chính: thẻ mở đầu tiên. Xong cả ba thì không thẻ nào.
    const primaryIndex = [card1State, card2State, card3State].indexOf('open');

    const card1: OnboardingStepCard = {
      id: 'createProject',
      ordinal: '1',
      title: STRINGS.step1Title,
      sentence: STRINGS.step1Sentence,
      actionLabel: STRINGS.step1Action,
      state: card1State,
      isPrimary: primaryIndex === 0,
      lockedReason: null,
      onActivate: goCreateProject,
    };

    const card2: OnboardingStepCard = {
      id: 'uploadDrawings',
      ordinal: '2',
      title: STRINGS.step2Title,
      sentence: STRINGS.step2Sentence,
      actionLabel: STRINGS.step2Action,
      state: card2State,
      isPrimary: primaryIndex === 1,
      lockedReason: card2State === 'locked' ? STRINGS.step2Locked : null,
      onActivate: goUpload,
    };

    const card3: OnboardingStepCard = {
      id: 'reviewAndBuild',
      ordinal: '3',
      title: STRINGS.step3Title,
      sentence: STRINGS.step3Sentence,
      actionLabel: STRINGS.step3Action,
      state: card3State,
      isPrimary: primaryIndex === 2,
      lockedReason: card3State === 'locked' ? STRINGS.step3Locked : null,
      onActivate: goReview,
    };

    // Vai Người xem: mảng còn ĐÚNG một phần tử, và nó luôn mở — người xem duyệt
    // được kết quả, nên thẻ này không bao giờ khoá vì hai bước họ không làm được.
    if (isViewer) {
      return [{ ...card3, state: 'open', isPrimary: true, lockedReason: null }];
    }

    return [card1, card2, card3];
  }, [step1Done, step2Done, step3Done, isViewer, goCreateProject, goUpload, goReview]);

  /* -- Ba liên kết phụ. ----------------------------------------------------- */

  const onSkip = useCallback((): void => {
    markWelcomeSeen(userId);
    leave(() => navigate(ROUTES.dashboard));
  }, [userId, leave, navigate]);

  const sampleProjectLink = useMemo<OnboardingLink>(
    () => ({ label: STRINGS.sampleProject, disabledReason: null, onActivate: goDashboard }),
    [goDashboard],
  );

  // Quyết định 6 của gate G1: S-40 chưa tồn tại trong repo, nên liên kết vẫn hiện
  // — để phép đếm lựa chọn còn đúng 3 thẻ + 2 liên kết phụ + 1 liên kết bỏ qua —
  // nhưng vô hiệu kèm lý do, thay vì dẫn tới một chỗ không có gì.
  const tutorialLink = useMemo<OnboardingLink>(
    () => ({
      label: STRINGS.tutorial,
      disabledReason: STRINGS.tutorialDisabled,
      onActivate: () => {},
    }),
    [],
  );

  const skipLink = useMemo<OnboardingLink>(
    () => ({ label: STRINGS.skip, disabledReason: null, onActivate: onSkip }),
    [onSkip],
  );

  /* -- Lỗi, hoàn tất. ------------------------------------------------------- */

  const refetch = listQuery.refetch;

  const onRetry = useCallback((): void => {
    void refetch();
  }, [refetch]);

  const onFinish = useCallback((): void => {
    markWelcomeSeen(userId);
    leave(() => navigate(ROUTES.dashboard));
  }, [userId, leave, navigate]);

  return {
    screenState,
    isCollapsed,
    greeting,
    intro: STRINGS.intro,
    cards,
    sampleProjectLink,
    tutorialLink,
    skipLink,
    errorMessage: screenState === 'error' ? STRINGS.errorDescription : null,
    onRetry,
    finishLabel: screenState === 'success' ? STRINGS.finish : null,
    onFinish,
    isDissolving,
    skipNotice: STRINGS.skipNotice,
  };
}
