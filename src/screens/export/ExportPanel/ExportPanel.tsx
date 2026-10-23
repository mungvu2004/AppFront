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
 *
 * ## "chia sẻ" — mở `ShareDialogContainer` (S-ShareDialog)
 *
 * View chỉ phát `onShare()`; container quyết định mở hộp thoại nào và với
 * quyền gì (R-73). Nút chỉ hiện ở năm trạng thái có header — `empty` và
 * `forbidden` không có header nên không có gì để chia sẻ.
 */

import { FolderOpen, Lock, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

import { ExportPanelFooter } from './ExportPanelFooter';
import { ExportPanelFormats, SkeletonText } from './ExportPanelFormats';
import { ExportPanelOptions } from './ExportPanelOptions';
import { ExportPanelPreflight } from './ExportPanelPreflight';
import type {
  ExportCapabilities,
  ExportedFileRow,
  ExportFloorChoice,
  ExportFormatId,
  ExportPanelProps,
} from './types';

/** Lý do nút Xuất mờ khi chọn `.glb` mà bỏ hết tầng (RV2#7, BUG-466). */
const NO_FLOOR_CAPTION = 'Chọn ít nhất một tầng để xuất mô hình 3D.';

/**
 * Định dạng này có sinh ra được một tệp thật không.
 *
 * Spatial JSON luôn có, `.glb` khi có ít nhất một tầng được chọn; PDF và ảnh phụ thuộc hai cờ mà tầng logic
 * hôm nay trả `false`. Suy ra từ props, không phải một trường mới của hợp đồng.
 */
function canDeliverFormat(
  id: ExportFormatId,
  capabilities: ExportCapabilities,
  floors: readonly ExportFloorChoice[],
): boolean {
  // `.glb` dựng hình theo TẦNG: chưa chọn tầng nào thì không có tệp nào để dựng (BUG-466) —
  // dòng "Chưa chọn tầng nào để xuất." của khối kiểm tra nói lý do.
  if (id === 'glb') {
    return floors.some((floor) => floor.isSelected);
  }

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
      aria-label="Tệp đã xuất"
      className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-surface p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-text-secondary">Tệp đã xuất</h3>
        {!canPersistHistory && (
          <p className="text-xs text-text-muted">Chỉ trong phiên làm việc này, sẽ mất khi làm mới trang.</p>
        )}
      </div>

      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Tệp</Table.Head>
            {/* Dưới `sm` bỏ cột thời điểm để "Tải lại" còn trong khung 375 px. */}
            <Table.Head className="hidden sm:table-cell">Thời điểm</Table.Head>
            <Table.Head>Dung lượng</Table.Head>
            <Table.Head>
              <span className="sr-only">Tải về lại</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {files.map((file) => (
            <Table.Row key={file.id}>
              <Table.Cell className="w-full max-w-0 truncate font-mono text-xs" title={file.fileName}>
                {file.fileName}
              </Table.Cell>
              <Table.Cell className="hidden text-xs text-text-secondary sm:table-cell">
                {isLoading ? <SkeletonText className="h-3 w-16" /> : file.momentLabel}
              </Table.Cell>
              <Table.Cell className="font-mono text-xs tabular-nums text-text-secondary">
                {isLoading ? <SkeletonText className="h-3 w-12" /> : file.sizeLabel}
              </Table.Cell>
              <Table.Cell>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Tải về lại ${file.fileName}`}
                  onClick={() => {
                    onDownload(file.id);
                  }}
                >
                  Tải về lại
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
    onBackToProject,
    onOpenData,
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
    onShare,
  } = props;

  const isLoading = status === 'loading';

  // Xuất xong thì đọc to tên tệp mới (30-E-012); lần mount đầu không đọc lịch sử cũ.
  const [announcement, setAnnouncement] = useState('');
  const lastFileId = useRef(exportedFiles[0]?.id);
  useEffect(() => {
    const newest = exportedFiles[0];

    if (newest !== undefined && newest.id !== lastFileId.current) {
      setAnnouncement(`Đã xuất ${newest.fileName}`);
    }

    lastFileId.current = newest?.id;
  }, [exportedFiles]);
  const selectedFormat = formats.find((format) => format.isSelected) ?? formats[0] ?? null;
  const canExportSelected =
    selectedFormat !== null && canDeliverFormat(selectedFormat.id, capabilities, floors);

  if (status === 'forbidden') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg-app p-8 text-center">
        <Lock aria-hidden="true" size={32} strokeWidth={1.5} className="text-text-muted" />
        <h1 className="text-title text-text-primary">Không có quyền xuất bản vẽ</h1>
        <p className="max-w-sm text-sm text-text-secondary">
          {permissionCaption ?? 'Chỉ một số vai trò trong dự án được xuất bản vẽ.'}
        </p>
        {onBackToProject !== undefined && (
          <Button variant="secondary" onClick={onBackToProject}>
            Về dự án
          </Button>
        )}
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg-app p-8 text-center">
        <FolderOpen aria-hidden="true" size={32} strokeWidth={1.5} className="text-text-muted" />
        <h1 className="text-title text-text-primary">Chưa có gì để xuất</h1>
        <p className="max-w-sm text-sm text-text-secondary">
          Dự án chưa có bản vẽ nào được xử lý xong. Tải bản vẽ lên, chờ xử lý xong rồi quay lại đây để xuất.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-app">
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-title text-text-primary">Xuất bản vẽ</h1>
          {onShare !== null && (
            <Button variant="secondary" size="sm" iconBefore={<Share2 aria-hidden="true" size={16} />} onClick={onShare}>
              Chia sẻ
            </Button>
          )}
        </header>

        {status === 'error' && error !== null && (
          <div className="flex flex-col gap-2">
            <InlineAlert level="violation" message={error.message} action={{ label: 'thử lại', onClick: onRetry }} />
            <p className="pl-3 text-xs text-text-secondary">
              {error.hint} <span className="font-mono text-text-muted">({error.code})</span>
            </p>
          </div>
        )}

        {/* Hai cột từ `lg` (cột phải 344 px, cột trái lấp phần còn lại); hẹp hơn thì xếp chồng. */}
        <div className={cn('flex flex-col gap-6', !isCollapsed && 'lg:flex-row lg:items-start')}>
          <div className="min-w-0 flex-1">
            <ExportPanelFormats
              formats={formats}
              capabilities={capabilities}
              isLoading={isLoading}
              onSelectFormat={onSelectFormat}
            />
          </div>

          {/* Hẹp hơn `lg`: cột phải "tan" (`contents`) để phần "Kiểm tra trước khi xuất" lên
              trên danh sách định dạng, không bị thanh đáy che (impeccable A4 export-768). */}
          <div className={cn('contents', !isCollapsed && 'lg:flex lg:w-[344px] lg:shrink-0 lg:flex-col lg:gap-4')}>
            {selectedFormat !== null && (
              <ExportPanelOptions
                floors={floors}
                options={options}
                capabilities={capabilities}
                selectedFormatId={selectedFormat.id}
                onToggleFloor={onToggleFloor}
                onChangeOptions={onChangeOptions}
                onToggleOptionsExpanded={onToggleOptionsExpanded}
                {...(onOpenData !== undefined ? { onOpenData } : {})}
              />
            )}

            <div className={cn('order-first', !isCollapsed && 'lg:order-none')}>
              <ExportPanelPreflight rows={preflight} onFollowFix={onFollowFix} />
            </div>
          </div>
        </div>

        <ExportPanelHistory
          files={exportedFiles}
          isLoading={isLoading}
          canPersistHistory={capabilities.canPersistHistory}
          onDownload={onDownload}
        />
      </div>

      <ExportPanelFooter
        progress={progress}
        canExportSelected={canExportSelected}
        blockedReason={noticeCaption ?? (selectedFormat?.id === 'glb' ? NO_FLOOR_CAPTION : null)}
        destinationCaption={destinationCaption}
        isLoading={isLoading}
        onExport={onExport}
        onCancel={onCancel}
        {...(onBackToProject !== undefined ? { onBackToProject } : {})}
      />
    </div>
  );
}
