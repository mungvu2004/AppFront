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
 * 32. Dưới 1024 thì nửa phải ẩn hẳn và cây chiếm trọn chiều rộng — đó cũng là
 * trạng thái "thu gọn" của A11, không phải một chế độ thứ hai.
 *
 * ## Màn này không có nút Lưu, và cũng không có nút Sửa
 *
 * A7 nói không màn nào có nút lưu. S-36 đi xa hơn: nó chỉ đọc, nên không một ô
 * nhập nào ở đây ngoài ô tìm kiếm — thứ không sửa dữ liệu.
 */

import { ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Copy, Download, Search } from 'lucide-react';

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
  'Bản vẽ này chưa được xử lý xong, nên chưa có Spatial JSON để xem. Chạy pipeline cho tầng rồi quay lại đây.';

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

export function SpatialJsonViewer({ actions, model }: SpatialJsonViewerProps) {
  const selectedNode = model.nodes.find((node) => node.id === model.selectedNodeId) ?? null;

  if (model.state === 'forbidden') {
    return (
      <div className="flex h-full items-center justify-center bg-bg-app p-6">
        <EmptyState
          icon={<div className="h-8 w-8 rounded-full bg-state-attention-tint" aria-hidden="true" />}
          title={FORBIDDEN_TITLE}
          description={model.forbiddenMessage ?? FORBIDDEN_TITLE}
        />
      </div>
    );
  }

  if (model.state === 'error') {
    return (
      <div className="flex h-full items-center justify-center bg-bg-app p-6">
        <EmptyState
          icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
          title={ERROR_TITLE}
          description={model.errorMessage ?? ERROR_TITLE}
          action={{ label: 'Mở lại từ quản lý tầng', onClick: actions.onReopenFloors }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg-app">
      <header className="flex h-14 shrink-0 items-center gap-3 px-5">
        <div className="w-[280px]">
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
          <span className="font-mono text-[13px] leading-5 text-text-secondary" aria-live="polite">
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

      <div className="flex shrink-0 items-center gap-2 px-5 pb-3">
        <ValidityDot isValid={model.validity.isValid} />
        <p className="text-[13px] leading-[18px] text-text-secondary">{model.validity.summary}</p>
      </div>

      {model.validity.issues.length > 0 ? (
        <ul className="mb-3 flex shrink-0 flex-col gap-1 px-5">
          {model.validity.issues.map((issue) => (
            <li key={issue.id} className="flex items-baseline gap-3 rounded-[8px] bg-bg-sunken px-3 py-2">
              <code className="shrink-0 font-mono text-[13px] leading-5 text-text-primary">{issue.path}</code>
              <span className="text-[13px] leading-[18px] text-text-secondary">{issue.problem}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {model.isRefreshing ? (
        <div className="mb-3 shrink-0 px-5">
          <InlineAlert level="attention" message={REFRESHING_MESSAGE} />
        </div>
      ) : null}

      <main className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <section
          aria-label="Cấu trúc dự án"
          className={`min-h-0 overflow-auto rounded-[12px] bg-bg-surface ${
            model.isNarrow ? 'flex-1' : 'w-[400px] shrink-0'
          }`}
        >
          {model.state === 'loading' ? (
            <div className="p-5">
              <Skeleton preset="property-panel" />
            </div>
          ) : model.state === 'empty' ? (
            <div className="flex h-full items-center justify-center p-5">
              <EmptyState
                icon={<div className="h-8 w-8 rounded-full bg-bg-sunken" aria-hidden="true" />}
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

        {model.isNarrow ? null : (
          <SpatialJsonDetail
            activeTabId={model.viewMode === 'raw' ? 'json' : model.activeTabId}
            onChangeTab={actions.onChangeTab}
            rawText={model.rawText}
            selectedNode={selectedNode}
          />
        )}
      </main>

      <footer className="flex h-8 shrink-0 items-center gap-4 px-5 pb-3">
        <span className="font-mono text-[13px] leading-5 text-text-secondary">{model.sizeLabel}</span>
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
