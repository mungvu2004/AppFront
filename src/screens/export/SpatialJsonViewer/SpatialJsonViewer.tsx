/**
 * S-36 — view thuần của màn xem Spatial JSON (bản Z vòng 6, theo NGUYEN-TAC-BO-CUC, khuôn
 * `VersionHistory`).
 *
 * Không import `src/api`, `src/store`, `src/domain` hay `src/lib/http` (R-60): mọi thứ vào bằng
 * props, nên story và test dựng được nó mà không cần provider nào.
 *
 * ## Ba câu của màn
 *
 * 1. Làm gì: `PageHead` — H1 "Xem trước dữ liệu xuất (.json)".
 * 2. Trạng thái: chip kiểm tra schema (câu `validity.summary` của model, màu theo mức lỗi) + số
 *    đối tượng thật (`countsLabel`) + cỡ tệp. Rỗng thì không có chip — chưa có gì để kiểm (B-V12-07).
 * 3. Việc chính: MỘT nút chính ở `PageHead next` — "Tải xuống .json" khi nơi gọi cấp đường tải,
 *    không thì "Sao chép nhánh đang chọn". Màn nằm ngoài sáu bước (`/data`) nên không có cổng
 *    `FlowGate` sang bước sau.
 *
 * ## Bố cục
 *
 * Mỗi phần một `Section`: "Lỗi schema" (chỉ khi có lỗi, mỗi lỗi bấm được + lối "Mở lại từ quản lý
 * tầng"), "Cấu trúc" (tìm + cây, rộng 400) và "Chi tiết" (JSON / Xem trước). Dưới 1024 chỉ một khung
 * chiếm trọn chiều rộng, chọn bằng "Cây / JSON và xem trước" — trạng thái "thu gọn" của A11.
 *
 * Màn chỉ đọc: không nút Lưu, không nút Sửa (A7); ô duy nhất là ô tìm kiếm.
 */

