/**
 * `MeasurementTool` ĐÃ NỐI DÂY — hook cộng vỏ chung, bọc trong ranh giới lỗi.
 *
 * Đây là thứ router gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <MeasurementToolContainer projectId={projectId} />
 * ```
 *
 * ## Ba tầng, không tầng nào dựng lại tầng dưới
 *
 * 1. `useMeasurementTool` trả về `ViewerShellProps` ĐẦY ĐỦ — `renderScene` đã
 *    cắm sẵn lớp phủ đo cùng canvas của cảnh, `inspectorSections` đã cắm sẵn
 *    mục "Phép đo" — nên file này không dựng một mảnh chrome nào của vỏ.
 * 2. `<ViewerShell {...shellProps} />` là vỏ chung của chín màn 3D, giữ nguyên
 *    ray tầng, camera, phím tắt và bảy trạng thái (R-61, R-64).
 * 3. `MeasurementTool` là view thuần, nằm ở đầu kia của `renderScene`.
 *
 * ## Vì sao cảnh 3D không lắp ở đây
 *
 * `mountMeasurementScene` cần `levels` và `frame` — hai thứ hook đã có sẵn.
 * Container mà tự lắp thì phải dựng lại `toBuildFloorInput` và tự giữ điểm
 * nhìn, tức dựng lại nửa cái hook chỉ để gọi nó. Nên cảnh lắp trong hook, đúng
 * khuôn `useExplodedView`, và `mountScene` ở đây chỉ là chỗ bài kiểm tiêm bản
 * giả để chạy được dưới jsdom.
 *
 * ## Vì sao `ViewerShell` chứ không phải `ViewerShellContainer`
 *
 * Vỏ nhận props chứ không tự đi lấy dữ liệu, và hook đã dựng đủ bộ props ấy.
 * Thêm một container nữa ở giữa là thêm một tầng đọc kho lần thứ hai.
 */

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { useSession } from '@/hooks/useSession';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
// Nhập THẲNG module thay vì qua cửa nhập — xem ghi chú trong
// `useMeasurementToolScene.ts`.
import { ViewerShell } from '@/screens/viewer/ViewerShell/ViewerShell';
import type { ViewerShellGateway } from '@/screens/viewer/ViewerShell/viewerShellGateway';
import type { ProjectRole } from '@/types/project';

import type { MeasurementScreenState, MeasurementToolGateway } from './measurementToolTypes';
import { useMeasurementTool, type UseMeasurementToolOptions } from './useMeasurementTool';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const MEASUREMENT_TOOL_SCREEN_ID = 'measurement-tool';

/** Thiếu mã dự án thì màn nói ra, không để trắng (A11). Cùng khuôn `ExplodedViewRoute`. */
const MISSING_PARAMS_TITLE = 'Thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn không mang mã dự án, nên chưa mở được công cụ đo. Quay lại danh sách dự án rồi chọn lại dự án cần đo.';

/** Props thật của container — mọi thứ một màn khác cần để mở màn này (R-73). */
export interface MeasurementToolContainerProps {
  readonly projectId: string;
  /** Vai của người đang xem. Vắng mặt thì đọc từ phiên đăng nhập. */
  readonly roles?: readonly ProjectRole[];

  /* Chỗ tiêm của story và bài kiểm (R-73 — bản giả phải cắm được vào). */

  /** Cổng riêng của màn (danh sách phép đo, lưu, xoá). */
  readonly gateway?: MeasurementToolGateway;
  /** Cổng của vỏ chung. Vắng mặt thì hook dựng cổng THẬT đọc kho. */
  readonly shellGateway?: ViewerShellGateway;
  /** Đồ thị không gian tiêm thẳng; vắng mặt thì đọc kho. */
  readonly spatial?: NormalizedSpatial | null;
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: MeasurementScreenState;
  readonly isDev?: boolean;
  readonly registry?: ShortcutRegistry;
  /** Khe `/` của vỏ; vỏ gọi nó khi người dùng bấm phím tìm. */
  readonly onOpenSearch?: () => void;
  /** Thay module cảnh, cho bài kiểm không cần WebGL. */
  readonly mountScene?: UseMeasurementToolOptions['mountScene'];
  /** Cảnh đã lắp sẵn; thắng `mountScene` khi có mặt. */
  readonly scene?: UseMeasurementToolOptions['scene'];
}

/** Cùng khuôn `ExplodedViewCrashFallback` — R-62, chữ lấy từ `report.description`. */
function MeasurementToolCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-state-violation-tint" />}
        title={report.description.title}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/**
 * Hook cộng vỏ, không provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `ExplodedView.container.tsx`.
 */
function WiredMeasurementTool(props: MeasurementToolContainerProps) {
  const session = useSession();

  const roleOption = useMemo(
    () =>
      props.roles !== undefined
        ? { roles: props.roles }
        : session.status === 'unknown'
          ? {}
          : { roles: session.roles },
    [props.roles, session.roles, session.status],
  );

  const shellProps = useMeasurementTool({
    projectId: props.projectId,
    ...roleOption,
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.shellGateway !== undefined ? { shellGateway: props.shellGateway } : {}),
    ...(props.spatial !== undefined ? { spatial: props.spatial } : {}),
    ...(props.forceState !== undefined ? { forceState: props.forceState } : {}),
    ...(props.isDev !== undefined ? { isDev: props.isDev } : {}),
    ...(props.registry !== undefined ? { registry: props.registry } : {}),
    ...(props.onOpenSearch !== undefined ? { onOpenSearch: props.onOpenSearch } : {}),
    ...(props.mountScene !== undefined ? { mountScene: props.mountScene } : {}),
    ...(props.scene !== undefined ? { scene: props.scene } : {}),
  });

  return <ViewerShell {...shellProps} />;
}

/** `<MeasurementToolContainer projectId={...} />` — màn thật, đã nối. */
export function MeasurementToolContainer(props: MeasurementToolContainerProps) {
  return (
    <ScreenErrorBoundary
      key={props.projectId}
      renderFallback={(fallback) => <MeasurementToolCrashFallback {...fallback} />}
      screenId={MEASUREMENT_TOOL_SCREEN_ID}
    >
      <WiredMeasurementTool {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Vỏ route — thứ DUY NHẤT trong thư mục màn biết tới `react-router-dom`.
 *
 * Cùng khuôn `ExplodedViewRoute`: đọc tham số đường dẫn và từ chối tử tế khi
 * đường dẫn thiếu mã dự án, thay vì dựng một màn không có gì để đo (A11). Vai
 * không đọc ở đây mà để container tự đọc `useSession()`.
 */
export function MeasurementToolRoute() {
  const { id } = useParams<{ id: string }>();

  if (id === undefined || id.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert
          level="violation"
          message={MISSING_PARAMS_MESSAGE}
          title={MISSING_PARAMS_TITLE}
        />
      </div>
    );
  }

  return <MeasurementToolContainer projectId={id} />;
}
