/**
 * Route `ROUTE_PATTERNS.projectRules` — nối hook với view, và với ranh giới lỗi.
 *
 * Khác các container 3D khác trong repo (vốn tách `*.container.tsx` yêu cầu
 * `projectId: string` khỏi một `*Route` mỏng đọc `useParams`), màn này gộp cả
 * hai việc vào đúng một component, theo `wiring.md` mục A: "Làm trong
 * container, chuyển tiếp cho view qua props (khuôn D)". Lý do là R-73 ở đây đòi
 * `projectId` là **tuỳ chọn** — một màn khác nhúng `RuleReportContainer` phải
 * tự truyền được `projectId` của nó vào mà không cần dựng một route giả, nên
 * container đọc `useParams()` làm phương án dự phòng thay vì đòi hỏi nó ở nơi
 * gọi.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản `src/App.tsx` đang gắn
 * (R-62). Phần dự phòng dựng bằng `EmptyState` từ `report.description`, cùng
 * khuôn `BillingScreen.container.tsx`, `ExplodedView.container.tsx`.
 *
 * ## R-73 — nối `ViolationDetailContainer` (S-34) vào đây
 *
 * `ViolationDetail/ViolationDetail.container.tsx` tự khai nó là "tấm trượt mở
 * TRÊN màn báo cáo luật, không phải một trang" và ghi sẵn đúng một thẻ để một
 * màn khác gắn vào — đây là màn đó. "Chọn" một vi phạm (bấm vào câu mô tả — đúng
 * `onSelectRow` hiện có, không phải "Xem", thứ đã có việc riêng: khuôn camera
 * sang màn 3D qua `onViewRow`) mở tấm trượt; `RuleReport.tsx` không đổi một
 * dòng nào, `WiredRuleReport` chỉ bọc thêm `onSelectRow` để vừa giữ hiệu ứng
 * chọn hàng có sẵn (nhấp nháy viền) vừa mở tấm trượt.
 *
 * Danh sách `violations` mà tấm trượt cần KHÔNG chạy lại `runRules` (đúng lệnh
 * cấm ở docblock của `ViolationDetailContainerProps`): nó dựng lại từ
 * `RuleReportRow` — kiểu này mang đủ sáu trường của `Violation`
 * (`entityId`/`message`/`suggestion`/`ruleCode`/`severity`/`levelId`), chỉ thừa
 * ba trường tầng hiển thị (`key`/`levelLabel`/`resolved`). Nguồn là
 * `viewProps.groups` — nó đã gộp cả hàng đang mở lẫn hàng đã xử lý
 * (`useRuleReport.ts` dựng bằng `groupRowsByRule([...visibleRows,
 * ...resolvedRows])`), nên đây là đúng một nguồn, không phải hai sự thật khác
 * nhau.
 *
 * `floorId` đọc từ `state.activeFloorId` — "tầng đang mở ở vỏ" đúng chữ hợp
 * đồng. Khi vỏ chưa mở tầng nào (dự án nhiều tầng chưa chọn tầng, hoặc màn này
 * đứng một mình), dự phòng bằng tầng của chính vi phạm đang mở
 * (`row.levelId`); vẫn không có thì tấm trượt không mở — đúng triết lý đã ghi ở
 * `ViolationDetailContainer`: "một tấm trượt rỗng báo lỗi chồng lên mô hình còn
 * tệ hơn không mở tấm trượt nào".
 */

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { Violation } from '@/domain/rules/registry';
import { useStore } from '@/store';

import { ViolationDetailContainer } from '../ViolationDetail';

import { RuleReport } from './RuleReport';
import type { RuleReportRow } from './types';
import { useRuleReport } from './useRuleReport';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'rule-report';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên chưa mở được báo cáo kiểm tra luật. Quay lại danh sách dự án rồi chọn lại dự án cần xem.';

