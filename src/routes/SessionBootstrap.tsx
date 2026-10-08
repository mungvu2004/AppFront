/**
 * Cái cổng mọi màn đi qua trước khi biết mình đang phục vụ ai.
 *
 * Hai nửa, đúng khuôn mục D của `CLAUDE.md`: {@link SessionGate} là view thuần
 * — test được chỉ từ props, không chạm store, không chạm mạng — còn
 * {@link SessionBootstrap} là nửa có trạng thái, nơi duy nhất đọc `useSession()`
 * và gọi `startAppSession()`.
 *
 * ## Vì sao nó phải là một cổng chứ không phải một hiệu ứng phụ
 *
 * Trước lượt này phiên chỉ mở khi ai đó bấm nút đăng nhập, nên tải lại trang ở
 * bất cứ màn nào cũng vào với `roles: []`. Màn con vẫn mount, vẫn hỏi quyền,
 * vẫn nhận câu trả lời sai, rồi vài trăm mili giây sau câu trả lời đổi — người
 * dùng thấy màn nháy "không có quyền" trước khi thấy dữ liệu của chính mình.
 * Cách duy nhất chặn được cái nháy ấy là **không mount màn con** cho tới khi
 * phiên có câu trả lời. Đó là thứ `status === 'unknown'` làm ở đây.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Navigate, matchPath, useLocation } from 'react-router-dom';

import { AlertCircle, WifiOff } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ScreenMain } from '@/components/shell/ScreenMain';
import { getOptionalAuthConfig, getSessionSnapshot, subscribeSession } from '@/lib/auth/state';
import type { SessionStatus } from '@/lib/auth/types';

import { DEV_PUBLIC_ROUTE_PATTERNS, PUBLIC_ROUTE_PATTERNS, ROUTES } from './paths';

export interface SessionGateProps {
  /** Màn con. Chỉ được vẽ khi cổng mở. */
  children: ReactNode;
  /** Đường về màn đăng nhập, đã mang sẵn chỗ người dùng định tới. */
  loginHref: string;
  /** Đường hiện tại có nằm ngoài vòng kiểm soát của phiên không. */
  isPublic: boolean;
  /** Người dùng bấm "thử lại". */
  onRetry: () => void;
  /** Phiên vừa đi từ đã-đăng-nhập sang ẩn danh (F-09a đọc để nói vì sao). */
  sessionEnded: boolean;
  /**
   * Máy chủ không trả lời lượt gia hạn gần nhất.
   *
   * Nhận cả `undefined` chứ không chỉ khuyết: cờ này là tuỳ chọn trên
   * `SessionSnapshot` (lý do ghi trong docblock của nó), nên nơi truyền xuống
   * truyền thẳng giá trị đọc được. Vì vậy mọi chỗ đọc ở đây viết `=== true`.
   */
  serverUnreachable?: boolean | undefined;
  /** Lượt mở phiên hỏng ngay ở bước dựng, trước cả khi có gì để hỏi máy chủ. */
  setupFailed: boolean;
  status: SessionStatus;
  /** Ai đang đăng nhập; đổi giá trị này là gắn lại toàn bộ màn con. */
  userId: string | null;
}

/**
 * Dải báo chiếm cả bề ngang, dùng cho cả ba tình huống hỏng của cổng.
 *
 * `main` do NƠI GỌI quyết định (FIX-381): ở hai nhánh `unknown` dải thay cả cây
 * route nên tự bọc `ScreenMain`; ở nhánh mất kết nối giữa chừng nó đứng TRÊN màn
 * con vốn có `main` của mình, bọc ở đó là hai `main`.
 */
function GateStrip({
  action,
  landmarkLabel,
  message,
}: {
  action: { label: string; onClick: () => void };
  /** Có thì dải là một `region` có tên — cho dải đứng ngoài mọi `main` (axe `region`). */
  landmarkLabel?: string;
  message: string;
}) {
  return (
    <div
      className="w-full p-4"
      {...(landmarkLabel !== undefined ? { role: 'region', 'aria-label': landmarkLabel } : {})}
    >
      <InlineAlert level="attention" message={message} action={action} />
    </div>
  );
}