import {
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Download,
  FileJson,
  Lock,
  Search,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/utils';

import { SpatialJsonDetail } from './SpatialJsonDetail';
import { SpatialJsonTree } from './SpatialJsonTree';
import type { SpatialJsonViewerProps, SpatialJsonViewMode } from './types';

const VIEW_MODE_OPTIONS: ReadonlyArray<{ readonly label: string; readonly value: SpatialJsonViewMode }> = [
  { label: 'Cây', value: 'tree' },
  { label: 'JSON và xem trước', value: 'raw' },
];

const PAGE_TITLE = 'Xem trước dữ liệu xuất (.json)';

const EMPTY_TITLE = 'Chưa có dữ liệu không gian';
const EMPTY_DESCRIPTION =
  'Bản vẽ này chưa được xử lý xong, nên chưa có tường, phòng hay đối tượng nào để xem. Xử lý bản vẽ của tầng rồi quay lại đây.';

const ERROR_TITLE = 'Không đọc được dữ liệu không gian';
const FORBIDDEN_TITLE = 'Không có quyền xem dữ liệu';
const REFRESHING_MESSAGE = 'Đang làm mới dữ liệu của bản vẽ này. Phần đang hiện vẫn đúng với lượt tải trước.';
const REOPEN_LABEL = 'Mở lại từ quản lý tầng';
const COPY_LABEL = 'Sao chép nhánh đang chọn';

/** Thân `Section` giãn hết khung và cuộn bên trong; đầu khung giữ nguyên (khuôn VersionHistory). */
const FILL_BODY =
  'flex min-h-0 flex-col [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col';

export function SpatialJsonViewer({ actions, model }: SpatialJsonViewerProps) {
  const selectedNode = model.nodes.find((node) => node.id === model.selectedNodeId) ?? null;
  // Rỗng thì chỉ một khung nói "chưa có dữ liệu" — khung JSON cạnh nó kể chuyện ngược lại (BUG-454).
  const isEmpty = model.state === 'empty';
  const isLoading = model.state === 'loading';
  // Khổ hẹp + "JSON và xem trước": bỏ cây, chỉ còn khung nội dung (BUG-450). Khổ rộng luôn có cả hai.
  const isRawOnly = model.viewMode === 'raw' && !isEmpty && model.isNarrow;
  const onDownload = model.canDownload ? actions.onDownload : null;
  const { validity } = model;

  const status =
    model.state === 'error' || model.state === 'forbidden' || isLoading ? null : (
      <>
        {/* Chưa có dữ liệu thì chưa có gì để kiểm: "hợp lệ — 0 lỗi" lúc ấy là nói thừa (B-V12-07). */}
        {isEmpty ? <Badge variant="neutral">Chưa có dữ liệu</Badge> : (
          <Badge variant={validity.isValid ? 'verified' : validity.criticalCount > 0 ? 'violation' : 'attention'}>
            {validity.summary}
          </Badge>
        )}
        <span className="tabular-nums">{model.countsLabel}</span>
        <span className="whitespace-nowrap font-mono text-[13px] text-text-muted">{model.sizeLabel}</span>
        {/* Phản hồi sau "Sao chép nhánh" cạnh nút chính, thấy được ở mọi khổ (BUG-719). */}
        {model.copyNotice === null ? null : (
          <span role="status" className="text-[13px] text-text-secondary">
            {model.copyNotice}
          </span>
        )}
      </>
    );

  const copyButton = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} size="sm" iconBefore={<Copy size={16} aria-hidden="true" />} onClick={actions.onCopyBranch}>
      {COPY_LABEL}
    </Button>
  );

  // Một nút chính: tải JSON khi có đường tải, không thì sao chép.
  const backButton =
    actions.onBackToExport === undefined ? null : (
      <Button variant="secondary" size="sm" onClick={actions.onBackToExport}>
        ← Về Xuất
      </Button>
    );

  const next =
    // Rỗng: chưa có gì để chép hay tải — lối ra nằm ngay trong khung rỗng, không nút chính chết ở đầu trang.
    model.state === 'error' || model.state === 'forbidden' || isEmpty ? backButton : onDownload !== null ? (
      <>
        {backButton}
        {copyButton('secondary')}
        <Button variant="primary" size="sm" iconBefore={<Download size={16} aria-hidden="true" />} onClick={onDownload}>
          Tải xuống .json
        </Button>
      </>
    ) : (
      <>
        {backButton}
        {copyButton('primary')}
      </>
    );

  const withHeader = (content: ReactNode) => (
    <div className="flex h-full flex-col bg-bg-app">
      <div className="mx-auto flex min-h-0 w-full max-w-[1344px] flex-1 flex-col px-4 pb-6 pt-6 xl:px-8">
        <PageHead next={next} status={status} title={PAGE_TITLE} />
        {content}
      </div>
    </div>
  );

  if (model.state === 'forbidden') {
    return withHeader(
      <EmptyState
        icon={<Lock aria-hidden="true" />}
        title={FORBIDDEN_TITLE}
        description={model.forbiddenMessage ?? FORBIDDEN_TITLE}
      />,
    );
  }

  if (model.state === 'error') {
    return withHeader(
      <InlineAlert
        level="violation"
        title={ERROR_TITLE}
        message={model.errorMessage ?? ERROR_TITLE}
        action={{ label: REOPEN_LABEL, onClick: actions.onReopenFloors }}
      />,
    );
  }

  const treeSection = isRawOnly ? null : (
    <Section
      aria-label="Cấu trúc dự án"
      flush
      title="Cấu trúc"
      actions={
        isEmpty ? undefined : (
          <>
            <IconButton
              icon={<ChevronsUpDown size={16} aria-hidden="true" />}
              aria-label="Mở rộng tất cả"
              // Đầu khung cao 56 như khung "Chi tiết": nút 32 không đẩy đầu khung lên 64.
              className="-my-2"
              size="sm"
              tooltip
              onClick={actions.onExpandAll}
            />
            <IconButton
              icon={<ChevronsDownUp size={16} aria-hidden="true" />}
              aria-label="Thu gọn tất cả"
              // Đầu khung cao 56 như khung "Chi tiết": nút 32 không đẩy đầu khung lên 64.
              className="-my-2"
              size="sm"
              tooltip
              onClick={actions.onCollapseAll}
            />
          </>
        )
      }
      className={cn('min-w-0 overflow-hidden', FILL_BODY, isEmpty ? 'w-full self-start' : model.isNarrow ? 'flex-1' : 'w-[400px] shrink-0')}
    >
      {isEmpty ? null : (
        <div className="flex shrink-0 items-center gap-2 border-b border-border-default px-4 py-3">
          <div className="min-w-0 flex-1">
            <Input
              aria-label="Tìm theo khoá hoặc giá trị"
              placeholder="Tìm theo khoá hoặc giá trị"
              value={model.searchQuery}
              prefix={<Search size={16} aria-hidden="true" />}
              onChange={(event) => {
                actions.onSearchChange(event.target.value);
              }}
            />
          </div>
          {model.matchLabel !== null ? (
            <span className="whitespace-nowrap text-[13px] tabular-nums text-text-secondary" aria-live="polite">
              {model.matchLabel}
            </span>
          ) : null}
          <IconButton icon={<ChevronUp size={18} aria-hidden="true" />} aria-label="Kết quả trước" size="sm" onClick={actions.onPreviousMatch} />
          <IconButton icon={<ChevronDown size={18} aria-hidden="true" />} aria-label="Kết quả sau" size="sm" onClick={actions.onNextMatch} />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-5">
            <Skeleton preset="property-panel" />
          </div>
        ) : isEmpty ? (
          <div className="flex items-center justify-center px-5 py-12">
            <EmptyState
              icon={<FileJson aria-hidden="true" />}
              title={EMPTY_TITLE}
              description={EMPTY_DESCRIPTION}
              action={{ label: REOPEN_LABEL, onClick: actions.onReopenFloors }}
            />
          </div>
        ) : (
          <SpatialJsonTree
            nodes={model.nodes}
            selectedNodeId={model.selectedNodeId}
            onToggle={actions.onToggleNode}
            onSelect={actions.onSelectNode}
          />
        )}
      </div>
    </Section>
  );

  const detailSection =
    isEmpty || (model.isNarrow && !isRawOnly) ? null : (
      <Section
        flush
        title="Chi tiết"
        className={cn('min-w-0 flex-1 overflow-hidden', FILL_BODY)}
      >
        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          <SpatialJsonDetail
            activeTabId={model.activeTabId}
            onChangeTab={actions.onChangeTab}
            focusLine={model.selectedRawLine}
            rawText={model.rawText}
            selectedNode={selectedNode}
          />
        </div>
      </Section>
    );

  return withHeader(
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {model.isRefreshing ? <InlineAlert level="attention" message={REFRESHING_MESSAGE} /> : null}

      {/* Lỗi đặt cạnh dữ liệu: mỗi lỗi bấm được để tới nút cây của nó, cộng lối mở lại bản vẽ. */}
      {validity.issues.length > 0 ? (
        <Section
          flush
          title="Lỗi schema"
          actions={
            <Button variant="ghost" size="sm" onClick={actions.onReopenFloors}>
              {REOPEN_LABEL}
            </Button>
          }
          className="shrink-0"
        >
          <ul className="flex max-h-[160px] flex-col overflow-auto py-1">
            {validity.issues.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-3 px-5 py-2 text-left hover:bg-bg-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                  onClick={() => {
                    actions.onSelectIssue(issue.path);
                  }}
                >
                  <code className="shrink-0 font-mono text-[13px] leading-5 text-text-primary">{issue.path}</code>
                  <span className="text-[13px] leading-[18px] text-text-secondary">{issue.problem}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Khổ hẹp chỉ có chỗ cho một khung: chọn giữa cây và nội dung (BUG-450). */}
      {model.isNarrow && !isEmpty ? (
        <SegmentedControl
          aria-label="Cách hiện cấu trúc"
          options={[...VIEW_MODE_OPTIONS]}
          value={model.viewMode}
          onChange={actions.onChangeViewMode}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 gap-6">
        {treeSection}
        {detailSection}
      </div>
    </div>,
  );
}
