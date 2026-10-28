import { QcDisplayPopover } from '../shared/QcDisplayPopover';
import type { ObjectLayerId, ObjectLayerVisibility } from './objectLayerTypes';
import { OBJECT_LAYER_IDS, OBJECT_LAYER_LABELS } from './objectLayerTypes';

const LAYER_GROUP = 'Lớp của bước';

/** Bố cục L23: công tắc ba lớp (cửa đi, cửa sổ, nội thất) trong popover "Hiển thị" của bản vẽ. */
export function ObjectLayerDisplayPopover({
  layerVisibility,
  onToggleLayer,
}: {
  readonly layerVisibility: ObjectLayerVisibility;
  readonly onToggleLayer: (layer: ObjectLayerId) => void;
}) {
  return (
    <QcDisplayPopover
      groups={[
        {
          title: LAYER_GROUP,
          items: OBJECT_LAYER_IDS.map((layer) => ({
            key: layer,
            label: OBJECT_LAYER_LABELS[layer],
            checked: layerVisibility[layer],
            onToggle: () => onToggleLayer(layer),
          })),
        },
      ]}
    />
  );
}
