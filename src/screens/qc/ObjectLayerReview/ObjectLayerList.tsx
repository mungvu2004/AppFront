/**
 * Danh sách đối tượng của panel trái — hàng đợi các nhóm gấp được theo trạng thái (Máy chưa chắc,
 * Chưa gắn tường, Không thấy điểm nghi, Đã duyệt; Z/S-16). Mỗi dòng MỘT hàng cao 32: số (hoặc biểu tượng
 * loại) · loại đồ · mã · một dấu trạng thái. Kích thước và tường chủ ở panel phải khi chọn, và ở gợi ý khi
 * rê chuột; lý do chung của nhóm nói ở đầu nhóm, không lặp ở từng dòng.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng {@link ObjectLayerListViewProps},
 * không `@/api`, không `@/store`, không `@/domain`, không `@/lib/http`.
 *
 * ## Không định dạng một con số nào
 *
 * `sizeLabel` tới nơi đã là `"900 × 2.200 mm"` — dấu nghìn là dấu chấm, dấu thập
 * phân là dấu phẩy, đúng P-01 và A15 — và `codeLabel` tới nơi đã là `"#D-007"`.
 * File này KHÔNG gọi một hàm định dạng số nào và không nhân chia một đơn vị
 * nào; `local/no-raw-number` chặn cả ba đường, và đó là chủ ý: một màn hình tự
 * định dạng lấy số của nó là một màn hình sẽ định dạng khác màn bên cạnh.
 *
 * ## Mỗi đối tượng phải nói rõ tường nào chứa nó
 *
 * CẤM TUYỆT ĐỐI của đặc tả gốc: "mọi đối tượng phải nói rõ tường nào chứa nó,
 * hoặc bị gắn cờ nếu không có". `hostWallLabel === null` là cách hợp đồng nói
 * "chưa gắn", và dòng đó đứng trong nhóm "Chưa gắn vào tường" kèm nút "Gắn tường"
 * (`row.isOrphan` — chỉ lỗ mở; nội thất đứng tự do ghi "Không gắn tường" ở gợi ý
 * của dòng và panel phải, B-V6-13). Hành động ấy chỉ
 * GỌI ra props — việc tìm tường nào gần nhất là của M-08 ở tầng hook, màn không
 * tự tìm.
 *
 * ## Vì sao KHÔNG dùng `Table.Row`
 *
 * `docs/contracts/ui.md` mục H1 ghi `Table.Row` có vòng tiêu điểm điều khiển
 * bằng state, thứ làm hỏng `expectAccessible`. Dòng ở đây là `role="option"`
 * thuần với `focus-visible:` dạng class — đúng cách khắc phục mục đó chỉ ra, và
 * cùng cách màn tường anh em đã chọn.
 */

import { Check, ChevronDown, ChevronRight, CircleDashed, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ObjectSubtypeIcon } from './objectLayerSubtypeIcons';
import type { ObjectLayerListViewProps } from './objectLayerSymbols';
import type { ObjectListRowViewModel } from './objectLayerTypes';
import { OBJECT_REASON_TITLE, objectReasonOf, type ObjectReviewReason } from './objectReviewReasons';
import { queueNumbersOf } from '../shared/qcAsk';
import { QcQueueNumber } from '../shared/QcQueueNumber';

/* Chuỗi tiếng Việt tĩnh — chép từ `.orca-notes/S13-SPEC-GOC.md` phần IV (A6). */

const LIST_LABEL = 'Danh sách đối tượng';
const ORPHAN_BADGE = 'Chưa gắn vào tường nào';
/** Gợi ý của máy chưa nhận (B3). */
const SUGGESTION_BADGE = 'Gợi ý';
const ATTACH_ACTION = 'Gắn vào tường gần nhất';
const ATTACH_SHORT = 'Gắn tường';
/** Nội thất không áp tường nào — chỗ đứng bình thường của nó, không phải việc phải làm. */
const FREE_STANDING = 'Không gắn tường';
/** Lý do chú ý bằng chữ thay cho con số tin cậy "0,26" (K07). */
const LOW_CONFIDENCE_BADGE = 'Máy chưa chắc';
const EMPTY_GROUP = 'Chưa có đối tượng nào trong nhóm này';
/* Rỗng vì bộ lọc hoặc ô tìm, không phải vì chưa có (G4a-26, G4a-37). */
const EMPTY_FILTERED = 'Không có đối tượng nào khớp bộ lọc hoặc ô tìm đang dùng';
const EXPAND_PREFIX = 'Mở nhóm ';
const COLLAPSE_PREFIX = 'Gấp nhóm ';

