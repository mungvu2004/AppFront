/**
 * Cột phải của Cổng chất lượng đầu vào — bốn chỉ số, dự báo, danh sách phát
 * hiện, và bảng bốn tầng.
 *
 * ## Vì sao có hai `Record` tra cứu ở đây mà không phải trong hook
 *
 * `types.ts` không mang một trường chuỗi nào cho nhãn ba mức ("tốt"/"cần chú
 * ý"/"kém") hay cho việc tô màu hàng tầng — `InputQualityMetricModel` đã có sẵn
 * `statusCode` (dùng thẳng cho `Badge`), nhưng `InputQualityFloorRow` chỉ có
 * `level`. Đây không phải một phép đo hay một ngưỡng nghiệp vụ (mục CẤM "không
 * tự tính chỉ số ảnh, không tự đặt ngưỡng") — ba mức đã được hook chốt xong,
 * `QUALITY_LEVEL_LABELS`/`QUALITY_LEVEL_TO_STATUS` chỉ là bảng tra tên hiển thị
 * cho một enum ba giá trị đã có sẵn, cùng khuôn `variantStyles` của
 * `Badge.tsx`. `'good'` tra ra `'neutral'`, không bao giờ `'verified'` (A5).
 *
 * ## Nổi bật một chiều
 *
 * `InputQualityReportPanelProps` không mang `image.highlightedRegionId` — panel
 * này chỉ BẮN `onHoverRegion`/`onHoverFinding` ra ngoài khi người dùng rê chuột
 * hoặc focus vào một chỉ số/phát hiện, nó không tô sáng ngược lại chính mình
 * khi ảnh bên cột trái được hover. Viền "nổi bật" (`duration-fast`) ở đây là
 * trạng thái hover/focus riêng của từng thẻ, không phải một chỉ báo hai chiều.
 *
 * ## Thẻ đã xử lý không mang `statusCode: 'verified'`
 *
 * `isResolved` chỉ đổi HÌNH DẠNG (thẻ đầy đủ → một dòng), không đổi màu: dòng
 * đã xử lý vẫn đọc đúng `finding.statusCode` mà hook đưa xuống, dù hành động
 * bấm "đã xử lý" là của người dùng — xanh "đã xác minh" vẫn chỉ dành cho việc
 * người duyệt làm, không dành cho kết quả máy đo (A5).
 */

import { clsx } from 'clsx';
import { Check, CheckCircle2 } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { AnimatePresence, motion } from '@/components/motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { useCountUp } from '@/hooks/useCountUp';
import { durationSeconds } from '@/lib/motion';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

import type {
  InputQualityFindingModel,
  InputQualityFloorRow,
  InputQualityMetricModel,
  InputQualityReportPanelProps,
  QualityLevel,
} from './types';

/** Ba mức, tra tên hiển thị — viết thường kiểu câu (A6), cùng khuôn `Badge` nội bộ. */
const QUALITY_LEVEL_LABELS: Record<QualityLevel, string> = {
  good: 'tốt',
  attention: 'cần chú ý',
  poor: 'kém',
};

/** `'good'` → `'neutral'`, không bao giờ `'verified'` — bằng chứng A5 nhắc ở đầu file. */
const QUALITY_LEVEL_TO_STATUS: Record<QualityLevel, ViewStatusCode> = {
  good: 'neutral',
  attention: 'attention',
  poor: 'violation',
};

/** Cùng bảng `dotStyles` của `Badge.tsx` — dùng cho chấm trạng thái đứng một mình trên thẻ phát hiện. */
const STATUS_DOT_TOKEN: Record<ViewStatusCode, string> = {
  verified: 'bg-state-verified',
  attention: 'bg-state-attention',
  violation: 'bg-state-violation',
  neutral: 'bg-text-muted',
};

const STATUS_TEXT_TOKEN: Record<ViewStatusCode, string> = {
  verified: 'text-state-verified-text',
  attention: 'text-state-attention-text',
  violation: 'text-state-violation-text',
  neutral: 'text-text-secondary',
};

