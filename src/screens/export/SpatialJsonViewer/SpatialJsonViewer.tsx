/**
 * S-36 — view thuần của màn xem Spatial JSON.
 *
 * Không import `src/api`, `src/store`, `src/domain` hay `src/lib/http` (R-60):
 * mọi thứ vào bằng props, nên story và test dựng được nó mà không cần một
 * provider nào.
 *
 * ## Bố cục ở 1440
 *
 * Thanh trên 56 · dải kiểm tra hợp lệ · cây trái 400 · nửa phải co giãn · chân
 * 32. Dưới 1024 chỉ một khung chiếm trọn chiều rộng — cây khi "Cây", khung JSON /
 * Xem trước khi "Thô" — đó cũng là trạng thái "thu gọn" của A11, không phải một chế độ thứ hai.
 *
 * ## Màn này không có nút Lưu, và cũng không có nút Sửa
 *
 * A7 nói không màn nào có nút lưu. S-36 đi xa hơn: nó chỉ đọc, nên không một ô
 * nhập nào ở đây ngoài ô tìm kiếm — thứ không sửa dữ liệu.
 */

import {
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Download,
  FileJson,
  Search,
} from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

import { SpatialJsonDetail } from './SpatialJsonDetail';
import { SpatialJsonTree } from './SpatialJsonTree';
import type { SpatialJsonViewerProps, SpatialJsonViewMode } from './types';

const VIEW_MODE_OPTIONS: ReadonlyArray<{ readonly label: string; readonly value: SpatialJsonViewMode }> = [
  { label: 'Cây', value: 'tree' },
  { label: 'Thô', value: 'raw' },
];

const EMPTY_TITLE = 'Chưa có dữ liệu không gian';
const EMPTY_DESCRIPTION =
  'Bản vẽ này chưa được xử lý xong, nên chưa có tường, phòng hay đối tượng nào để xem. Xử lý bản vẽ của tầng rồi quay lại đây.';

const ERROR_TITLE = 'Không đọc được dữ liệu không gian';
const FORBIDDEN_TITLE = 'Không có quyền xem dữ liệu';
const REFRESHING_MESSAGE = 'Đang làm mới dữ liệu của bản vẽ này. Phần đang hiện vẫn đúng với lượt tải trước.';

