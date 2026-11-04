/**
 * Panel phải của bước Tường (bố cục hai panel kiểu Figma, `docs/figma-layout-spec.md`), hiện khi đang chọn hoặc mở bằng "Chi tiết":
 * - đang chọn: `QcQueueAskCard` — mã + huy hiệu + ‹ K › J ×, thân là các mục của `WallLayerInspector`,
 *   chân ghim là nút duyệt (hoặc lý do khoá tỷ lệ);
 * - chưa chọn gì: "Tầng này" — gợi ý (kèm phím J), mục "Chú giải". Không nút đi tiếp: nút đó chỉ ở đáy cột việc.
 * Trigger "Hiển thị" ở thanh đầu panel trong cả hai trường hợp.
 */

import { useMemo, type ReactNode } from 'react';

import type { CommandItem } from '@/hooks/useCommandPalette';
import { useScreenCommands } from '@/hooks/useScreenCommands';

import { QcQueueAskCard } from '../shared/QcAskCard';
import { QcInspectorEmpty, QcInspectorSection } from '../shared/QcInspectorSection';
import { QC_COMMAND_GROUP } from '../shared/qcLayout';
import { WallLayerInspector, WallLayerInspectorBadge, WallLayerInspectorFooter, type WallLayerInspectorProps } from './WallLayerInspector';
import { WallLayerLegendTray } from './WallLayerLegendTray';
import type { WallLayerCanvasViewProps } from './wallLayerHatch';
import { WALL_REASON_TITLE } from './wallReviewQueue';

export type WallLayerLegendSource = Pick<WallLayerCanvasViewProps, 'isWallLayerVisible' | 'legendLevels' | 'shapes' | 'state'>;

export interface WallLayerInspectorPanelProps extends WallLayerInspectorProps {
  /** Trigger "Hiển thị" (biến thể phẳng). */
  readonly display?: ReactNode;
  /** Dữ liệu chú giải (cùng nguồn với bản vẽ); vắng thì không có mục "Chú giải". */
  readonly legend?: WallLayerLegendSource | undefined;
}

const EMPTY_TITLE = 'Tầng này';
/* Không lặp nút "Xem tiếp": nút đi tiếp duy nhất ở đáy cột việc; phím J vẫn mở đoạn cần xem đầu tiên. */
const EMPTY_HINT = 'Chọn một đoạn tường trên bản vẽ hoặc trong danh sách để duyệt (phím J: đoạn cần xem đầu tiên).';
const LEGEND_TITLE = 'Chú giải';
const UNIT = 'Đoạn';

function WallLayerFloorPanel({ panel, display, legend }: WallLayerInspectorPanelProps) {
  const firstId = panel.rows.find((row) => !row.isReviewed)?.id ?? null;
  const { onSelect } = panel;
  /* J khi chưa chọn gì: cùng lệnh "Đoạn cần xem tiếp theo" mà thẻ của đoạn đang chọn đăng ký. */
  const commands = useMemo<CommandItem[]>(
    () =>
      firstId === null
        ? []
        : [{ id: 'qc-ask-next', group: QC_COMMAND_GROUP, label: `${UNIT} cần xem tiếp theo`, shortcut: 'J', keywords: ['tiếp', 'đoạn'], onSelect: () => onSelect(firstId) }],
    [firstId, onSelect],
  );
  useScreenCommands(commands);

  return (
    <QcInspectorEmpty display={display} hint={EMPTY_HINT} title={EMPTY_TITLE}>
      {legend === undefined || !legend.isWallLayerVisible ? null : (
        <QcInspectorSection title={LEGEND_TITLE}>
          <WallLayerLegendTray {...legend} />
        </QcInspectorSection>
      )}
    </QcInspectorEmpty>
  );
}

export function WallLayerInspectorPanel(props: WallLayerInspectorPanelProps) {
  const { panel, queue, display } = props;

  if (panel.inspector === null) {
    return <WallLayerFloorPanel {...props} />;
  }

  /* Một bộ mục cho panel và số ở cột trái — dòng "3" là ghim "3" (ghim đi theo `rows` chưa duyệt). */
  const items = panel.rows.map((row) => ({ id: row.id, pending: !row.isReviewed }));
  const reason = queue?.extras.get(panel.inspector.id)?.reason;

  return (
    <QcQueueAskCard
      badge={<WallLayerInspectorBadge panel={panel} queue={queue} />}
      code={panel.inspector.codeLabel}
      display={display}
      footer={<WallLayerInspectorFooter panel={panel} queue={queue} />}
      items={items}
      onSelect={panel.onSelect}
      reason={reason == null ? null : WALL_REASON_TITLE[reason]}
      selectedId={panel.inspector.id}
      unit={UNIT}
    >
      <WallLayerInspector panel={panel} queue={queue} />
    </QcQueueAskCard>
  );
}