const FINDINGS_HEADING = 'Phát hiện';
const FLOORS_HEADING = 'Các tầng đã đo';
const COLUMN_FLOOR = 'tầng';
const COLUMN_SUMMARY = 'kết quả đo';
const COLUMN_LEVEL = 'mức';
const NOT_MEASURED_TEXT = 'chưa đo';
const REMAINING_SUFFIX = ' phát hiện còn lại';
const RESOLVED_SUFFIX = 'đã xử lý';

/** Lớp dùng chung cho vòng tiêu điểm 2px + lệch 2px của A12. */
const FOCUS_RING_CLASSES = 'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

interface MetricRowProps {
  readonly metric: InputQualityMetricModel;
  readonly onHoverRegion: (regionId: string | null) => void;
}

/** Một chỉ số: tên · giá trị canh phải cột cố định · badge ba mức · khuyến nghị (nếu có). */
function MetricRow({ metric, onHoverRegion }: MetricRowProps) {
  const regionId = metric.regionId;
  const isLinked = regionId !== null;

  return (
    <li>
      <div
        className={clsx(
          'flex items-center gap-3 rounded-[8px] border border-transparent px-2 py-1.5 outline-none transition-colors duration-fast',
          isLinked && clsx('hover:border-accent focus-within:border-accent', FOCUS_RING_CLASSES),
        )}
        {...(isLinked
          ? {
              tabIndex: 0,
              onMouseEnter: () => onHoverRegion(regionId),
              onMouseLeave: () => onHoverRegion(null),
              onFocus: () => onHoverRegion(regionId),
              onBlur: () => onHoverRegion(null),
            }
          : {})}
      >
        <span className="flex-1 text-[14px] text-text-primary">{metric.label}</span>
        <span className="w-[92px] shrink-0 text-right text-[13px] tabular-nums text-text-secondary">
          {metric.valueText}
        </span>
        <Badge variant={metric.statusCode}>{QUALITY_LEVEL_LABELS[metric.level]}</Badge>
      </div>
      {metric.recommendation !== null && (
        <p className={clsx('px-2 pb-1 text-[12px]', STATUS_TEXT_TOKEN[metric.statusCode])}>
          {metric.recommendation}
        </p>
      )}
    </li>
  );
}

interface FindingListItemProps {
  readonly finding: InputQualityFindingModel;
  readonly onHoverFinding: (findingId: string | null) => void;
  readonly onHoverRegion: (regionId: string | null) => void;
  readonly onPickCorners: () => void;
  readonly onStraighten: () => void;
}

/** Một phát hiện: chấm trạng thái · tiêu đề · câu hậu quả · nút sửa nhanh (nếu có). */
function FindingListItem({
  finding,
  onHoverFinding,
  onHoverRegion,
  onPickCorners,
  onStraighten,
}: FindingListItemProps) {
  const action = finding.action;

  const beginHover = (): void => {
    onHoverFinding(finding.id);
    onHoverRegion(finding.regionId);
  };
  const endHover = (): void => {
    onHoverFinding(null);
    onHoverRegion(null);
  };

  return (
    <motion.li className="overflow-hidden" layout transition={{ duration: durationSeconds('standard') }}>
      {finding.isResolved ? (
        <div className="flex items-center gap-2 rounded-[12px] bg-bg-surface px-4 py-2">
          <Check aria-hidden="true" className={clsx('h-4 w-4 shrink-0', STATUS_TEXT_TOKEN[finding.statusCode])} />
          <span className="text-[13px] text-text-secondary">
            {finding.title} — {RESOLVED_SUFFIX}
          </span>
        </div>
      ) : (
        <div
          className={clsx(
            'flex flex-col gap-3 rounded-[12px] border border-transparent bg-bg-surface p-4 outline-none',
            'transition-colors duration-fast hover:border-accent focus-within:border-accent',
            FOCUS_RING_CLASSES,
          )}
          onBlur={endHover}
          onFocus={beginHover}
          onMouseEnter={beginHover}
          onMouseLeave={endHover}
          tabIndex={0}
        >
          <div className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_TOKEN[finding.statusCode])}
            />
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-medium text-text-primary">{finding.title}</p>
              <p className="text-[13px] text-text-secondary">{finding.consequence}</p>
            </div>
          </div>

          {action !== null && (
            <Button
              onClick={() => (action.kind === 'straighten' ? onStraighten() : onPickCorners())}
              size="sm"
              variant="secondary"
            >
              {action.label}
            </Button>
          )}
        </div>
      )}
    </motion.li>
  );
}

