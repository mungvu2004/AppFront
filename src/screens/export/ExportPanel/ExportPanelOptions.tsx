/**
 * Cột phải, phần trên — "Phạm vi" (chọn tầng) và "Tuỳ chọn" theo định dạng
 * đang chọn. Cả hai cùng nằm trong một thẻ vì cả hai đều mô tả *đơn xuất sẽ
 * chứa gì* trước khi bấm "xuất".
 *
 * Tầng chưa duyệt vẫn chọn được (`isSelected` không phụ thuộc `isApproved`) —
 * `Badge` chỉ đổi màu, không bao giờ khoá `Checkbox`.
 *
 * "Tuỳ chọn" gấp lại mặc định theo `options.isExpanded`; đổi định dạng thì bộ
 * tuỳ chọn hoà tan lại ở tốc độ `fast` (180 ms) bằng `animate-dropdown-open`
 * (đã khai trong `tailwind.config.ts`, không phải số thô — R-71).
 *
 * `ImageOptionsView` không có trường nào sửa được qua props (không có danh
 * sách góc nhìn để chọn) nên phần của ảnh chỉ hiện thông tin, không có điều
 * khiển — đúng tinh thần "thiếu dữ liệu thì không giả vờ có điều khiển".
 *
 * Cùng tinh thần đó, công tắc "kèm lưới trục" chỉ tồn tại khi
 * `capabilities.canIncludeAxisGrid`. Hôm nay cờ đó là `false` —
 * `ExportGlbOptions` không có trường lưới trục nên công tắc không đổi được tệp
 * xuất ra — nên nó **rời khỏi DOM**, không phải bị làm xám.
 */

import { ChevronDown, ChevronUp } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/utils';

import { FOCUS_RING } from './ExportPanelFormats';
import type {
  ExportCapabilities,
  ExportDetailChoice,
  ExportFloorChoice,
  ExportFormatId,
  ExportOptionsView,
  GlbOptionsView,
  PdfOptionsView,
  SpatialJsonOptionsView,
} from './types';

const DETAIL_OPTIONS: { label: string; value: ExportDetailChoice }[] = [
  { label: 'cao', value: 'high' },
  { label: 'vừa', value: 'medium' },
  { label: 'gọn', value: 'low' },
];

function withGlb(options: ExportOptionsView, patch: Partial<GlbOptionsView>): ExportOptionsView {
  return { ...options, glb: { ...options.glb, ...patch } };
}

function withPdf(options: ExportOptionsView, patch: Partial<PdfOptionsView>): ExportOptionsView {
  return { ...options, pdf: { ...options.pdf, ...patch } };
}

function withSpatialJson(options: ExportOptionsView, patch: Partial<SpatialJsonOptionsView>): ExportOptionsView {
  return { ...options, spatialJson: { ...options.spatialJson, ...patch } };
}

interface ExportPanelScopeProps {
  readonly floors: readonly ExportFloorChoice[];
  readonly onToggleFloor: (id: string) => void;
}