/** Props thật của container — mọi thứ một màn khác cần để mở màn này (R-73). */
export interface RuleReportContainerProps {
  /** Mã dự án. Khi có, dùng nó thay vì đọc URL — để màn khác nhúng được `RuleReportContainer`. */
  readonly projectId?: string;
  /** Quyền của người đang xem. Chuyển thẳng xuống hook, quyết định trạng thái 6. */
  readonly canEdit?: boolean;
  /** Vỏ ngoài báo màn đang ở chế độ thu gọn. Chuyển thẳng xuống hook, quyết định trạng thái 7. */
  readonly isCompact?: boolean;
}

/** Cùng khuôn `ExplodedViewCrashFallback` — R-62, chữ lấy từ `report.description`. */
function RuleReportCrashFallback({ report, retry }: ScreenErrorFallback) {
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

interface WiredRuleReportProps {
  readonly projectId: string;
  readonly canEdit?: boolean;
  readonly isCompact?: boolean;
}

/** `RuleReportRow` đã mang đủ sáu trường của `Violation` — chỉ lọc bớt ba trường thừa. */
function toViolation(row: RuleReportRow): Violation {
  return {
    entityId: row.entityId,
    message: row.message,
    suggestion: row.suggestion,
    ruleCode: row.ruleCode,
    severity: row.severity,
    levelId: row.levelId,
  };
}

/**
 * Hook cộng view, không có provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `ExplodedView.container.tsx`.
 *
 * `openRowKey` là trạng thái CỦA RIÊNG việc gắn dây này — "hàng nào đang mở
 * tấm trượt" không phải một phần của `RuleReportViewProps` (mục D: hook của
 * S-33 chỉ trả đúng bộ props của view, không thừa trường nào), nên nó sống ở
 * đây, một tầng trên `useRuleReport`, không phải một `useState` mới thêm vào
 * bên trong hook đó.
 */
function WiredRuleReport(props: WiredRuleReportProps) {
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const activeFloorId = useStore((state) => state.activeFloorId);

  const viewProps = useRuleReport({
    projectId: props.projectId,
    ...(props.canEdit !== undefined ? { canEdit: props.canEdit } : {}),
    ...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {}),
  });

  const allRows = useMemo(
    () => viewProps.groups.flatMap((group) => group.rows),
    [viewProps.groups],
  );
  const openIndex = openRowKey === null ? -1 : allRows.findIndex((row) => row.key === openRowKey);
  const openRow = openIndex === -1 ? null : (allRows[openIndex] ?? null);
  const floorId = openRow === null ? null : (activeFloorId ?? openRow.levelId);

  return (
    <div className="relative h-full">
      <RuleReport
        {...viewProps}
        onSelectRow={(rowKey) => {
          viewProps.onSelectRow(rowKey);
          setOpenRowKey(rowKey);
        }}
      />

      {openRow !== null && floorId !== null ? (
        <ViolationDetailContainer
          floorId={floorId}
          initialIndex={openIndex}
          onClose={() => {
            setOpenRowKey(null);
          }}
          projectId={props.projectId}
          violations={allRows.map(toViolation)}
          {...(props.canEdit !== undefined ? { canEdit: props.canEdit } : {})}
          {...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {})}
        />
      ) : null}
    </div>
  );
}

/**
 * `<RuleReportContainer />` khi gắn qua router (đọc `:id` từ URL), hoặc
 * `<RuleReportContainer projectId={...} />` khi một màn khác nhúng nó.
 */
export function RuleReportContainer(props: RuleReportContainerProps) {
  const params = useParams<{ id: string }>();
  const projectId = props.projectId ?? params.id;

  if (projectId === undefined || projectId.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert level="violation" message={MISSING_PARAMS_MESSAGE} title={MISSING_PARAMS_TITLE} />
      </div>
    );
  }

  return (
    <ScreenErrorBoundary
      key={projectId}
      renderFallback={({ report, retry }) => <RuleReportCrashFallback report={report} retry={retry} />}
      screenId={SCREEN_ID}
    >
      <WiredRuleReport
        projectId={projectId}
        {...(props.canEdit !== undefined ? { canEdit: props.canEdit } : {})}
        {...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {})}
      />
    </ScreenErrorBoundary>
  );
}

/** Route thật của màn báo cáo luật, đăng ký tại `src/routes/router.tsx`. */
export function RulesRoute() {
  return <RuleReportContainer />;
}
