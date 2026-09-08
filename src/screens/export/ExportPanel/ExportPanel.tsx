/**
 * Màn Xuất (S-ExportPanel) — bốn định dạng (.glb, PDF, ảnh, Spatial JSON),
 * bố cục hai cột.
 *
 * View thuần (mục D): mọi giá trị đến từ {@link ExportPanelProps}, không
 * store, không mạng, không domain — `local/no-data-layer-in-view` (R-60)
 * không có gì để bắt ở đây.
 *
 * ## Tám công năng vắng mặt
 *
 * `canEstimateSize`, `canChooseUnit`, `canNameFloorStep`,
 * `canPutDownloadInToast` không có mặt bằng logic nào tương ứng nên không có
 * điều khiển nào trong view này giả vờ cần chúng: không dòng ước tính dung
 * lượng trước khi xuất, không `Select` đơn vị, không tên bước theo tầng
 * (`progress.stepLabel` hiện nguyên văn chuỗi đã nhận), không nút hành động
 * trên `Toast` (view này còn không dựng `Toast` — bề mặt đó thuộc về nơi khác,
 * giống ghi chú trong `RuleSettings.container.tsx`). `canPersistHistory` có
 * điều khiển thật (danh sách tệp vẫn hiện) nhưng mang một caption nói rõ danh
 * sách chỉ sống trong phiên làm việc — không giả vờ nó bền.
 *
 * Ba cờ còn lại đi cùng một đường: `canRenderPdfBytes` và `canCaptureImage`
 * `false` thì **khả năng tải của thẻ tương ứng rời khỏi DOM** — chân trang
 * không dựng nút "xuất" khi định dạng đang chọn là một trong hai, và thẻ mang
 * một câu nói vì sao. Bốn thẻ định dạng vẫn ở nguyên, thẻ PDF vẫn hiện **số
 * trang thật** (số đó đếm được, chỉ tệp là chưa dựng được). `canIncludeAxisGrid`
 * `false` thì công tắc "gồm lưới trục" rời khỏi DOM trong `ExportPanelOptions`.
 * `.glb` và Spatial JSON có bộ xuất thật nên không bị chạm tới.
 *
 * ## "Đi duyệt tầng" ở trạng thái `empty` — chỗ lệch có ghi chú
 *
 * Hợp đồng không có trường href/callback riêng cho liên kết "đi duyệt". Dòng
 * giải thích và liên kết ở đây lấy từ hàng `preflight` có `id === 'approval'`
 * (nếu có) — đúng cơ chế `fixHref` + `onFollowFix` hợp đồng đã cấp, không bịa
 * thêm trường nào. Không có hàng đó thì chỉ hiện câu giải thích chung, không
 * vẽ một liên kết chết.
 *
 * ## Bảy trạng thái (A11)
 *
 * `empty` và `forbidden` thay toàn bộ nội dung bằng một thông báo — không có
 * gì để thao tác. Năm trạng thái còn lại (`loading`, `partial`, `error`,
 * `success`, `collapsed`) đều vẽ đủ hai cột: `error` giữ nguyên mọi thẻ định
 * dạng/tầng/tuỳ chọn phía dưới banner lỗi, đúng ý "`onRetry` giữ nguyên mọi
 * thiết lập" — banner biến mất khi thử lại thành công, các lựa chọn thì không
 * đổi vì chúng chưa từng bị gỡ khỏi DOM.
 *
 * `progress !== null` là cờ độc lập với `status`: chân trang đổi sang thanh
 * tiến độ bất kể `status` đang là gì.
 */

import { FolderOpen, Lock } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

import { ExportPanelFooter } from './ExportPanelFooter';
import { ExportPanelFormats, FOCUS_RING, SkeletonText } from './ExportPanelFormats';
import { ExportPanelOptions } from './ExportPanelOptions';
import { ExportPanelPreflight } from './ExportPanelPreflight';
import type {
  ExportCapabilities,
  ExportedFileRow,
  ExportFormatId,
  ExportPanelProps,
  PreflightRow,
} from './types';

function findPreflightRow(rows: readonly PreflightRow[], id: PreflightRow['id']): PreflightRow | null {
  return rows.find((row) => row.id === id) ?? null;
}

/**
 * Định dạng này có sinh ra được một tệp thật không.
 *
 * `.glb` và Spatial JSON luôn có; PDF và ảnh phụ thuộc hai cờ mà tầng logic
 * hôm nay trả `false`. Suy ra từ props, không phải một trường mới của hợp đồng.
 */
function canDeliverFormat(id: ExportFormatId, capabilities: ExportCapabilities): boolean {
  if (id === 'pdf') {
    return capabilities.canRenderPdfBytes;
  }

  if (id === 'image') {
    return capabilities.canCaptureImage;
  }

  return true;
}

interface ExportPanelHistoryProps {
  readonly files: readonly ExportedFileRow[];
  readonly isLoading: boolean;
  readonly canPersistHistory: boolean;
  readonly onDownload: (fileId: string) => void;
}

