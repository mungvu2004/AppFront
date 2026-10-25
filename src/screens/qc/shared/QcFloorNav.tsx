import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';

import { useDoneLayers } from './useDoneLayers';
import { QC_LAYERS, qcLayerTitle, type QcLayerKey } from './qcLayers';

/**
 * Đầu chung của các màn "Kiểm tra tầng" (G4a-24, N0-04, N1-03, N2-08, G4b-06):
 * breadcrumb Tầng (chọn tầng) › Màn — tên dự án đã có ở header — và dải thẻ cùng tầng
 * trên MỘT hàng phụ 32 px: "1 Tường · 2 Cửa và nội thất · 3 Phòng" (✓ khi xong), vạch ngăn,
 * rồi nhóm "Công cụ (không bắt buộc):". Thẻ bắt buộc hiện tiến độ "12/48" (✓ khi xong).
 * Gắn: `<QcFloorNav floorId={floorId} layer="rooms" projectId={projectId} />`
 * (cần nằm trong Router). `floors` có thì cấp Tầng mở được danh sách đổi tầng.
 */
export interface QcFloorNavFloor {
  readonly id: string;
  readonly label: string;
}

export interface QcFloorNavProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly layer: QcLayerKey;
  readonly floors?: readonly QcFloorNavFloor[] | undefined;
  /** Không còn vẽ (header đã có tên dự án); giữ để nơi gọi cũ không vỡ kiểu. */
  readonly projectName?: string | undefined;
  /** Dòng tiến độ cạnh tiêu đề, đã định dạng ("12/40 đã duyệt"). Vắng thì ẩn gọn. */
  readonly progress?: string | null | undefined;
  /** Màn đã có H1 thấy được (QcPanelHead): bỏ H1 ẩn ở đây để trang chỉ có một H1. */
  readonly titled?: boolean;
}

const FLOOR_FALLBACK = 'Tầng';
const LAYER_BAR_LABEL = 'Các lớp kiểm tra';
const TOOL_GROUP_LABEL = 'Công cụ (không bắt buộc):';
const REQUIRED_GROUP_LABEL = 'Cần duyệt:';

const TAB_CLASS = cn(
  'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[13px] transition-colors duration-120',
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

export function QcFloorNav({ projectId, floorId, layer, floors = [], progress, titled = false }: QcFloorNavProps) {
  const navigate = useNavigate();
  const current = QC_LAYERS.find((item) => item.key === layer) ?? QC_LAYERS[0]!;
  const floorLabel = floors.find((floor) => floor.id === floorId)?.label ?? FLOOR_FALLBACK;
  const screenTitle = qcLayerTitle(layer);
  /* ✓ khi lớp xong; kho chưa giữ tầng này thì chỉ đánh số. */
  const layerStates = useDoneLayers(projectId, floorId);

  return (
    <div className="flex h-8 shrink-0 items-center gap-3 px-4">
      {titled ? null : <h1 className="sr-only">{`${screenTitle} · ${floorLabel}`}</h1>}
      {/* Breadcrumb không co: "Tầng 1" phải đọc đủ, dải lớp bên phải cuộn ngang trước. */}
      <div className="shrink-0">
        <Breadcrumb
          items={[
            {
              id: 'floor',
              label: floorLabel,
              onClick: () => navigate(ROUTES.project.floors(projectId)),
              options: floors.map((floor) => ({
                id: floor.id,
                label: floor.label,
                onClick: () => navigate(current.route(projectId, floor.id)),
              })),
            },
            { id: 'layer', label: screenTitle },
          ]}
        />
      </div>
      <nav aria-label={LAYER_BAR_LABEL} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto border-l border-border-default pl-3">
        {QC_LAYERS.map((item, index) => {
          const isCurrent = item.key === layer;
          const isLayer = item.group === 'layer';
          const state = isLayer ? layerStates.get(item.key) : undefined;
          const isDone = state?.done === true;
          const startsRequiredGroup = index === 0 && isLayer;
          const startsToolGroup = item.group === 'tool' && QC_LAYERS[index - 1]?.group !== 'tool';
          return (
            <Fragment key={item.key}>
              {startsRequiredGroup && <span className="shrink-0 text-[12px] text-text-muted">{REQUIRED_GROUP_LABEL}</span>}
              {startsToolGroup && (
                <>
                  <span aria-hidden="true" className="mx-2 h-5 w-px shrink-0 bg-border-control" />
                  <span className="shrink-0 text-[12px] text-text-muted">{TOOL_GROUP_LABEL}</span>
                </>
              )}
              <Link
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  TAB_CLASS,
                  isCurrent
                    ? 'bg-accent-wash font-medium text-accent'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
                to={item.route(projectId, floorId)}
              >
                {isLayer && <span aria-hidden="true" className="tabular-nums text-text-muted">{index + 1}</span>}
                {item.label}
                {isDone && (
                  <>
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-state-verified-text" />
                    <span className="sr-only">: đã xong</span>
                  </>
                )}
                {state !== undefined && !isDone && (
                  <>
                    <span aria-hidden="true" className="tabular-nums text-text-muted">{`${state.reviewed}/${state.total}`}</span>
                    <span className="sr-only">{`: đã duyệt ${state.reviewed} trên ${state.total}`}</span>
                  </>
                )}
              </Link>
            </Fragment>
          );
        })}
      </nav>
      {/* Tiến độ của lớp (Impeccable A3), cuối cùng hàng 32 px — không thêm hàng (V-16). */}
      {progress == null ? null : (
        <p className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-text-secondary" data-testid="qc-progress">
          {progress}
        </p>
      )}
    </div>
  );
}
