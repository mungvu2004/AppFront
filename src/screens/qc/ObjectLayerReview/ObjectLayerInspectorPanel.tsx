/**
 * Panel phải neo của `ObjectLayerReview` (bố cục hai panel, `docs/figma-layout-spec.md`): đang chọn →
 * `QcQueueAskCard` (mã + huy hiệu + ‹ K › J ×, các mục của `ObjectLayerInspector`, chân ghim duyệt/xoá);
 * chưa chọn → `QcInspectorEmpty` "Tầng này". Trigger "Hiển thị" luôn ở thanh đầu panel, không nổi trên bản vẽ.
 */

import { QcQueueAskCard } from '../shared/QcAskCard';
import { QcInspectorEmpty } from '../shared/QcInspectorSection';

import { ObjectLayerDisplayPopover } from './ObjectLayerDisplayPopover';
import { ObjectLayerInspector } from './ObjectLayerInspector';
import {
  ObjectLayerInspectorBadge,
  ObjectLayerInspectorFooter,
} from './ObjectLayerInspectorFooter';
import { OBJECT_REASON_TITLE, objectReasonOf } from './objectReviewReasons';
import type { ObjectLayerReviewModel } from './objectLayerTypes';

const EMPTY_TITLE = 'Tầng này';
const EMPTY_HINT = 'Chọn một cửa hoặc món nội thất trên bản vẽ hay trong danh sách để duyệt.';
const SETTLED = { isReviewed: true, isLowConfidence: false, isOrphan: false } as const;

export function ObjectLayerInspectorPanel({
  model,
  readOnly,
}: {
  readonly model: ObjectLayerReviewModel;
  readonly readOnly: boolean;
}) {
  const display = (
    <ObjectLayerDisplayPopover
      layerVisibility={model.layerVisibility}
      onToggleLayer={model.onToggleLayer}
    />
  );
  const { inspector } = model;

  if (inspector === null) {
    return <QcInspectorEmpty display={display} hint={EMPTY_HINT} title={EMPTY_TITLE} />;
  }

  const reason = objectReasonOf(model.rows.find((row) => row.id === inspector.id) ?? SETTLED);

  return (
    <QcQueueAskCard
      badge={<ObjectLayerInspectorBadge inspector={inspector} />}
      code={inspector.codeLabel}
      display={display}
      footer={
        <ObjectLayerInspectorFooter
          inspector={inspector}
          isViewerRole={readOnly}
          onApprove={model.onApprove}
          onDelete={model.onDelete}
          scaleLock={model.scaleLock ?? null}
        />
      }
      items={model.rows.map((row) => ({ id: row.id, pending: !row.isReviewed }))}
      onSelect={model.onSelect}
      reason={reason === null ? null : OBJECT_REASON_TITLE[reason]}
      selectedId={inspector.id}
      unit="Mục"
    >
      <ObjectLayerInspector
        focusKindToken={model.focusKindToken}
        inspector={inspector}
        isViewerRole={readOnly}
        onApprove={model.onApprove}
        onAttachToNearestWall={model.onAttachToNearestWall}
        onChangeFurnitureKind={model.onChangeFurnitureKind}
        onChangeSubtype={model.onChangeSubtype}
        onChangeSwing={model.onChangeSwing}
        onDelete={model.onDelete}
        onDragPosition={model.onDragPosition}
        onResize={model.onResize}
        onRotate={model.onRotate}
        onSelectHostWall={model.onSelectHostWall}
      />
    </QcQueueAskCard>
  );
}