const STATUS_LABEL = {
  verified: 'Đã duyệt',
  attention: 'Cần chú ý',
  violation: 'Vi phạm',
  neutral: 'bình thường',
} as const;

/* -------------------------------------------------------------------------- */
/* Một dòng.                                                                   */
/* -------------------------------------------------------------------------- */

interface ObjectLayerListRowProps {
  readonly row: ObjectListRowViewModel;
  readonly isSelected: boolean;
  /** Số hàng đợi — trùng ghim số trên bản vẽ; `undefined` = dòng đã duyệt. */
  readonly queueNumber?: number | undefined;
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;
  readonly onAttachToNearestWall: (objectId: string) => void;
}

/** Một dấu trạng thái cuối dòng: hình kèm màu (A4); lý do chung của cả nhóm thì đầu nhóm đã nói, không vẽ lại. */
function ObjectRowMark({ row }: { readonly row: ObjectListRowViewModel }) {
  const mark = (className: string, title: string, icon: ReactNode, testId?: string) => (
    <span className={cn('flex w-4 shrink-0 justify-center', className)} data-testid={testId} title={title}>
      {icon}
      <span className="sr-only">{title}</span>
    </span>
  );

  /* Cửa đi hẹp bất thường: số đọc sai thường gặp, nhắc kiểm lại ngay trên dòng (UX-48). */
  if (row.sizeWarning != null) {
    return mark('text-state-attention-text', row.sizeWarning, <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />, 'object-size-warning');
  }
  if (row.isSuggested === true) {
    return mark('text-text-secondary', SUGGESTION_BADGE, <CircleDashed aria-hidden="true" className="h-3.5 w-3.5" />);
  }
  if (row.isReviewed) {
    return mark('text-state-verified-text', STATUS_LABEL.verified, <Check aria-hidden="true" className="h-3.5 w-3.5" />);
  }
  if (row.statusCode === 'violation') {
    return mark('text-state-violation', STATUS_LABEL.violation, <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />);
  }

  return <span aria-hidden="true" className="w-4 shrink-0" />;
}