/**
 * Màn chặn lúc mở app, khi chưa có màn con nào để giữ: một khối giữa màn nói chuyện gì
 * xảy ra và cần làm gì, thay cho một dải nhỏ trên màn trống (BUG-020).
 */
function GateScreen({
  action,
  description,
  icon,
  title,
}: {
  action: { label: string; onClick: () => void };
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <ScreenMain>
      <div className="flex min-h-screen w-full items-center justify-center bg-bg-app p-6">
        <EmptyState icon={icon} title={title} description={description} action={action} />
      </div>
    </ScreenMain>
  );
}

/**
 * Năm nhánh, theo đúng thứ tự này — thứ tự là một phần của hợp đồng.
 *
 * `isPublic` đứng trước mọi thứ khác vì màn đăng nhập phải vẽ được kể cả khi
 * phiên đang hỏng, và phải vẽ được **kể cả khi đã đăng nhập**: người vừa đăng
 * nhập xong còn đang đứng trên `/login` trong lúc màn ấy hẹn giờ chuyển trang.
 *
 * Nhánh công khai cố ý **không** bọc `key` quanh màn con. Một lần gắn lại ở đây
 * huỷ đúng cái hẹn giờ vừa nói (`useAuthScreen.ts`), và người dùng kẹt lại ở
 * biểu mẫu sau khi đã đăng nhập thành công.
 */
/**
 * Vỏ chờ toàn màn: khung xương cùng nền ứng dụng, và một câu nói ra thành lời
 * cho trình đọc màn hình (A11 — chờ không phải màn trắng).
 *
 * Dùng chung với vỏ chờ chunk route của `router.tsx` (B-G-04), để từ "đang mở
 * phiên" sang "đang tải màn hình" màn không nháy: cùng khối, chỉ đổi câu.
 */
export function PendingShell({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="flex min-h-screen w-full items-center justify-center bg-bg-app p-6"
      role="status"
    >
      <Skeleton preset="canvas" className="w-full max-w-3xl" />
    </div>
  );
}

export function SessionGate({
  children,
  isPublic,
  loginHref,
  onRetry,
  serverUnreachable,
  sessionEnded,
  setupFailed,
  status,
  userId,
}: SessionGateProps) {
  if (isPublic) {
    return <>{children}</>;
  }

  if (status === 'unknown') {
    if (setupFailed) {
      return (
        <GateScreen
          icon={<AlertCircle />}
          title="Chưa mở được ứng dụng"
          description="Tải lại trang để thử mở lại."
          action={{ label: 'Tải lại trang', onClick: () => globalThis.location.reload() }}
        />
      );
    }

    if (serverUnreachable === true) {
      // Cùng câu với `errors.network` của `vi.json` ("Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.").
      return (
        <GateScreen
          icon={<WifiOff />}
          title="Mất kết nối máy chủ"
          description="Kiểm tra mạng rồi thử lại."
          action={{ label: 'Thử lại', onClick: onRetry }}
        />
      );
    }

    return (
      <ScreenMain>
        <PendingShell label="Đang mở phiên" />
      </ScreenMain>
    );
  }

  if (status === 'anonymous') {
    return (
      <Navigate
        replace
        to={loginHref}
        {...(sessionEnded ? { state: { notice: 'sessionEnded' } } : {})}
      />
    );
  }

  /*
   * Mất kết nối KHÔNG phải lý do để giấu màn đi: phiên vẫn đúng là phiên nó
   * đang là, và người dùng có thể đang gõ dở. Dải báo đứng trên, màn con vẫn
   * chạy dưới.
   *
   * Hai chỗ ở đây là cấu trúc chứ không phải thẩm mỹ. `<Fragment key={userId}>`
   * là chỗ đổi người thì màn con gắn lại, để dữ liệu người cũ không theo sang.
   * Và nó đứng ở **cùng một vị trí** trong cây dù dải có hiện hay không — bọc
   * thêm một `div` lúc có dải là gắn lại cả màn, làm mất phần sửa chưa lưu,
   * đúng lúc người dùng vừa được dặn là đừng tải lại trang.
   */
  return (
    <>
      {serverUnreachable === true ? (
        <GateStrip
          landmarkLabel="Trạng thái kết nối"
          message="Mất kết nối tới máy chủ, đang thử lại — đừng tải lại trang kẻo mất thay đổi"
          action={{ label: 'Thử lại', onClick: onRetry }}
        />
      ) : null}
      <Fragment key={userId ?? ''}>{children}</Fragment>
    </>
  );
}

