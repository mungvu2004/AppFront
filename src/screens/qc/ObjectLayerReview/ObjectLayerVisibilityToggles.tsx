/**
 * Ẩn/hiện lớp TRÊN BẢN VẼ (Codex P2, UX-R2): chip đếm ở panel trái đã thành bộ lọc danh sách,
 * nên công tắc lớp của canvas về đây — một cụm nhỏ cạnh cụm thu phóng.
 *
 * Giữ tên truy cập "Ẩn lớp …"/"Hiện lớp …" + `aria-pressed` của cây lớp cũ: bàn phím và trình
 * đọc màn hình đi đúng đường cũ. Người xem cũng bật tắt được — đây là xem, không phải sửa.
 */

import { lowerFirst } from '@/lib/format/sentence';
import { cn } from '@/lib/utils';

import type { ObjectLayerId, ObjectLayerVisibility } from './objectLayerTypes';
import { OBJECT_LAYER_IDS, OBJECT_LAYER_LABELS } from './objectLayerTypes';

const GROUP_LABEL = 'Hiển thị';

export interface ObjectLayerVisibilityTogglesProps {
  readonly layerVisibility: ObjectLayerVisibility;
  readonly onToggleLayer: (layer: ObjectLayerId) => void;
}

export function ObjectLayerVisibilityToggles({ layerVisibility, onToggleLayer }: ObjectLayerVisibilityTogglesProps) {
  return (
    /* Cụm thu phóng chiếm ~190 px góc phải dưới; cụm này đứng ngay bên trái nó. */
    <div
      aria-label={GROUP_LABEL}
      className="absolute bottom-4 right-[200px] z-20 flex items-center gap-1 rounded-xl border border-border-default bg-bg-surface px-2 py-1.5 shadow-float"
      role="group"
    >
      <span aria-hidden="true" className="px-1 text-[12px] text-text-muted">
        {GROUP_LABEL}
      </span>
      {OBJECT_LAYER_IDS.map((layer) => {
        const label = OBJECT_LAYER_LABELS[layer];
        const isVisible = layerVisibility[layer];

        return (
          <button
            aria-label={`${isVisible ? 'Ẩn lớp ' : 'Hiện lớp '}${lowerFirst(label)}`}
            aria-pressed={isVisible}
            className={cn(
              'h-7 rounded-lg px-2 text-[12px] transition-colors duration-120',
              'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              isVisible
                ? 'bg-accent-wash text-text-primary'
                : 'text-text-muted line-through hover:bg-bg-hover hover:text-text-primary',
            )}
            key={layer}
            onClick={() => onToggleLayer(layer)}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