/** Danh sách tệp đã xuất trong phiên làm việc — kèm thời điểm và dung lượng bằng chữ đều. */
function ExportPanelHistory({ files, isLoading, canPersistHistory, onDownload }: ExportPanelHistoryProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="tệp đã xuất"
      className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-surface p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-text-secondary">tệp đã xuất</h3>
        {!canPersistHistory && (
          <p className="text-xs text-text-muted">chỉ trong phiên làm việc này, sẽ mất khi tải lại trang.</p>
        )}
      </div>

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>tệp</Table.Head>
            <Table.Head>thời điểm</Table.Head>
            <Table.Head>dung lượng</Table.Head>
            <Table.Head>
              <span className="sr-only">tải lại</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {files.map((file) => (
            <Table.Row key={file.id}>
              <Table.Cell className="max-w-[140px] truncate font-mono text-xs">{file.fileName}</Table.Cell>
              <Table.Cell className="text-xs text-text-secondary">
                {isLoading ? <SkeletonText className="h-3 w-16" /> : file.momentLabel}
              </Table.Cell>
              <Table.Cell className="font-mono text-xs tabular-nums text-text-secondary">
                {isLoading ? <SkeletonText className="h-3 w-12" /> : file.sizeLabel}
              </Table.Cell>
              <Table.Cell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onDownload(file.id);
                  }}
                >
                  tải lại
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </section>
  );
}

/** Màn Xuất như một hàm của props — test và story dựng thẳng cái này. */
export function ExportPanel(props: ExportPanelProps) {
  const {
    status,
    capabilities,
    formats,
    floors,
    options,
    preflight,
    exportedFiles,
    progress,
    error,
    destinationCaption,
    noticeCaption,
    permissionCaption,
    isCollapsed,
    onSelectFormat,
    onToggleFloor,
    onChangeOptions,
    onToggleOptionsExpanded,
    onExport,
    onCancel,
    onRetry,
    onDownload,
    onFollowFix,
  } = props;

  const isLoading = status === 'loading';
  const selectedFormat = formats.find((format) => format.isSelected) ?? formats[0] ?? null;
  const canExportSelected =
    selectedFormat !== null && canDeliverFormat(selectedFormat.id, capabilities);

  if (status === 'forbidden') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg-app p-8 text-center">
        <Lock aria-hidden="true" size={32} strokeWidth={1.5} className="text-text-muted" />
        <h2 className="text-base font-semibold text-text-primary">không có quyền xuất bản vẽ</h2>
        <p className="max-w-sm text-sm text-text-secondary">
          {permissionCaption ?? 'Chỉ một số vai trò trong dự án được xuất bản vẽ.'}
        </p>
      </div>
    );
  }

  if (status === 'empty') {
    const approvalRow = findPreflightRow(preflight, 'approval');

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg-app p-8 text-center">
        <FolderOpen aria-hidden="true" size={32} strokeWidth={1.5} className="text-text-muted" />
        <h2 className="text-base font-semibold text-text-primary">chưa có gì được duyệt để xuất</h2>
        <p className="max-w-sm text-sm text-text-secondary">
          {approvalRow?.label ?? 'Duyệt ít nhất một tầng trước khi xuất bản vẽ.'}
        </p>
        {approvalRow !== null && approvalRow.fixHref !== null && (
          <a
            href={approvalRow.fixHref}
            onClick={() => {
              onFollowFix('approval');
            }}
            className={cn('text-sm font-medium text-accent no-underline hover:underline', FOCUS_RING)}
          >
            đi duyệt tầng
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-app">
      <div className="flex flex-1 flex-col gap-4 p-6">
        <header>
          <h2 className="text-base font-semibold text-text-primary">xuất bản vẽ</h2>
        </header>

        {status === 'partial' && noticeCaption !== null && <InlineAlert level="attention" message={noticeCaption} />}

        {status === 'error' && error !== null && (
          <div className="flex flex-col gap-2">
            <InlineAlert level="violation" message={error.message} action={{ label: 'thử lại', onClick: onRetry }} />
            <p className="pl-3 text-xs text-text-secondary">
              {error.hint} <span className="font-mono text-text-muted">({error.code})</span>
            </p>
          </div>
        )}

        <div className={cn('gap-6', isCollapsed ? 'flex flex-col' : 'grid grid-cols-[60%_344px] items-start')}>
          <ExportPanelFormats
            formats={formats}
            capabilities={capabilities}
            isLoading={isLoading}
            onSelectFormat={onSelectFormat}
          />

          <div className="flex flex-col gap-4">
            {selectedFormat !== null && (
              <ExportPanelOptions
                floors={floors}
                options={options}
                capabilities={capabilities}
                selectedFormatId={selectedFormat.id}
                onToggleFloor={onToggleFloor}
                onChangeOptions={onChangeOptions}
                onToggleOptionsExpanded={onToggleOptionsExpanded}
              />
            )}

            <ExportPanelPreflight rows={preflight} onFollowFix={onFollowFix} />

            <ExportPanelHistory
              files={exportedFiles}
              isLoading={isLoading}
              canPersistHistory={capabilities.canPersistHistory}
              onDownload={onDownload}
            />
          </div>
        </div>
      </div>

      <ExportPanelFooter
        progress={progress}
        canExportSelected={canExportSelected}
        destinationCaption={destinationCaption}
        onExport={onExport}
        onCancel={onCancel}
      />
    </div>
  );
}
