import { Link, useNavigate } from 'react-router-dom';

import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';

import { QC_LAYERS, qcLayerLabel, type QcLayerKey } from './qcLayers';

/**
 * Đầu chung của tám màn "Kiểm tra tầng" (G4a-24, N0-04, N1-03, N2-08, G4b-06):
 * breadcrumb Dự án › Tầng (chọn tầng) › Lớp, và thanh tám lớp cùng tầng.
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

export function QcFloorNav({ projectId, floorId, layer, floors = [], projectName }: QcFloorNavProps) {
  const navigate = useNavigate();
  const current = QC_LAYERS.find((item) => item.key === layer) ?? QC_LAYERS[0]!;
  const floorLabel = floors.find((floor) => floor.id === floorId)?.label ?? FLOOR_FALLBACK;
  const layerLabel = qcLayerLabel(layer);

  return (
    <div className="flex shrink-0 flex-col gap-1.5 px-4 pt-2">
      <h1 className="sr-only">{`${layerLabel} · ${floorLabel}`}</h1>
      <Breadcrumb
        items={[
          {
            id: 'project',
            label: projectName ?? PROJECT_FALLBACK,
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
      <nav aria-label={LAYER_BAR_LABEL} className="flex flex-wrap gap-1">
        {QC_LAYERS.map((item) => {
          const isCurrent = item.key === layer;
          return (
            <Link
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[13px] transition-colors duration-120',
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
