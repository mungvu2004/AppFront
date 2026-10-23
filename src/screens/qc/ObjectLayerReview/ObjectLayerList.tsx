/**
 * Danh sách đối tượng của panel trái — gộp theo BA NHÓM GẤP ĐƯỢC, mỗi dòng là
 * mã · kích thước · tường chủ · độ tin cậy.
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
 * "chưa gắn", và dòng đó KHÔNG hiện một ô trống: nó hiện chip cần chú ý "Chưa
 * gắn vào tường nào" cùng hành động "Gắn vào tường gần nhất" (`row.isOrphan` —
 * chỉ lỗ mở; nội thất đứng tự do ghi "đứng tự do", B-V6-13). Hành động ấy chỉ
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

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

import type { ObjectLayerListViewProps } from './objectLayerSymbols';
import { OBJECT_LAYER_COLOR_TOKENS } from './objectLayerSymbols';
import type { ObjectLayerId, ObjectListRowViewModel } from './objectLayerTypes';
import { OBJECT_LAYER_IDS, OBJECT_LAYER_LABELS } from './objectLayerTypes';

/* Chuỗi tiếng Việt tĩnh — chép từ `.orca-notes/S13-SPEC-GOC.md` phần IV (A6). */

const LIST_LABEL = 'Danh sách đối tượng';
const ORPHAN_BADGE = 'Chưa gắn vào tường nào';
const ATTACH_ACTION = 'Gắn vào tường gần nhất';
/** Nội thất không áp tường nào — chỗ đứng bình thường của nó, không phải việc phải làm. */
const FREE_STANDING = 'Đứng tự do';
const SEARCH_LABEL = 'Tìm mã';
const SEARCH_PLACEHOLDER = 'Tìm mã, ví dụ D-007';
const EMPTY_GROUP = 'Chưa có đối tượng nào trong nhóm này';
/* Rỗng vì bộ lọc hoặc ô tìm, không phải vì chưa có (G4a-26, G4a-37). */
const EMPTY_FILTERED = 'Không có đối tượng nào khớp bộ lọc hoặc ô tìm đang dùng';
const CLEAR_SEARCH = 'Xoá ô tìm';
const EXPAND_PREFIX = 'Mở nhóm ';
const COLLAPSE_PREFIX = 'Gấp nhóm ';

/** Ba màu trạng thái của A4, không có màu thứ tư. */
const STATUS_DOT_TOKEN = {
  verified: 'bg-state-verified',
  attention: 'bg-state-attention',
  violation: 'bg-state-violation',
  neutral: 'bg-text-muted',
} as const;

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
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;
  readonly onAttachToNearestWall: (objectId: string) => void;
}

function ObjectLayerListRow({
  row,
  isSelected,
  onSelect,
  onHover,
  onAttachToNearestWall,
}: ObjectLayerListRowProps) {
  return (
    <div
      aria-label={`${row.codeLabel} — ${STATUS_LABEL[row.statusCode]}`}
      aria-selected={isSelected}
      className={cn(
        'flex cursor-pointer flex-col gap-1 rounded-lg px-2 py-1.5 text-[13px] outline-hidden',
        'transition-colors duration-120 hover:bg-bg-hover',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        isSelected && 'bg-bg-selected hover:bg-bg-selected',
      )}
      onClick={() => onSelect(row.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(row.id);
        }
      }}
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
      role="option"
      tabIndex={0}
    >
      {/*
        Dòng một: mã + kích thước ĐỦ chữ. Thanh độ tin cậy xuống dòng hai cạnh tường chủ: chung
        một dòng với nó, kích thước 1440 bị cắt còn "900 x 2…" (BUG-400). `title` cho khổ hẹp hơn nữa.
      */}
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 truncate font-mono text-text-primary">{row.codeLabel}</span>
        <span
          className="min-w-0 flex-1 truncate font-mono tabular-nums text-text-secondary"
          title={row.sizeLabel}
        >
          {row.sizeLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/*
          Tường chủ. `null` không bao giờ vẽ ra một ô trống: một đối tượng không
          gắn vào tường nào là một việc phải làm, không phải một trường thiếu.
        */}
        {row.isOrphan ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="attention">{ORPHAN_BADGE}</Badge>
            <button
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[12px] text-accent',
                'transition-colors duration-120 hover:bg-accent-wash',
                'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
              onClick={(event) => {
                /* Bấm hành động KHÔNG kéo theo một lượt chọn dòng ngoài ý muốn. */
                event.stopPropagation();
                onAttachToNearestWall(row.id);
              }}
              type="button"
            >
              {ATTACH_ACTION}
            </button>
          </div>
        ) : row.hostWallLabel === null ? (
          <span className="text-[12px] text-text-muted">{FREE_STANDING}</span>
        ) : (
          <span className="font-mono text-[12px] text-text-muted">{row.hostWallLabel}</span>
        )}
        <ConfidenceMeter className="ml-auto" noTooltip value={row.confidence} />
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_TOKEN[row.statusCode])}
          title={STATUS_LABEL[row.statusCode]}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Một nhóm gấp được.                                                          */