function ObjectLayerListRow({
  row,
  isSelected,
  queueNumber,
  onSelect,
  onHover,
  onAttachToNearestWall,
}: ObjectLayerListRowProps) {
  /* Lý do chú ý nói bằng chữ, cùng luật với câu "N mục máy chưa chắc" đầu panel (K07). */
  const isUncertain = row.isLowConfidence && !row.isReviewed;
  const reason = row.isSuggested === true
    ? SUGGESTION_BADGE
    : isUncertain
    ? LOW_CONFIDENCE_BADGE
    : row.isOrphan && !row.isReviewed
      ? ORPHAN_BADGE
      : STATUS_LABEL[row.statusCode];
  const isFreeStanding = !row.isOrphan && row.hostWallLabel === null;
  /* Chi tiết của dòng gấp vào gợi ý và mô tả cho trình đọc màn hình; đủ ở panel phải khi chọn. */
  const detail = `${row.sizeLabel} · ${row.isOrphan ? ORPHAN_BADGE : (row.hostWallLabel ?? FREE_STANDING)}`;

  return (
    <div
      aria-description={detail}
      aria-label={`${row.codeLabel} ${row.typeLabel} — ${reason}`}
      aria-selected={isSelected}
      data-object-id={row.id}
      className={cn(
        'flex h-8 scroll-mt-7 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] outline-hidden',
        'transition-colors duration-120 hover:bg-bg-hover',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:ring-offset-2',
        isSelected && 'bg-accent-wash hover:bg-accent-wash',
      )}
      onClick={() => onSelect(row.id)}
      onKeyDown={(event) => {
        /* Enter trên nút "Gắn tường" là của nút, không phải chọn dòng. */
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onSelect(row.id);
        }
      }}
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
      role="option"
      tabIndex={0}
      title={detail}
    >
      {queueNumber === undefined ? (
        <span className="flex w-5 shrink-0 justify-center">
          <ObjectSubtypeIcon className="h-4 w-4 text-text-secondary" subtype={row.subtype} />
        </span>
      ) : (
        <QcQueueNumber current={isSelected} n={queueNumber} />
      )}
      <span className="min-w-0 flex-1 truncate text-text-primary">{row.typeLabel}</span>
      {isFreeStanding ? (
        <span className="sr-only" data-testid="object-free-standing" title={FREE_STANDING}>
          {FREE_STANDING}
        </span>
      ) : null}
      {row.isOrphan ? (
        <button
          aria-label={ATTACH_ACTION}
          className={cn(
            'h-6 shrink-0 rounded-md px-1.5 text-[12px] text-accent',
            'transition-colors duration-120 hover:bg-accent-wash',
            'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
          onClick={(event) => {
            /* Bấm hành động KHÔNG kéo theo một lượt chọn dòng ngoài ý muốn. */
            event.stopPropagation();
            onAttachToNearestWall(row.id);
          }}
          title={ATTACH_ACTION}
          type="button"
        >
          {ATTACH_SHORT}
        </button>
      ) : null}
      <span className="shrink-0 tabular-nums text-[12px] text-text-muted">{row.codeLabel}</span>
      <ObjectRowMark row={row} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Một nhóm gấp được.                                                          */
/* -------------------------------------------------------------------------- */

type QueueGroupId = 'reviewed' | ObjectReviewReason | 'clear';

/** "Cần duyệt" tách theo lý do máy nghi, cùng thứ tự hàng đợi của hook. */
const REASON_GROUPS: readonly { readonly id: QueueGroupId; readonly label: string }[] = [
  { id: 'uncertain', label: OBJECT_REASON_TITLE.uncertain },
  { id: 'orphan', label: OBJECT_REASON_TITLE.orphan },
  { id: 'clear', label: 'Không thấy điểm nghi' },
  { id: 'reviewed', label: 'Đã duyệt' },
];

const rowsOfGroup = (rows: readonly ObjectListRowViewModel[], id: QueueGroupId): readonly ObjectListRowViewModel[] => {
  if (id === 'reviewed') return rows.filter((row) => row.isReviewed);
  if (id === 'clear') return rows.filter((row) => !row.isReviewed && objectReasonOf(row) === null);
  return rows.filter((row) => objectReasonOf(row) === id);
};

interface ObjectLayerListGroupProps {
  readonly isFiltered: boolean;
  readonly group: QueueGroupId;
  readonly label: string;
  readonly rows: readonly ObjectListRowViewModel[];
  readonly isCollapsed: boolean;
  readonly selectedObjectId: string | null;
  readonly queueNumbers: ReadonlyMap<string, number>;
  readonly onToggleCollapsed: (group: QueueGroupId) => void;
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;
  readonly onAttachToNearestWall: (objectId: string) => void;
}

/** Một nhóm của hàng đợi: một lý do máy nghi, "Không thấy điểm nghi" hoặc "Đã duyệt". */
function ObjectLayerListGroup({
  isFiltered,
  group,
  label,
  rows,
  isCollapsed,
  selectedObjectId,
  queueNumbers,
  onToggleCollapsed,
  onSelect,
  onHover,
  onAttachToNearestWall,
}: ObjectLayerListGroupProps) {
  const bodyId = `object-layer-group-${group}`;

  return (
    <section className="flex flex-col">
      {/* Đầu nhóm dính đỉnh vùng cuộn, như danh sách tường. */}
      <button
        aria-controls={bodyId}
        aria-expanded={!isCollapsed}
        aria-label={`${isCollapsed ? EXPAND_PREFIX : COLLAPSE_PREFIX}${label.toLowerCase()}`}
        className={cn(
          'sticky top-0 z-10 flex h-7 items-center gap-1 bg-bg-surface px-2 text-left text-caption font-medium text-text-secondary',
          'transition-colors duration-120 hover:text-text-primary',
          'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
        onClick={() => onToggleCollapsed(group)}
        type="button"
      >
        {isCollapsed ? (
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-text-muted">{rows.length}</span>
      </button>

      {isCollapsed ? null : (
        <div aria-label={label} className="flex flex-col" id={bodyId} role="listbox">
          {rows.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-text-muted">{isFiltered ? EMPTY_FILTERED : EMPTY_GROUP}</p>
          ) : (
            rows.map((row) => (
              <ObjectLayerListRow
                isSelected={row.id === selectedObjectId}
                key={row.id}
                onAttachToNearestWall={onAttachToNearestWall}
                onHover={onHover}
                onSelect={onSelect}
                queueNumber={queueNumbers.get(row.id)}
                row={row}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Danh sách.                                                                  */
/* -------------------------------------------------------------------------- */

export function ObjectLayerList({
  codeQuery = '',
  isFiltered = false,
  onAttachToNearestWall,
  onHover,
  onSelect,
  rows,
  selectedObjectId,
}: ObjectLayerListViewProps & {
  /** Chữ ở ô tìm mã (nút tìm ở thanh đầu cột): chỉ lọc dòng của danh sách, không đụng canvas hay bộ lọc của hook. */
  readonly codeQuery?: string | undefined;
}) {
  /* Cùng `items` với thẻ hỏi và ghim số, đếm trên mọi dòng (không phải dòng sau ô tìm) để dòng "3" = ghim "3". */
  const queueNumbers = queueNumbersOf(rows.map((row) => ({ id: row.id, pending: !row.isReviewed })));
  /* Gấp nhóm là việc trình bày thuần của danh sách — state cục bộ, không lên hook. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<QueueGroupId>>(new Set());
  const toggleCollapsed = (group: QueueGroupId) =>
    setCollapsed((previous) => {
      const next = new Set(previous);

      if (!next.delete(group)) {
        next.add(group);
      }

      return next;
    });
  const needle = codeQuery.trim().replace(/^#/, '').toLowerCase();
  const shownRows =
    needle === '' ? rows : rows.filter((row) => row.codeLabel.replace(/^#/, '').toLowerCase().includes(needle));

  /* Mũi tên / A đổi dòng chọn: cuộn tới dòng mới, và kéo tiêu điểm theo nếu nó đang trong danh sách (Impeccable A3). */
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = containerRef.current;

    if (selectedObjectId === null || container === null) {
      return;
    }

    const target = container.querySelector<HTMLElement>(`[data-object-id="${selectedObjectId}"]`);

    target?.scrollIntoView?.({ block: 'nearest' });

    const focused = document.activeElement;

    if (target !== null && focused !== null && container.contains(focused) && focused.getAttribute('role') === 'option' && target !== focused) {
      target.focus({ preventScroll: true });
    }
  }, [selectedObjectId]);

  return (
    <div aria-label={LIST_LABEL} className="flex flex-col" ref={containerRef} role="group">
      {REASON_GROUPS.filter(({ id }) => rowsOfGroup(shownRows, id).length > 0 || (id === 'clear' && shownRows.length === 0)).map(({ id, label }) => (
        <ObjectLayerListGroup
          group={id}
          isCollapsed={collapsed.has(id)}
          isFiltered={isFiltered || needle !== ''}
          key={id}
          label={label}
          onAttachToNearestWall={onAttachToNearestWall}
          onHover={onHover}
          onSelect={onSelect}
          onToggleCollapsed={toggleCollapsed}
          queueNumbers={queueNumbers}
          rows={rowsOfGroup(shownRows, id)}
          selectedObjectId={selectedObjectId}
        />
      ))}
    </div>
  );
}