function ExportPanelScope({ floors, onToggleFloor }: ExportPanelScopeProps) {
  const sortedFloors = [...floors].sort((left, right) => left.order - right.order);

  return (
    <section aria-label="phạm vi" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-text-secondary">phạm vi</h3>
      <div className="flex flex-col gap-2">
        {sortedFloors.map((floor) => (
          <div key={floor.id} className="flex flex-col gap-1 rounded border border-border-default p-2">
            <div className="flex items-center justify-between gap-2">
              <Checkbox
                label={floor.name}
                checked={floor.isSelected}
                onChange={() => {
                  onToggleFloor(floor.id);
                }}
              />
              <Badge variant={floor.isApproved ? 'verified' : 'attention'}>
                {floor.isApproved ? 'đã duyệt' : 'chưa duyệt'}
              </Badge>
            </div>
            {!floor.isApproved && (
              <p className="pl-6 text-xs text-state-attention-text">
                tầng chưa duyệt vẫn xuất được, nhưng cần chú ý trước khi gửi đi.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

interface FormatOptionsBodyProps {
  readonly formatId: ExportFormatId;
  readonly options: ExportOptionsView;
  readonly capabilities: ExportCapabilities;
  readonly onChangeOptions: (next: ExportOptionsView) => void;
}

function FormatOptionsBody({ formatId, options, capabilities, onChangeOptions }: FormatOptionsBodyProps) {
  if (formatId === 'glb') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-secondary">mức độ chi tiết</span>
          <SegmentedControl
            aria-label="mức độ chi tiết mô hình"
            options={DETAIL_OPTIONS}
            value={options.glb.detail}
            onChange={(value) => {
              onChangeOptions(withGlb(options, { detail: value }));
            }}
          />
        </div>
        <Checkbox
          label="gồm đồ nội thất"
          checked={options.glb.includeFurniture}
          onChange={(checked) => {
            onChangeOptions(withGlb(options, { includeFurniture: checked }));
          }}
        />
        {capabilities.canIncludeAxisGrid && (
          <Checkbox
            label="gồm lưới trục"
            checked={options.glb.includeAxisGrid}
            onChange={(checked) => {
              onChangeOptions(withGlb(options, { includeAxisGrid: checked }));
            }}
          />
        )}
      </div>
    );
  }

  if (formatId === 'pdf') {
    return (
      <div className="flex flex-col gap-2">
        <Checkbox
          label="gồm mặt bằng các tầng"
          checked={options.pdf.includeFloorPlans}
          onChange={(checked) => {
            onChangeOptions(withPdf(options, { includeFloorPlans: checked }));
          }}
        />
        <Checkbox
          label="gồm bảng danh sách phòng"
          checked={options.pdf.includeRoomTable}
          onChange={(checked) => {
            onChangeOptions(withPdf(options, { includeRoomTable: checked }));
          }}
        />
        <Checkbox
          label="gồm danh sách vi phạm"
          checked={options.pdf.includeViolations}
          onChange={(checked) => {
            onChangeOptions(withPdf(options, { includeViolations: checked }));
          }}
        />
        <Checkbox
          label="gồm ảnh dựng 3D"
          checked={options.pdf.includeRender3d}
          onChange={(checked) => {
            onChangeOptions(withPdf(options, { includeRender3d: checked }));
          }}
        />
      </div>
    );
  }

  if (formatId === 'image') {
    return (
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        <p>
          góc nhìn hiện tại: <span className="font-mono text-text-primary">{options.image.viewId}</span>
        </p>
        <p>
          chiều rộng xuất: <span className="font-mono text-text-primary">{options.image.widthLabel}</span>
        </p>
      </div>
    );
  }

  return (
    <Checkbox
      label="gồm độ tin cậy từng đối tượng"
      checked={options.spatialJson.includeConfidence}
      onChange={(checked) => {
        onChangeOptions(withSpatialJson(options, { includeConfidence: checked }));
      }}
    />
  );
}

export interface ExportPanelOptionsProps {
  readonly floors: readonly ExportFloorChoice[];
  readonly options: ExportOptionsView;
  readonly capabilities: ExportCapabilities;
  readonly selectedFormatId: ExportFormatId;
  readonly onToggleFloor: (id: string) => void;
  readonly onChangeOptions: (next: ExportOptionsView) => void;
  readonly onToggleOptionsExpanded: () => void;
}

export function ExportPanelOptions({
  floors,
  options,
  capabilities,
  selectedFormatId,
  onToggleFloor,
  onChangeOptions,
  onToggleOptionsExpanded,
}: ExportPanelOptionsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-default bg-bg-surface p-4">
      <ExportPanelScope floors={floors} onToggleFloor={onToggleFloor} />

      <div className="flex flex-col gap-2 border-t border-border-default pt-3">
        <button
          type="button"
          aria-expanded={options.isExpanded}
          onClick={onToggleOptionsExpanded}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-left',
            FOCUS_RING,
          )}
        >
          <span className="text-sm font-medium text-text-secondary">tuỳ chọn</span>
          {options.isExpanded ? (
            <ChevronUp aria-hidden="true" size={16} className="text-text-muted" />
          ) : (
            <ChevronDown aria-hidden="true" size={16} className="text-text-muted" />
          )}
        </button>

        {options.isExpanded && (
          <div key={selectedFormatId} className="animate-dropdown-open">
            <FormatOptionsBody
              formatId={selectedFormatId}
              options={options}
              capabilities={capabilities}
              onChangeOptions={onChangeOptions}
            />
          </div>
        )}
      </div>
    </div>
  );
}
