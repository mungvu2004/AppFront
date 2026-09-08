/**
 * Lớp phủ dạy việc sáu bước — bọc `useEditorTour` với ranh giới lỗi và nối đủ
 * props để `<EditorTourContainer />` chạy được ngay, không cần route riêng.
 *
 * Cùng khuôn `WelcomeScreen.container.tsx`:
 *
 * - {@link EditorTourContainer} nhận mọi thứ qua props (mở rộng
 *   `UseEditorTourOptions`), tự lấy người dùng/vai thật từ `useSession()` và
 *   tự nối `onOpenSampleProject` mặc định — R-73 cấm để một hành động ra
 *   ngoài chỉ tồn tại như một prop tuỳ chọn không ai truyền. Người gọi vẫn
 *   ghi đè được từng trường qua props (test/story tiêm `userId: null`, một
 *   `onOpenSampleProject` giả, v.v.).
 * - **Không có route.** Mục F6 của hợp đồng: đây là lớp phủ chạy đè lên màn
 *   QC/3D đang mở, không phải một điểm đến URL riêng — màn chủ tự mount
 *   `<EditorTourContainer />` khi cần.
 *
 * ## `onOpenSampleProject` nối vào đâu, và vì sao phải nối
 *
 * `useEditorTour` để ngỏ `options.onOpenSampleProject` vì hook không được
 * nhập router (mục 0.4 — `src/lib`/hook thuần không gọi `useNavigate`). Đích
 * mặc định là `ROUTES.dashboard` — đúng nơi `WelcomeScreen` cũng đưa người
 * dùng tới khi bấm "Xem dự án mẫu" (`useWelcomeScreen.ts` — `goDashboard`),
 * vì đây là nơi một dự án mẫu thật sự mở được. Nối tại đây, không tại hook,
 * đúng cách `WelcomeScreen.container.tsx` nối `onCreateProject`.
 *
 * ## `userId`/`role` lấy từ `useSession()` tại container, không tại hook
 *
 * `UseEditorTourOptions` nhận `userId`/`role` như hai tham số tiêm được —
 * cùng cách `registry`/`resolveAnchor` được tiêm — để hook test được không
 * cần dựng `SessionProvider`. Container là nơi nối chúng với phiên đăng nhập
 * thật. Dùng so sánh `!== undefined` thay vì `??` cho `userId`: `null` là một
 * giá trị hợp lệ (chưa đăng nhập) mà một lượt gọi có thể cố tình truyền vào,
 * `??` sẽ nuốt mất giá trị đó và thay bằng phiên thật.
 *
 * ## Vì sao phần dự phòng không phủ kín màn hình như `WelcomeCrashFallback`
 *
 * `WelcomeScreen` sở hữu trọn màn hình nên phần dự phòng của nó phủ
 * `absolute inset-0`. `EditorTour` chỉ là một lớp DẠY đè lên màn QC/3D đang
 * chạy thật bên dưới — nếu lớp dạy sập, luật cấm tuyệt đối "không chặn người
 * dùng làm việc" vẫn còn hiệu lực. Phần dự phòng ở đây vì vậy chỉ là một thẻ
 * nhỏ, `pointer-events-none` phủ ngoài để không chắn thao tác, và
 * `pointer-events-auto` riêng cho chính thẻ để nút "thử lại" vẫn bấm được.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import { ROUTES } from '@/routes/paths';

import { EditorTour } from './EditorTour';
import { useEditorTour, type UseEditorTourOptions } from './useEditorTour';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'system-editor-tour';

export interface EditorTourContainerProps extends UseEditorTourOptions {}

/** Thẻ nhỏ, không chắn thao tác — xem docblock đầu file vì sao không phủ kín màn. */
function EditorTourCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto max-w-sm rounded-lg border border-border-default bg-bg-surface shadow-overlay">
        <EmptyState
          icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
          title={report.description.title}
          description={report.description.description}
          {...(report.retryable
            ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
            : {})}
        />
      </div>
    </div>
  );
}

/** Hook và view — nối lại thành một lớp dạy đã sẵn sàng đè lên màn chủ. */
function WiredEditorTour(props: EditorTourContainerProps) {
  const session = useSession();
  const navigate = useNavigate();
  const sessionUserId = session.user?.id ?? null;
  const sessionRole = session.roles[0];

  const openSampleProject = useCallback((): void => {
    navigate(ROUTES.dashboard);
  }, [navigate]);

  const vm = useEditorTour({
    ...props,
    userId: props.userId !== undefined ? props.userId : sessionUserId,
    role: props.role !== undefined ? props.role : sessionRole,
    onOpenSampleProject: props.onOpenSampleProject ?? openSampleProject,
  });

  return <EditorTour {...vm} />;
}

/** `<EditorTourContainer />` — lớp dạy sáu bước, đã nối, sẵn sàng đè lên màn chủ. */
export function EditorTourContainer(props: EditorTourContainerProps) {
  return (
    <ScreenErrorBoundary
      key={SCREEN_ID}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => <EditorTourCrashFallback report={report} retry={retry} />}
    >
      <WiredEditorTour {...props} />
    </ScreenErrorBoundary>
  );
}
