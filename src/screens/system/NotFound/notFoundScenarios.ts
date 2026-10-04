/**
 * Bộ dựng `NotFoundVm` cho bảy trạng thái — viết chỉ từ hợp đồng đông lạnh
 * `notFoundModel.ts`, chạy được ngay, không phụ thuộc view lẫn hook.
 *
 * Chữ đọc từ bảng chữ của `./useNotFound` (B-V1-44) — bản chép tay viết lúc hook
 * chưa có đã lệch hook. Mỗi kịch bản trả về một `NotFoundVm` đầy đủ, sẵn sàng
 * truyền thẳng vào `<NotFound {...vm} />`.
 *
 * ## Cơ chế `state.from` (bài nghiệm thu 1 của `NotFound.test.tsx`)
 *
 * `NotFoundVm.primaryAction.onActivate` là `() => void` đã nối sẵn — hợp đồng
 * nói rõ "view không biết nó đi đâu". `createNotFoundVm` mô phỏng đúng cơ chế
 * ĐÃ CÓ SẴN ở `AuthScreen.container.tsx` (`safeDestination` +
 * `location.state.from`, xem ghi chú khảo sát `01-data-auth.md` mục B.6): ở
 * trạng thái `forbidden`, nút "Đăng nhập" gọi
 * `navigate(ROUTES.login, { state: { from: path } })`, giữ nguyên đường dẫn
 * định đến để đăng nhập xong quay lại đúng chỗ. Tham số `navigate` nhận từ
 * `options` để test tiêm một hàm giả và quan sát lời gọi — khi `useNotFound.ts`
 * thật được viết, người ghép nối lại đúng cơ chế này bằng `useNavigate()` +
 * `useLocation()`, không phải phát minh lại.
 *
 * ## Vì sao chỉ hai trong ba `NotFoundReason` xuất hiện ở đây
 *
 * `notFoundModel.ts` nói rõ `'offline'` "không bao giờ suy đoán từ việc đọc
 * hỏng" — nó chỉ được đặt khi có bằng chứng lỗi mạng thật từ cổng. Bảy trạng
 * thái A11 (`SevenState`) không mang bằng chứng đó, nên bộ dựng tĩnh này chỉ
 * tạo ra hai lý do `'missing'` (mặc định) và `'forbidden'` (trạng thái
 * `forbidden` — chưa đăng nhập). Đặt `reason: 'offline'` là việc của
 * `useNotFound.ts` khi nó thật sự bắt được lỗi mạng từ `NotFoundGateway`.
 */

import { type SevenState } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

import { DESCRIPTION_BY_REASON, NOT_FOUND_TEXT, TITLE_BY_REASON } from './useNotFound';

import {
  NOT_FOUND_ERROR_CODE,
  RECENT_PROJECT_LIMIT,
  type NotFoundAction,
  type NotFoundReason,
  type NotFoundVm,
  type RecentProjectVm,
} from './notFoundModel';

const noop = (): void => undefined;

/** Đường dẫn mẫu — người dùng gõ nhầm hoặc theo một liên kết cũ (ví dụ của chính `notFoundModel.ts`). */
const DEFAULT_PATH = '/du-an/8f2a';

/**
 * Năm dự án mẫu, tiếng Việt có dấu — nhiều hơn {@link RECENT_PROJECT_LIMIT}
 * một khoảng an toàn, để bài nghiệm thu "hiện tối đa X hàng" có dữ liệu THẬT
 * chứng minh view CẮT bớt chứ không phải tình cờ nhận đúng số lượng.
 */
export const SAMPLE_RECENT_PROJECTS: readonly RecentProjectVm[] = [
  {
    id: 'p-nha-pho-nguyen-trai',
    name: 'Nhà phố Nguyễn Trãi',
    to: ROUTES.project.floors('p-nha-pho-nguyen-trai'),
    recencyLabel: 'Cập nhật 2 giờ trước',
  },
  {
    id: 'p-chung-cu-hoang-anh',
    name: 'Chung cư Hoàng Anh',
    to: ROUTES.project.floors('p-chung-cu-hoang-anh'),
    recencyLabel: 'Cập nhật hôm qua',
  },
  {
    id: 'p-biet-thu-thao-dien',
    name: 'Biệt thự Thảo Điền',
    to: ROUTES.project.floors('p-biet-thu-thao-dien'),
    recencyLabel: 'Cập nhật 3 ngày trước',
  },
  {
    id: 'p-van-phong-ben-thanh',
    name: 'Văn phòng Bến Thành',
    to: ROUTES.project.floors('p-van-phong-ben-thanh'),
    recencyLabel: 'Cập nhật tuần trước',
  },
  {
    id: 'p-nha-xuong-binh-tan',
    name: 'Nhà xưởng Bình Tân',
    to: ROUTES.project.floors('p-nha-xuong-binh-tan'),
    recencyLabel: 'Cập nhật tháng trước',
  },
];