interface FloorsTableProps {
  readonly floors: readonly InputQualityFloorRow[];
  readonly onSelectFloor: (floorId: string) => void;
}

/** Bảng bốn tầng — bấm hoặc Enter để chọn, dòng đang xem đánh dấu `aria-current`. */
function FloorsTable({ floors, onSelectFloor }: FloorsTableProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-medium text-text-secondary">{FLOORS_HEADING}</h3>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{COLUMN_FLOOR}</Table.Head>
            <Table.Head>{COLUMN_SUMMARY}</Table.Head>
            <Table.Head>{COLUMN_LEVEL}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {floors.map((floor) => (
            <Table.Row
              aria-current={floor.isActive ? 'true' : undefined}
              className="cursor-pointer"
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSelectFloor(floor.id);
                }
              }}
              selected={floor.isActive}
              tabIndex={0}
            >
              <Table.Cell className="font-medium">{floor.label}</Table.Cell>
              <Table.Cell className="text-text-secondary">{floor.summaryText}</Table.Cell>
              <Table.Cell>
                {floor.level === null ? (
                  <span className="text-text-muted">{NOT_MEASURED_TEXT}</span>
                ) : (
                  <Badge variant={QUALITY_LEVEL_TO_STATUS[floor.level]}>{QUALITY_LEVEL_LABELS[floor.level]}</Badge>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
}

export function InputQualityGateReportPanel({
  actions,
  findings,
  floors,
  forecast,
  metrics,
  partialNotice,
  passNotice,
  remainingFindingCount,
}: InputQualityReportPanelProps) {
  // Bộ đếm chỉ chạy khi có danh sách phát hiện để đếm — trạng thái "đạt" không
  // vẽ bộ đếm này (xem nhánh `passNotice` dưới). Gọi hook vô điều kiện (luật
  // hook), chỉ ẩn phần hiển thị khi rỗng — cùng khuôn `FloorUploadFooter.tsx`.
  const hasFindings = findings.length > 0;
  const remaining = useCountUp(hasFindings ? remainingFindingCount : Number.NaN, {
    format: { fractionDigits: 0, grouping: false },
    from: remainingFindingCount,
  });

  return (
    <section aria-label="Báo cáo chất lượng" className="flex h-full flex-col gap-5">
      <ul className="flex flex-col gap-1">
        {metrics.map((metric) => (
          <MetricRow key={metric.id} metric={metric} onHoverRegion={actions.onHoverRegion} />
        ))}
      </ul>

      <p className="text-[13px] text-text-secondary">{forecast.text}</p>

      {partialNotice !== null && <InlineAlert level="attention" message={partialNotice} />}

      {passNotice !== null ? (
        <div className="flex items-center gap-3 rounded-[12px] border border-border-default bg-bg-surface p-4">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-text-secondary" />
          <p className="text-[14px] text-text-primary">{passNotice}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-text-secondary">{FINDINGS_HEADING}</h3>
            {hasFindings && (
              <p className="text-[13px] text-text-secondary">
                <span aria-hidden="true">
                  {remaining.text}
                  {REMAINING_SUFFIX}
                </span>
                <span className="sr-only" role="status">
                  {remainingFindingCount}
                  {REMAINING_SUFFIX}
                </span>
              </p>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {findings.map((finding) => (
                <FindingListItem
                  finding={finding}
                  key={finding.id}
                  onHoverFinding={actions.onHoverFinding}
                  onHoverRegion={actions.onHoverRegion}
                  onPickCorners={actions.onPickCorners}
                  onStraighten={actions.onStraighten}
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <FloorsTable floors={floors} onSelectFloor={actions.onSelectFloor} />
    </section>
  );
}