/** Chấm trạng thái của dải kiểm tra. Ba màu trạng thái, không màu thứ tư (A4). */
function ValidityDot({ isValid }: { readonly isValid: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 shrink-0 rounded-full ${isValid ? 'bg-state-verified' : 'bg-state-violation'}`}
    />
  );
}

/** Tiêu đề trang ở mọi trạng thái, như các màn có h1 sẵn (BUG-454); lề 20 px như thanh công cụ. */
const pageTitle = <h1 className="px-5 pt-4 text-[20px] font-semibold text-text-primary">Dữ liệu không gian</h1>;

export function SpatialJsonViewer({ actions, model }: SpatialJsonViewerProps) {
  const selectedNode = model.nodes.find((node) => node.id === model.selectedNodeId) ?? null;
  // Rỗng thì chỉ một khung nói "chưa có dữ liệu" — khung JSON cạnh nó kể chuyện ngược lại (BUG-454).
  const isEmpty = model.state === 'empty';
  const isRawOnly = model.isNarrow && model.viewMode === 'raw' && !isEmpty;

  if (model.state === 'forbidden') {
    return (
      <div className="flex h-full flex-col bg-bg-app">
        {pageTitle}
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<div className="h-8 w-8 rounded-full bg-state-attention-tint" aria-hidden="true" />}
            title={FORBIDDEN_TITLE}
            description={model.forbiddenMessage ?? FORBIDDEN_TITLE}
          />
        </div>
      </div>
    );
  }

  if (model.state === 'error') {
    return (
      <div className="flex h-full flex-col bg-bg-app">
        {pageTitle}
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
            title={ERROR_TITLE}
            description={model.errorMessage ?? ERROR_TITLE}
            action={{ label: 'Mở lại từ quản lý tầng', onClick: actions.onReopenFloors }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg-app">
      {pageTitle}
      {/* Dưới `sm` hàng công cụ xuống dòng thay vì đẩy trang cuộn ngang: ô tìm co lại, cụm mở/thu/
          kiểu xem/sao chép sang hàng hai. */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 px-5 py-2">
        <div className="min-w-[180px] flex-1 sm:w-[280px] sm:flex-none">
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
          <span className="text-[13px] leading-5 tabular-nums text-text-secondary" aria-live="polite">
            {model.matchLabel}
          </span>
        ) : null}

        <IconButton
          icon={<ChevronUp size={18} aria-hidden="true" />}
          aria-label="Kết quả trước"
          size="sm"
          onClick={actions.onPreviousMatch}
        />
        <IconButton
          icon={<ChevronDown size={18} aria-hidden="true" />}
          aria-label="Kết quả sau"
          size="sm"
          onClick={actions.onNextMatch}
        />

        <span className="flex-1" />

        <IconButton
          icon={<ChevronsUpDown size={18} aria-hidden="true" />}
          aria-label="Mở rộng tất cả"
          size="sm"
          onClick={actions.onExpandAll}
        />
        <IconButton
          icon={<ChevronsDownUp size={18} aria-hidden="true" />}
          aria-label="Thu gọn tất cả"
          size="sm"
          onClick={actions.onCollapseAll}
        />

        <SegmentedControl
          aria-label="Cách hiện cấu trúc"
          options={[...VIEW_MODE_OPTIONS]}
          value={model.viewMode}
          onChange={actions.onChangeViewMode}
        />

        <IconButton
          icon={<Copy size={18} aria-hidden="true" />}
          aria-label="Sao chép nhánh đang chọn"
          size="sm"
          onClick={actions.onCopyBranch}
        />
      </header>

      {model.copyNotice === null ? null : (
        <p role="status" className="shrink-0 px-5 pb-2 text-[13px] leading-[18px] text-text-secondary">
          {model.copyNotice}
        </p>
      )}

      {/* Chưa có dữ liệu thì chưa có gì để kiểm: "hợp lệ — 0 lỗi" lúc ấy là nói thừa (B-V12-07). */}
      {model.state === 'empty' || model.state === 'loading' ? null : (
        <div className="flex shrink-0 items-center gap-2 px-5 pb-3">
          <ValidityDot isValid={model.validity.isValid} />
          <p className="text-[13px] leading-[18px] text-text-secondary">{model.validity.summary}</p>
        </div>
      )}

      {model.validity.issues.length > 0 ? (
        <ul className="mb-3 flex shrink-0 flex-col gap-1 px-5">
          {model.validity.issues.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                className="flex w-full items-baseline gap-3 rounded-lg bg-bg-sunken px-3 py-2 text-left hover:bg-bg-hover"
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
      ) : null}

      {model.isRefreshing ? (
        <div className="mb-3 shrink-0 px-5">
          <InlineAlert level="attention" message={REFRESHING_MESSAGE} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 px-5 pb-3">
        {/* Dưới 1024 chỉ có chỗ cho một khung: "Thô" đổi cây lấy khung JSON / Xem trước (BUG-450). */}
        {isRawOnly ? null : (
          <section
            aria-label="Cấu trúc dự án"
            className={`min-h-0 overflow-auto rounded-xl bg-bg-surface ${
              model.isNarrow || isEmpty ? 'flex-1' : 'w-[400px] shrink-0'
            }`}
          >
            {model.state === 'loading' ? (
              <div className="p-5">
                <Skeleton preset="property-panel" />
              </div>
            ) : model.state === 'empty' ? (
              <div className="flex h-full items-center justify-center p-5">
                <EmptyState
                  icon={<FileJson aria-hidden="true" />}
                  title={EMPTY_TITLE}
                  description={EMPTY_DESCRIPTION}
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
          </section>
        )}

        {isEmpty || (model.isNarrow && !isRawOnly) ? null : (
          <SpatialJsonDetail
            activeTabId={model.viewMode === 'raw' && !isRawOnly ? 'json' : model.activeTabId}
            onChangeTab={actions.onChangeTab}
            rawText={model.rawText}
            selectedNode={selectedNode}
          />
        )}
      </div>

      <footer className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-4 px-5 pb-3">
        <span className="whitespace-nowrap font-mono text-[13px] leading-5 text-text-secondary">{model.sizeLabel}</span>
        <span className="text-[13px] leading-[18px] text-text-muted">{model.countsLabel}</span>
        <span className="flex-1" />
        {model.canDownload && actions.onDownload !== null ? (
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<Download size={16} aria-hidden="true" />}
            onClick={actions.onDownload}
          >
            Tải xuống .json
          </Button>
        ) : null}
      </footer>
    </div>
  );
}