/** Đường hiện tại có phải một màn ai cũng vào được không. */
function matchesPublicRoute(pathname: string): boolean {
  const patterns: readonly string[] = import.meta.env.DEV
    ? [...PUBLIC_ROUTE_PATTERNS, ...DEV_PUBLIC_ROUTE_PATTERNS]
    : PUBLIC_ROUTE_PATTERNS;

  return patterns.some((path) => matchPath({ path, end: true }, pathname) !== null);
}

/**
 * Nửa có trạng thái: đọc phiên, mở phiên, và đưa mọi thứ xuống cổng.
 *
 * ## Vì sao KHÔNG dùng `useSession()` và KHÔNG nhập `./sessionSetup` tĩnh
 *
 * Route gốc nhập tĩnh module này, nên **mọi thứ module này nhập tĩnh đều nằm
 * trong chunk vào** — thứ người dùng tải về trước khi thấy một điểm ảnh nào.
 * `useSession` (`@/hooks/useSession`) nhập `@/lib/auth/session`, mà `session.ts`
 * kéo theo `@/lib/http` và `./refresh` (zod); `./sessionSetup` kéo thêm store,
 * `queryClient` và sổ theo dõi nền. Đã **đo**: cả khối ấy là **21,5 KiB gzip**
 * trên chunk vào, đủ làm hỏng cổng ngân sách (182,0 / 175 KiB).
 *
 * Nên phiên được đọc thẳng từ `@/lib/auth/state` — file chỉ có đúng một dòng
 * `import type`, không kéo theo mã chạy nào — và hành vi y hệt, vì
 * `getSession`/`subscribeToSession` của `session.ts` chỉ là lớp bọc gọi thẳng
 * `getSessionSnapshot`/`subscribeSession`. Còn `./sessionSetup` được nạp bằng
 * `import()` **động**, đúng cách chính nó đã làm với `@/api/appClient`.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  const location = useLocation();
  const [setupFailed, setSetupFailed] = useState(false);
  const previousStatus = useRef(session.status);
  const sessionEnded = useRef(false);

  /*
   * "Phiên vừa kết thúc" tính NGAY trong lượt vẽ, không đợi một effect.
   *
   * Lượt chuyển hướng xảy ra ở đúng lượt vẽ đầu tiên thấy `anonymous`; một
   * effect chạy sau đó, nên `<Navigate>` đã đi rồi và đi tay không. Đây là một
   * giá trị suy từ lượt vẽ trước chứ không phải một trạng thái riêng, nên nó là
   * `useRef` chứ không phải `useState` — không có lượt vẽ thừa nào.
   */
  if (previousStatus.current === 'authenticated' && session.status === 'anonymous') {
    sessionEnded.current = true;
  } else if (session.status === 'authenticated') {
    sessionEnded.current = false;
  }

  previousStatus.current = session.status;

  useEffect(() => {
    let cancelled = false;

    void import('./sessionSetup')
      .then(({ startAppSession }) => startAppSession())
      .catch(() => {
        if (!cancelled) {
          setSetupFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onRetry = useCallback(() => {
    setSetupFailed(false);
    void import('./sessionSetup')
      .then(({ retryAppSession }) => retryAppSession())
      .catch(() => setSetupFailed(true));
  }, []);

  return (
    <SessionGate
      isPublic={matchesPublicRoute(location.pathname)}
      loginHref={`${ROUTES.login}?next=${encodeURIComponent(location.pathname + location.search)}`}
      onRetry={onRetry}
      sessionEnded={sessionEnded.current}
      serverUnreachable={session.serverUnreachable}
      // "Chưa mở được ứng dụng" chỉ đúng khi tầng phiên vẫn chưa cấu hình: màn khác thử lại
      // cấu hình được rồi thì cổng rơi về nhánh `serverUnreachable` → "Thử lại" (NO-372).
      setupFailed={setupFailed && getOptionalAuthConfig() === null}
      status={session.status}
      userId={session.user?.id ?? null}
    >
      {children}
    </SessionGate>
  );
}