/* -------------------------------------------------------------------------- */

interface ObjectLayerListGroupProps {
  readonly isFiltered: boolean;
  readonly layer: ObjectLayerId;
  readonly rows: readonly ObjectListRowViewModel[];
  readonly isCollapsed: boolean;
  readonly selectedObjectId: string | null;
  readonly onToggleGroupCollapsed: (layer: ObjectLayerId) => void;
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;
  readonly onAttachToNearestWall: (objectId: string) => void;
}

function ObjectLayerListGroup({
  isFiltered,
  layer,
  rows,
  isCollapsed,
  selectedObjectId,
  onToggleGroupCollapsed,
  onSelect,
  onHover,
  onAttachToNearestWall,
}: ObjectLayerListGroupProps) {
  const label = OBJECT_LAYER_LABELS[layer];
  const bodyId = `object-layer-group-${layer}`;

  return (
    <section className="flex flex-col">
      <button
        aria-controls={bodyId}
        aria-expanded={!isCollapsed}
        aria-label={`${isCollapsed ? EXPAND_PREFIX : COLLAPSE_PREFIX}${label}`}
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-text-secondary',
          'transition-colors duration-120 hover:bg-bg-hover hover:text-text-primary',
          'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
        onClick={() => onToggleGroupCollapsed(layer)}
        type="button"
      >
        {isCollapsed ? (
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
        )}
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-xs border border-border-default-50"
          style={{ backgroundColor: OBJECT_LAYER_COLOR_TOKENS[layer] }}
        />
        <span className="truncate">{label}</span>
        <span className="ml-auto shrink-0 font-mono tabular-nums text-text-muted">
          ({rows.length})
        </span>
      </button>

      {isCollapsed ? null : (
        <div aria-label={label} className="flex flex-col gap-0.5 pl-2" id={bodyId} role="listbox">
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
  collapsedGroups,
  isFiltered = false,
  onAttachToNearestWall,
  onHover,
  onSelect,
  onToggleGroupCollapsed,
  rows,
  selectedObjectId,
}: ObjectLayerListViewProps) {
  /* Ô tìm mã chỉ lọc dòng của danh sách — UI thuần, không đụng canvas hay bộ lọc của hook. */
  const [codeQuery, setCodeQuery] = useState('');
  const needle = codeQuery.trim().replace(/^#/, '').toLowerCase();
  const shownRows =
    needle === '' ? rows : rows.filter((row) => row.codeLabel.replace(/^#/, '').toLowerCase().includes(needle));

  return (
    <div aria-label={LIST_LABEL} className="flex flex-col gap-1" role="group">
      <Input
        aria-label={SEARCH_LABEL}
        className="text-[13px]"
        onChange={(event) => setCodeQuery(event.target.value)}
        placeholder={SEARCH_PLACEHOLDER}
        type="search"
        value={codeQuery}
      />
      {needle === '' ? null : (
        <button
          className="self-start rounded-sm px-2 py-0.5 text-[12px] text-accent hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent"
          onClick={() => setCodeQuery('')}
          type="button"
        >
          {CLEAR_SEARCH}
        </button>
      )}
      {OBJECT_LAYER_IDS.map((layer) => (
        <ObjectLayerListGroup
          isCollapsed={collapsedGroups[layer]}
          isFiltered={isFiltered || needle !== ''}
          key={layer}
          layer={layer}
          onAttachToNearestWall={onAttachToNearestWall}
          onHover={onHover}
          onSelect={onSelect}
          onToggleGroupCollapsed={onToggleGroupCollapsed}
          rows={shownRows.filter((row) => row.layer === layer)}
          selectedObjectId={selectedObjectId}
        />
      ))}
    </div>
  );
}
