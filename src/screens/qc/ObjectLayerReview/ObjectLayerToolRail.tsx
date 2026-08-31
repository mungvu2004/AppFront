/**
 * Thanh công cụ trái (56px) của màn Lớp đối tượng — đúng khuôn QC-SHELL
 * (`WallLayerToolRail.tsx`). View THUẦN (R-60): không `useState` cho nhóm
 * loại/loại con đang chọn — đó là trạng thái nghiệp vụ do hook (T5) sở
 * hữu, đi vào qua `activeLayer`/`activeSubtype`. View KHÔNG tự đăng ký phím
 * tắt (`addEventListener` hay `useShortcut`) — T5 làm việc đó qua
 * `shortcutRegistry`; ở đây chỉ hiển thị gợi ý phím bằng {@link Kbd}.
 *
 * ## Vì sao mỗi nhóm chỉ có tối đa BA nút loại con
 *
 * `ObjectLayerToolRailProps.onSelectSubtypeSlot` (`objectLayerTypes.ts`,
 * đóng băng) nhận đúng `1 | 2 | 3` — không có slot thứ tư/năm. Nhóm "nội
 * thất" có NĂM loại con (`bed, sofa, diningTable, toilet, basin`); ba loại
 * đầu (đúng thứ tự {@link OBJECT_SUBTYPES}) có nút + phím tắt ở đây, hai
 * loại còn lại (`toilet`, `basin`) chỉ đổi được qua Select ở
 * `ObjectLayerInspector.tsx` — đúng như chú thích của chính kiểu
 * `onSelectSubtypeSlot` ("Vị trí 1/2/3 trong nhóm hiện tại"), không phải
 * thiếu sót của file này.
 *
 * ## Bảng icon riêng, không cross-import `ObjectLayerInspector.tsx`
 *
 * `ObjectLayerInspector.tsx` có một bảng tra icon-theo-loại tương tự, nhưng
 * mỗi view trong màn tự đứng độc lập (đúng khuôn `WallLayerToolRail.tsx`
 * không import bất cứ thứ gì từ `WallLayerInspector.tsx`) — trùng lặp một
 * bảng tám dòng còn rẻ hơn việc ghép hai view qua một import chéo không cần
 * thiết.
 */

import {
  Armchair,
  Bath,
  Bed,
  Blinds,
  Columns2,
  DoorOpen,
  Droplet,
  Sofa,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';

import {
  OBJECT_LAYER_LABELS,
  OBJECT_SUBTYPES,
  OBJECT_SUBTYPE_LABELS,
  OBJECT_SUBTYPE_LAYER,
  type ObjectLayerId,
  type ObjectLayerToolRailProps,
  type ObjectSubtype,
} from './objectLayerTypes';

/** Tối đa ba nút loại con mỗi nhóm — khớp `1 | 2 | 3` của `onSelectSubtypeSlot`. */
const MAX_SUBTYPE_SLOTS = 3;

interface LayerToolDef {
  readonly id: ObjectLayerId;
  readonly icon: LucideIcon;
  /** Tên phím — chữ hoa vì đây là tên phím, ngoại lệ hợp lệ của A6. */
  readonly kbd: string;
}

const LAYER_TOOLS: readonly LayerToolDef[] = [
  { icon: DoorOpen, id: 'door', kbd: 'D' },
  { icon: Blinds, id: 'window', kbd: 'W' },
  { icon: Armchair, id: 'furniture', kbd: 'F' },
];

/**
 * `toilet`/`basin` không có icon riêng trong `lucide-react` (đã kiểm), và
 * dù sao cũng KHÔNG BAO GIỜ render qua ray này — cả hai đứng ở vị trí 4 và 5
 * của nhóm "nội thất", ngoài {@link MAX_SUBTYPE_SLOTS}. Vẫn khai đủ tám
 * khoá để bảng tra là `Record` đầy đủ kiểu, tránh lỗi âm thầm nếu
 * `MAX_SUBTYPE_SLOTS` từng tăng lên — `Bath`/`Droplet` là xấp xỉ gần nhất,
 * không phải hai ký hiệu tự vẽ trùng với `ObjectLayerInspector.tsx`.
 */
const SUBTYPE_ICONS: Readonly<Record<ObjectSubtype, LucideIcon>> = {
  basin: Droplet,
  bed: Bed,
  diningTable: UtensilsCrossed,
  doubleDoor: Columns2,
  singleDoor: DoorOpen,
  sofa: Sofa,
  toilet: Bath,
  window: Blinds,
};

const RAIL_ARIA_LABEL = 'Công cụ lớp đối tượng';

function subtypesOfLayer(layer: ObjectLayerId): readonly ObjectSubtype[] {
  return OBJECT_SUBTYPES.filter((subtype) => OBJECT_SUBTYPE_LAYER[subtype] === layer).slice(
    0,
    MAX_SUBTYPE_SLOTS,
  );
}

export function ObjectLayerToolRail({
  activeLayer,
  activeSubtype,
  onSelectLayer,
  onSelectSubtypeSlot,
  isViewerRole,
}: ObjectLayerToolRailProps) {
  const subtypeSlots = activeLayer === null ? [] : subtypesOfLayer(activeLayer);

  return (
    <div
      aria-label={RAIL_ARIA_LABEL}
      aria-orientation="vertical"
      className="flex w-[56px] shrink-0 flex-col items-center gap-1 py-2"
      role="toolbar"
    >
      {!isViewerRole && (
        <>
          {LAYER_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = tool.id === activeLayer;

            return (
              <div className="relative flex w-full flex-col items-center gap-0.5" key={tool.id}>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-accent"
                  />
                )}
                <IconButton
                  aria-label={`chọn nhóm ${OBJECT_LAYER_LABELS[tool.id]} (phím ${tool.kbd})`}
                  disabled={activeLayer === null}
                  icon={<Icon aria-hidden="true" className="h-[18px] w-[18px]" />}
                  isActive={isActive}
                  onClick={() => onSelectLayer(tool.id)}
                  size="lg"
                  tooltip={false}
                />
                <Kbd>{tool.kbd}</Kbd>
              </div>
            );
          })}

          {subtypeSlots.length > 0 && (
            <>
              <span aria-hidden="true" className="my-1 h-px w-8 bg-border-default" />

              {subtypeSlots.map((subtype, index) => {
                const Icon = SUBTYPE_ICONS[subtype];
                const slot = (index + 1) as 1 | 2 | 3;
                const isActive = subtype === activeSubtype;

                return (
                  <div className="relative flex w-full flex-col items-center gap-0.5" key={subtype}>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-accent"
                      />
                    )}
                    <IconButton
                      aria-label={`đổi thành ${OBJECT_SUBTYPE_LABELS[subtype]} (phím ${slot})`}
                      icon={<Icon aria-hidden="true" className="h-[18px] w-[18px]" />}
                      isActive={isActive}
                      onClick={() => onSelectSubtypeSlot(slot)}
                      size="lg"
                      tooltip={false}
                    />
                    <Kbd>{slot}</Kbd>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
