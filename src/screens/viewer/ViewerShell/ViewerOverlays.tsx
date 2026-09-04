/**
 * Sáu lớp nổi quanh khung nhìn 3D: ViewCube · bản đồ nhỏ · cụm thu phóng ·
 * chú giải · thang cao độ · chip hiệu năng.
 *
 * View thuần (R-60). Gom vào một file vì cả sáu đều là "một khối nhỏ neo vào
 * một góc của khung nhìn" — tách sáu file nữa chỉ để mỗi file có một khối
 * mười lăm dòng thì làm khó đọc chứ không làm dễ.
 *
 * ## ViewCube dựng bằng nút, không bằng canvas
 *
 * Một khối lập phương vẽ bằng WebGL đẹp hơn, và không bấm được bằng bàn phím.
 * A12 nói bàn phím là đường đi hạng nhất, nên ViewCube ở đây là bốn nút thật
 * xếp trong một ô 72: Tab tới được, Enter bấm được, trình đọc màn hình đọc ra
 * tên góc nhìn. Phối cảnh nghiêng của khối được gợi bằng nền và viền token,
 * không bằng ba mặt vẽ tay.
 */

import { MiniMap } from '@/components/canvas/MiniMap';
import { cn } from '@/lib/utils';

import { ViewerZoomCluster } from './ViewerChrome';

import type {
  ViewerLegendItem,
  ViewerPerfViewModel,
  ViewerPresetId,
  ViewerPresetViewModel,
  ViewerStoreyViewModel,
} from './viewerShellTypes';
import { VIEWER_LAYOUT } from './viewerShellTypes';

/* -------------------------------------------------------------------------- */
/* ViewCube.                                                                   */
/* -------------------------------------------------------------------------- */

export interface ViewerCubeProps {
  readonly presets: readonly ViewerPresetViewModel[];
  readonly activePresetId: ViewerPresetId;
  readonly onCubeFaceSelect: (preset: ViewerPresetId) => void;
}

export function ViewerCube({ presets, activePresetId, onCubeFaceSelect }: ViewerCubeProps) {
  return (
    <div
      aria-label="Khối định hướng"
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-[10px]',
        'border border-border-default bg-bg-surface shadow-float',
      )}
      role="group"
      style={{ width: VIEWER_LAYOUT.cubePx, height: VIEWER_LAYOUT.cubePx }}
    >
      {presets.map((preset) => (
        <button
          aria-label={preset.label}
          aria-pressed={preset.id === activePresetId}
          className={cn(
            'flex items-center justify-center text-[9px] leading-tight',
            'transition-colors duration-120',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
            preset.id === activePresetId
              ? 'bg-accent-wash text-text-primary'
              : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
          )}
          key={preset.id}
          onClick={(): void => {
            onCubeFaceSelect(preset.id);
          }}
          type="button"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Thang cao độ tầng.                                                          */
/* -------------------------------------------------------------------------- */

export interface ViewerElevationScaleProps {
  readonly storeys: readonly ViewerStoreyViewModel[];
}

/**
 * Thang cao độ dọc mép trái, chữ ĐỀU.
 *
 * `tabular-nums` là chữ đều theo nghĩa đặc tả muốn: mọi chữ số cùng bề rộng,
 * nên bốn cao độ xếp thẳng cột thay vì so le theo bề rộng của số 1.
 * Tầng cao nhất ở trên, nên thứ tự vẽ là đảo ngược của thứ tự dữ liệu.
 */
export function ViewerElevationScale({ storeys }: ViewerElevationScaleProps) {
  return (
    <ol
      aria-label="Cao độ tầng"
      className="flex flex-col-reverse justify-between gap-2 py-1 text-[10px] tabular-nums text-text-muted"
    >
      {storeys.map((storey) => (
        <li className="flex items-center gap-1 whitespace-nowrap" key={storey.id}>
          <span aria-hidden="true" className="h-px w-2 bg-border-default" />
          <span>{storey.elevationLabel}</span>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Chú giải.                                                                   */
/* -------------------------------------------------------------------------- */

export interface ViewerLegendProps {
  readonly legend: readonly ViewerLegendItem[];
}

export function ViewerLegend({ legend }: ViewerLegendProps) {
  return (
    <dl
      aria-label="Chú giải"
      className={cn(
        'flex flex-col gap-1 rounded-[10px] px-3 py-2',
        'border border-border-default bg-bg-surface/90 shadow-panel',
      )}
    >
      {legend.map((item) => (
        <div className="flex items-center gap-2" key={item.id}>
          <dt aria-hidden="true">
            <span
              className="block h-2.5 w-2.5 rounded-[3px]"
              /* Màu lấy từ TOKEN, không phải mã màu thô (A1) — `colorToken` chỉ
                 bao giờ là tên một biến CSS, xem `ViewerLegendItem`. */
              style={{ backgroundColor: `var(${item.colorToken})` }}
            />
          </dt>
          <dd className="text-[11px] leading-none text-text-secondary">{item.label}</dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/* Chip hiệu năng.                                                             */
/* -------------------------------------------------------------------------- */

export interface ViewerPerfChipProps {
  readonly perf: ViewerPerfViewModel | null;
}

/**
 * Chip số tam giác — CHỈ hiện khi cờ nhà phát triển bật.
 *
 * `useViewerShell` trả `perf: null` khi cờ tắt, nên điều khiển dành cho lập
 * trình viên không bao giờ xuất hiện trên màn sản phẩm (mục B).
 */
export function ViewerPerfChip({ perf }: ViewerPerfChipProps) {
  if (perf === null) {
    return null;
  }

  return (
    <span
      className={cn(
        'rounded-[6px] border border-border-default bg-bg-surface/90 px-2 py-1',
        'text-[10px] tabular-nums leading-none text-text-muted',
      )}
    >
      {perf.trianglesLabel}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Cụm góc trên phải và góc dưới phải.                                         */
/* -------------------------------------------------------------------------- */

export interface ViewerCornerControlsProps extends ViewerCubeProps {
  /** Mức thu phóng ĐÃ ĐỊNH DẠNG (A15) — view không tự làm tròn. */
  readonly zoomLabel: string;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onZoomReset: () => void;
  readonly onFitAll: () => void;
}

/** ViewCube ở trên, bản đồ nhỏ ngay dưới nó — đúng thứ tự đặc tả mô tả. */
export function ViewerTopRightControls({
  presets,
  activePresetId,
  onCubeFaceSelect,
}: ViewerCubeProps) {
  return (
    <div className="flex flex-col items-end gap-2">
      <ViewerCube
        activePresetId={activePresetId}
        onCubeFaceSelect={onCubeFaceSelect}
        presets={presets}
      />
      <MiniMap />
    </div>
  );
}

/** Cụm thu phóng góc phải dưới. */
export function ViewerZoomControls({
  zoomLabel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitAll,
}: Omit<ViewerCornerControlsProps, keyof ViewerCubeProps>) {
  return (
    <ViewerZoomCluster
      onFitAll={onFitAll}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onZoomReset={onZoomReset}
      zoomLabel={zoomLabel}
    />
  );
}
