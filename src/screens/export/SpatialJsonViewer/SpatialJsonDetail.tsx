/**
 * S-36 — nửa phải: hai tấm "JSON" và "Xem trước".
 *
 * ## "Xem trước" hiện thực thể đang chọn, không mount một cảnh 3D thứ hai
 *
 * Đặc tả vẽ tấm này là một canvas tô sáng đúng nút đang chọn, qua R-09 và R-07.
 * Route này **không dựng cảnh 3D nào**, và dựng một cảnh thứ hai ở đây là hai
 * chuyện cùng lúc: một là ngân sách gói (cổng "chi phí thêm cho một màn" chỉ
 * còn dư 21,4 KiB, mà đường 3D nặng hơn thế nhiều), hai là hai cảnh sống song
 * song thì camera, chọn lựa và bộ nhớ GPU có hai chủ.
 *
 * Nên tấm này làm đúng phần nó làm được thật: hiện các trường của đúng nút đang
 * chọn, và — khi nơi gọi cấp đường — mời sang trình xem 3D, nơi việc tô sáng đã
 * có sẵn. Không nút giả, không canvas rỗng vờ như sắp vẽ.
 */

import { cn } from '@/lib/utils';

import { tokenizeJsonLine } from './spatialJsonModel';
import type { SpatialJsonNode, SpatialJsonTabId, SpatialJsonTone } from './types';

const TONE_CLASS: Readonly<Record<SpatialJsonTone, string>> = {
  key: 'text-text-primary',
  none: 'text-text-muted',
  number: 'text-text-secondary',
  string: 'text-accent-active',
};

/** Trên ngần này dòng thì chỉ dựng phần đầu — khối chữ thô không phải chỗ cuộn vô tận. */
const MAX_RAW_LINES = 600;

export interface SpatialJsonDetailProps {
  readonly activeTabId: SpatialJsonTabId;
  readonly onChangeTab: (tabId: SpatialJsonTabId) => void;
  readonly rawText: string;
  readonly selectedNode: SpatialJsonNode | null;
}

const TAB_LABELS: ReadonlyArray<{ readonly id: SpatialJsonTabId; readonly label: string }> = [
  { id: 'json', label: 'JSON' },
  { id: 'preview', label: 'Xem trước' },
];

function RawJson({ rawText }: { readonly rawText: string }) {
  const lines = rawText.split('\n');
  const shown = lines.slice(0, MAX_RAW_LINES);
  const hiddenCount = lines.length - shown.length;

  return (
    <div className="h-full overflow-auto rounded-[12px] bg-bg-sunken p-5">
      <pre className="font-mono text-[13px] leading-5 text-text-primary">
        {/* Chỉ số dòng là khoá ổn định ở đây (R-24): chữ thô được dựng lại trọn vẹn
            mỗi lần dữ liệu đổi, không có dòng nào chèn vào giữa hai dòng cũ. */}
        {shown.map((line, index) => (
          <div key={`${String(index)}:${line}`}>
            {tokenizeJsonLine(line).map((segment, segmentIndex) => (
              <span key={`${String(segmentIndex)}:${segment.text}`} className={TONE_CLASS[segment.tone]}>
                {segment.text}
              </span>
            ))}
          </div>
        ))}
      </pre>

      {hiddenCount > 0 ? (
        <p className="mt-5 text-[13px] leading-[18px] text-text-muted">
          Còn {hiddenCount} dòng nữa. Thu gọn bớt nhánh ở cây bên trái để xem phần bạn cần.
        </p>
      ) : null}
    </div>
  );
}

function NodePreview({ selectedNode }: { readonly selectedNode: SpatialJsonNode | null }) {
  if (selectedNode === null) {
    return (
      <div className="flex h-full items-center justify-center rounded-[12px] bg-bg-sunken p-5">
        <p className="max-w-[40ch] text-center text-[15px] leading-6 text-text-secondary">
          Chọn một nút ở cây bên trái để xem chi tiết của nó.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto rounded-[12px] bg-bg-sunken p-5">
      <code className="block font-mono text-[20px] leading-7 text-text-primary">{selectedNode.label}</code>
      <code className="mt-2 block font-mono text-[13px] leading-5 text-text-muted">{selectedNode.id}</code>

      <dl className="mt-5 flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <dt className="w-[120px] shrink-0 text-[13px] leading-[18px] text-text-secondary">Giá trị</dt>
          <dd className={cn('font-mono text-[13px] leading-5', TONE_CLASS[selectedNode.tone])}>
            <code>{selectedNode.valueText ?? '—'}</code>
          </dd>
        </div>

        {selectedNode.childCount !== null ? (
          <div className="flex items-baseline gap-3">
            <dt className="w-[120px] shrink-0 text-[13px] leading-[18px] text-text-secondary">Số phần tử</dt>
            <dd className="font-mono text-[13px] leading-5 text-text-secondary">
              <code>{selectedNode.childCount}</code>
            </dd>
          </div>
        ) : null}

        {selectedNode.entityId !== null ? (
          <div className="flex items-baseline gap-3">
            <dt className="w-[120px] shrink-0 text-[13px] leading-[18px] text-text-secondary">Mã đối tượng</dt>
            <dd className="font-mono text-[13px] leading-5 text-text-primary">
              <code>{selectedNode.entityId}</code>
            </dd>
          </div>
        ) : null}
      </dl>

      {selectedNode.entityId !== null ? (
        <p className="mt-5 max-w-[52ch] text-[13px] leading-[18px] text-text-muted">
          Việc tô sáng đối tượng này trong mô hình ba chiều nằm ở trình xem 3D. Màn dữ liệu chỉ đọc, nên nó
          không dựng thêm một cảnh ba chiều nữa.
        </p>
      ) : null}
    </div>
  );
}

export function SpatialJsonDetail({
  activeTabId,
  onChangeTab,
  rawText,
  selectedNode,
}: SpatialJsonDetailProps) {
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col gap-3" aria-label="Nội dung dữ liệu không gian">
      <div role="tablist" aria-label="Cách xem nội dung" className="flex items-center gap-1">
        {TAB_LABELS.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(
                'h-9 rounded-[8px] px-4 text-[14px] font-medium leading-5 transition-colors duration-fast',
                isActive ? 'bg-accent-wash text-accent-active' : 'text-text-secondary hover:bg-bg-hover',
              )}
              onClick={() => {
                onChangeTab(tab.id);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {activeTabId === 'json' ? (
          <RawJson rawText={rawText} />
        ) : (
          <NodePreview selectedNode={selectedNode} />
        )}
      </div>
    </section>
  );
}
