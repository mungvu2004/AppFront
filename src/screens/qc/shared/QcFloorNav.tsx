import { Link, useNavigate } from 'react-router-dom';

import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { LAST_PROJECT_KEY } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';

import { QC_LAYERS, qcLayerLabel, type QcLayerKey } from './qcLayers';

/**
 * Đầu chung của tám màn "Kiểm tra tầng" (G4a-24, N0-04, N1-03, N2-08, G4b-06):
 * breadcrumb Dự án › Tầng (chọn tầng) › Lớp và thanh tám lớp cùng tầng, gộp trên MỘT hàng phụ 32 px
 * (V-16: khung trên màn QC = header 48 + thanh bước 40 + hàng này).
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
  readonly projectName?: string | undefined;
}

const PROJECT_FALLBACK = 'Dự án';
const FLOOR_FALLBACK = 'Tầng';
const LAYER_BAR_LABEL = 'Các lớp kiểm tra';

/** Tên dự án AppLayout đã nhớ (khoá LAST_PROJECT_KEY) — để breadcrumb luôn có tên dự án khi nơi gọi không truyền. */
function rememberedProjectName(projectId: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(LAST_PROJECT_KEY) ?? 'null');
    return parsed !== null && typeof parsed === 'object' && 'id' in parsed && 'name' in parsed && String(parsed.id) === projectId
      ? String(parsed.name) || undefined
      : undefined;
  } catch {
    return undefined;
  }
}

export function QcFloorNav({ projectId, floorId, layer, floors = [], projectName }: QcFloorNavProps) {
  const navigate = useNavigate();
  const current = QC_LAYERS.find((item) => item.key === layer) ?? QC_LAYERS[0]!;
  const floorLabel = floors.find((floor) => floor.id === floorId)?.label ?? FLOOR_FALLBACK;
  const layerLabel = qcLayerLabel(layer);

  return (
    <div className="flex h-8 shrink-0 items-center gap-3 px-4">
      <h1 className="sr-only">{`${layerLabel} · ${floorLabel}`}</h1>
      <Breadcrumb
        items={[
          {
            id: 'project',
            label: projectName ?? rememberedProjectName(projectId) ?? PROJECT_FALLBACK,
            onClick: () => navigate(ROUTES.project.floors(projectId)),
          },
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
          { id: 'layer', label: layerLabel },
        ]}
      />
      <nav aria-label={LAYER_BAR_LABEL} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto border-l border-border-default pl-3">
        {QC_LAYERS.map((item) => {
          const isCurrent = item.key === layer;
          return (
            <Link
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[13px] transition-colors duration-120',
                'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isCurrent
                  ? 'bg-accent-wash font-medium text-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
              key={item.key}
              to={item.route(projectId, floorId)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