/** Đứng thay `useNavigate()` của `react-router-dom` — đúng chữ ký nó cần. */
export type NavigateFn = (to: string, options?: { readonly state?: unknown }) => void;

export interface CreateNotFoundVmOptions {
  /** Đường dẫn hiện tại, hiện trong `errorCaption` và giữ lại qua `state.from`. */
  readonly path?: string;
  /** Đứng thay `useNavigate()` — test tiêm vào để quan sát lời gọi thật. */
  readonly navigate?: NavigateFn;
  /** Đứng thay hành động thật của nút "Quay lại". */
  readonly onBack?: () => void;
}

/** Hai lý do bộ dựng này thật sự tạo ra — xem docblock đầu file vì sao không có `'offline'`. */
type StaticReason = Extract<NotFoundReason, 'missing' | 'forbidden'>;

/*
 * Chữ lấy từ bảng của hook, không chép lại (B-V1-44, mục D): bản chép tay cũ lệch hook
 * ở cả tiêu đề, mô tả lẫn nhãn nút ("Về trang chủ" so với "Về danh sách dự án").
 */
function reasonFor(state: SevenState): StaticReason {
  return state === 'forbidden' ? 'forbidden' : 'missing';
}

function primaryActionFor(reason: StaticReason, path: string, navigate: NavigateFn): NotFoundAction {
  if (reason === 'forbidden') {
    return {
      label: NOT_FOUND_TEXT.signInLabel,
      onActivate: () => {
        navigate(ROUTES.login, { state: { from: path } });
      },
    };
  }

  return {
    label: NOT_FOUND_TEXT.dashboardLabel,
    onActivate: () => {
      navigate(ROUTES.dashboard);
    },
  };
}

/** Dự án gợi ý theo trạng thái — trạng thái chưa có/không có dữ liệu để gợi ý thì rỗng. */
function recentProjectsFor(state: SevenState): readonly RecentProjectVm[] {
  switch (state) {
    case 'partial':
      // "Có gợi ý nhưng chưa đủ bộ": ít hơn RECENT_PROJECT_LIMIT, không phải 0.
      return SAMPLE_RECENT_PROJECTS.slice(0, RECENT_PROJECT_LIMIT - 1);
    case 'success':
    case 'collapsed':
      return SAMPLE_RECENT_PROJECTS.slice(0, RECENT_PROJECT_LIMIT);
    case 'empty':
    case 'loading':
    case 'error':
    case 'forbidden':
      return [];
    default: {
      const exhaustive: never = state;

      throw new Error(`recentProjectsFor: trạng thái không xác định — ${String(exhaustive)}`);
    }
  }
}

/**
 * Dựng đầy đủ một `NotFoundVm` cho một trong bảy trạng thái của A11.
 *
 * @example
 * expectSevenStates(
 *   (scenario) => render(<NotFound {...createNotFoundVm(scenario.state)} />),
 *   createSevenStateScenarios(),
 * );
 */
export function createNotFoundVm(state: SevenState, options: CreateNotFoundVmOptions = {}): NotFoundVm {
  const path = options.path ?? DEFAULT_PATH;
  const navigate = options.navigate ?? noop;
  const reason = reasonFor(state);

  return {
    state,
    reason,
    title: TITLE_BY_REASON[reason],
    description: DESCRIPTION_BY_REASON[reason],
    errorCaption: `${NOT_FOUND_TEXT.errorCodePrefix}${NOT_FOUND_ERROR_CODE}${NOT_FOUND_TEXT.captionSeparator}${path}`,
    primaryAction: primaryActionFor(reason, path, navigate),
    secondaryAction: { label: NOT_FOUND_TEXT.backLabel, onActivate: options.onBack ?? noop },
    recentProjects: recentProjectsFor(state),
    recentHeading: NOT_FOUND_TEXT.recentHeading,
    isCompact: state === 'collapsed',
    prefersReducedMotion: false,
  };
}
