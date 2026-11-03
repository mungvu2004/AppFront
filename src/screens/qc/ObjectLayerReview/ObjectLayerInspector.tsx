/**
 * Thân panel phải neo (bố cục hai panel, `docs/figma-layout-spec.md`) của đối tượng đang chọn:
 * các mục "Loại", "Kích thước", "Vị trí", "Độ tin cậy", "Thông số nâng cao" (`QcInspectorSection`).
 * Đầu panel (mã, huy hiệu, ‹ › ×) là của `QcQueueAskCard`; chân ghim (duyệt, xoá, khoá tỷ lệ) là
 * `ObjectLayerInspectorFooter`; khung ghép ở `ObjectLayerInspectorPanel`.
 *
 * View THUẦN (R-60): nhận nguyên `ObjectLayerInspectorProps` (đã đóng băng ở
 * `objectLayerTypes.ts`, T4) và chỉ hiển thị — không `@/api`, `@/store`,
 * `@/domain`, `@/lib/http`. Mọi chuỗi số đã định dạng sẵn ở viewmodel (A15):
 * file này không `toFixed`/`toLocaleString`, không tự quy đổi đơn vị.
 *
 * ## Vì sao có nút "Duyệt đối tượng này" dù bản mô tả UI không nhắc tới
 *
 * `ObjectLayerInspectorProps.onApprove` là callback BẮT BUỘC (không `?`), và
 * đây là view DUY NHẤT nhận nó trong toàn bộ hợp đồng props (không có ở
 * `ObjectLayerListProps`/`ObjectLayerToolRailProps`) — khác `onDelete` của
 * màn anh em (`WallLayerViewProps.onDelete`, chỉ gọi qua phím `Backspace`
 * trong hook, `WallLayerInspector.tsx` không hề dùng nó). Vì `onApprove`
 * không có đường phím tắt nào được giao cho T7 (D/W/F/1/2/3 đều là đổi
 * loại), nút "Duyệt đối tượng này" ở đây là nơi DUY NHẤT một hành động thật
 * gọi được nó — đúng khuôn "Duyệt đoạn này" của `WallLayerInspector.tsx`,
 * đổi nhãn cho khớp đối tượng. Nút "Xoá đối tượng" (ghost, dưới nút duyệt)
 * có từ BUG-589: trước đó chỉ chuột phải trúng ký hiệu nhỏ mới xoá được.
 *
 * ## Vai Người xem — thay control bằng hiển thị tĩnh, không khoá mờ
 *
 * Theo đúng khuôn `WallLayerInspector.tsx` (`ReadOnlyThickness`): Select loại,
 * Slider vị trí, Radio hướng mở đều có bản đọc-tĩnh riêng cho
 * `isViewerRole`, thay vì `disabled` (canvas "chỉ xem" ở trạng thái
 * `forbidden` áp dụng cho mọi control dữ liệu, không riêng nút hành động).
 * Liên kết "tường chứa nó" (`onSelectHostWall`) và badge cần chú ý VẪN hiện
 * ở vai Người xem — đó là xem/chọn, không phải sửa. Nút "Gắn vào tường gần
 * nhất" và "Duyệt đối tượng này" thì ẩn hẳn (không khoá mờ), đúng chú thích
 * của chính {@link ObjectLayerInspectorProps.isViewerRole}.
 *
 * ## Bốn radio hướng mở, không phải năm
 *
 * `SwingDirection` domain có năm giá trị (`left/right/double/sliding/fixed`),
 * nhưng đặc tả đòi đúng BỐN radio biểu tượng. `fixed` ("cố định" — dùng cho
 * nội thất và phần lớn cửa sổ, xem `objectLayerTypes.ts:163`) không phải một
 * HƯỚNG mà là "không có hướng mở", nên không có radio riêng: khi
 * `inspector.swing === 'fixed'`, không radio nào trong nhóm khớp giá trị,
 * nhóm hiện không chọn radio nào — đúng ngữ nghĩa, không phải lỗi.
 *
 * ## Vì sao Select có icon ở dropdown nhưng không ở ô đóng
 *
 * `Select.Trigger` (`src/components/ui/Select.tsx`) khoá kiểu
 * `Omit<..., 'children'>` — ô đóng của nó CHỈ vẽ được `option.label` dạng
 * chuỗi, không nhận icon. Sửa `Select.tsx` bị R-68 cấm. Giải pháp không đụng
 * component chung: một icon trang trí (`aria-hidden`) đặt CẠNH ô Select,
 * luôn hiện đúng icon của loại đang chọn; icon đầy đủ cho cả tám loại vẫn
 * hiện trong danh sách khi mở (`Select.Item` composable nhận `children` tự
 * do).
 */

import { useEffect, useRef, type RefObject } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { Select } from '@/components/ui/Select';
import type { FurnitureKind, FurnitureVariant } from '@/domain/spatial/types';

import { QcInspectorSection } from '../shared/QcInspectorSection';
import { ObjectLayerFootprintField } from './ObjectLayerFootprintField';
import { ObjectLayerPositionField } from './ObjectLayerPositionField';
import { ObjectLayerSwingField } from './ObjectLayerSwingField';
import { ObjectSubtypeIcon } from './objectLayerSubtypeIcons';
import {
  AUTO_VARIANT_CHOICE,
  FURNITURE_KIND_OPTIONS,
  furnitureVariantChoicesOf,
  SOFA_CHOICE,
  OBJECT_SUBTYPES,
  OBJECT_SUBTYPE_LABELS,
  OBJECT_SUBTYPE_LAYER,
  type ObjectLayerInspectorProps,
  type ObjectSubtype,
} from './objectLayerTypes';

/* Chỉ các loại lỗ mở: lỗ mở không đổi sang đồ đạc được, chọn một loại nội thất là im lặng (BUG-590). */
const OPENING_SUBTYPES = OBJECT_SUBTYPES.filter(
  (subtype) => OBJECT_SUBTYPE_LAYER[subtype] !== 'furniture',
);

const TYPE_OPTIONS = OPENING_SUBTYPES.map((subtype) => ({
  label: OBJECT_SUBTYPE_LABELS[subtype],
  value: subtype,
}));

const TYPE_SECTION = 'Loại';
const SIZE_SECTION = 'Kích thước';
const PLACE_SECTION = 'Vị trí';
const ADVANCED_SECTION = 'Thông số nâng cao';
const TYPE_SELECT_LABEL = 'Loại đối tượng';
const FURNITURE_KIND_SELECT_LABEL = 'Đổi loại nội thất';
const VARIANT_LABEL = 'Kiểu';
const VARIANT_SELECT_LABEL = 'Đổi kiểu nội thất';
const WIDTH_LABEL = 'Chiều rộng';
const HEIGHT_LABEL = 'Chiều cao';
/* Nội thất nằm trên mặt bằng: cạnh thứ hai là chiều sâu, không phải chiều cao (K10). */
const FOOTPRINT_LABEL = 'Rộng × Sâu';
const SILL_HEIGHT_LABEL = 'Cao độ bệ cửa';
const HOST_WALL_LABEL = 'Tường chứa nó';
const CONFIDENCE_LABEL = 'Độ tin cậy';
const UNATTACHED_BADGE = 'Chưa gắn vào tường nào';
/** Nội thất không áp tường nào — chỗ đứng bình thường của nó, không phải việc phải làm (B-V6-13). */
const FREE_STANDING_LABEL = 'Không gắn tường';
const ATTACH_NEAREST_LABEL = 'Gắn vào tường gần nhất';

/** Thân panel: `null` khi chưa chọn gì (panel trống "Tầng này" do `ObjectLayerInspectorPanel` dựng). */
export function ObjectLayerInspector({
  inspector,
  isViewerRole,
  onChangeSubtype,
  onChangeSwing,
  onChangeFurnitureKind,
  onDragPosition,
  onAttachToNearestWall,
  onSelectHostWall,
  onResize,
  onRotate,
  focusKindToken = 0,
}: ObjectLayerInspectorProps) {
  /* Vừa vẽ xong một món (B3): ô loại nội thất nhận focus để chọn loại ngay. */
  const kindTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (focusKindToken > 0) {
      kindTriggerRef.current?.focus();
    }
  }, [focusKindToken]);

  return inspector === null ? null : (
    <ObjectInspectorBody
      inspector={inspector}
      isViewerRole={isViewerRole}
      onAttachToNearestWall={onAttachToNearestWall}
      onChangeFurnitureKind={onChangeFurnitureKind}
      onChangeSubtype={onChangeSubtype}
      onChangeSwing={onChangeSwing}
      onDragPosition={onDragPosition}
      onSelectHostWall={onSelectHostWall}
      kindTriggerRef={kindTriggerRef}
      onResize={onResize}
      onRotate={onRotate}
    />
  );
}

type NonNullInspector = NonNullable<ObjectLayerInspectorProps['inspector']>;

interface ObjectInspectorBodyProps
  extends Omit<
    ObjectLayerInspectorProps,
    'inspector' | 'onApprove' | 'onDelete' | 'scaleLock' | 'focusKindToken'
  > {
  readonly inspector: NonNullInspector;
  readonly kindTriggerRef: RefObject<HTMLButtonElement | null>;
}

function ObjectInspectorBody({
  inspector,
  isViewerRole,
  onChangeSubtype,
  onChangeSwing,
  onChangeFurnitureKind,
  onDragPosition,
  onAttachToNearestWall,
  onSelectHostWall,
  kindTriggerRef,
  onResize,
  onRotate,
}: ObjectInspectorBodyProps) {
  const { footprintMm, furnitureKind, hostWallId, hostWallLabel } = inspector;
  const variantChoices = furnitureKind === null ? [] : furnitureVariantChoicesOf(furnitureKind);
  const isFurniture = OBJECT_SUBTYPE_LAYER[inspector.subtype] === 'furniture'; // loại, hướng mở chỉ đọc (BUG-590)

  return (
    <>
      <QcInspectorSection title={TYPE_SECTION}>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-[46px] w-[46px] sm:h-[38px] sm:w-[38px] shrink-0 items-center justify-center rounded-lg bg-bg-sunken text-text-secondary"
          >
            <ObjectSubtypeIcon className="h-[18px] w-[18px]" subtype={inspector.subtype} />
          </span>

          {isFurniture && !isViewerRole && inspector.furnitureKind !== null ? (
            <Select.Root
              className="flex-1"
              onChange={(value) => {
                /* Sofa = ghế + kiểu sofa (hợp đồng lô 1); chọn loại khác thì bỏ kiểu cũ, máy suy lại theo cỡ. */
                if (value === SOFA_CHOICE) onChangeFurnitureKind(inspector.id, 'chair', 'sofa');
                else onChangeFurnitureKind(inspector.id, value as FurnitureKind, null);
              }}
              options={FURNITURE_KIND_OPTIONS}
              value={
                inspector.furnitureKind === 'chair' && inspector.furnitureVariant === 'sofa'
                  ? SOFA_CHOICE
                  : inspector.furnitureKind
              }
            >
              <Select.Trigger
                aria-label={FURNITURE_KIND_SELECT_LABEL}
                options={FURNITURE_KIND_OPTIONS}
                ref={kindTriggerRef}
              />
              <Select.Content>
                {FURNITURE_KIND_OPTIONS.map((option, index) => (
                  <Select.Item index={index} key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          ) : isViewerRole || isFurniture ? (
            <div className="flex h-[46px] sm:h-[38px] flex-1 items-center px-3 text-[14px] text-text-primary">
              {inspector.typeLabel}
            </div>
          ) : (
            <Select.Root
              className="flex-1"
              onChange={(value) => onChangeSubtype(inspector.id, value as ObjectSubtype)}
              options={TYPE_OPTIONS}
              value={inspector.subtype}
            >
              <Select.Trigger aria-label={TYPE_SELECT_LABEL} options={TYPE_OPTIONS} />
              <Select.Content>
                {OPENING_SUBTYPES.map((subtype, index) => {
                  return (
                    <Select.Item index={index} key={subtype} value={subtype}>
                      <span className="flex items-center gap-2">
                        <ObjectSubtypeIcon
                          className="h-4 w-4 shrink-0 text-text-secondary"
                          subtype={subtype}
                        />
                        <span>{OBJECT_SUBTYPE_LABELS[subtype]}</span>
                      </span>
                    </Select.Item>
                  );
                })}
              </Select.Content>
            </Select.Root>
          )}
        </div>
        {isFurniture && !isViewerRole && variantChoices.length > 0 && furnitureKind !== null ? (
          <FieldRow label={VARIANT_LABEL}>
            <Select.Root
              className="flex-1"
              onChange={(value) =>
                onChangeFurnitureKind(
                  inspector.id,
                  furnitureKind,
                  value === AUTO_VARIANT_CHOICE ? null : (value as FurnitureVariant),
                )
              }
              options={variantChoices}
              value={inspector.furnitureVariant ?? AUTO_VARIANT_CHOICE}
            >
              <Select.Trigger aria-label={VARIANT_SELECT_LABEL} options={variantChoices} />
              <Select.Content>
                {variantChoices.map((option, index) => (
                  <Select.Item index={index} key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </FieldRow>
        ) : null}
      </QcInspectorSection>

      <QcInspectorSection title={SIZE_SECTION}>
        {isFurniture &&
        !isViewerRole &&
        footprintMm !== undefined &&
        onResize !== undefined &&
        onRotate !== undefined ? (
          <ObjectLayerFootprintField
            depthMm={footprintMm.depthMm}
            objectId={inspector.id}
            onResize={onResize}
            onRotate={onRotate}
            widthMm={footprintMm.widthMm}
          />
        ) : isFurniture ? (
          <FieldRow label={FOOTPRINT_LABEL}>
            <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
              {inspector.sizeLabel}
            </span>
          </FieldRow>
        ) : (
          <>
            <FieldRow label={WIDTH_LABEL}>
              <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
                {inspector.widthLabel}
              </span>
            </FieldRow>
            {inspector.sizeWarning == null ? null : (
              <Badge
                className="mb-2 self-start"
                data-testid="object-size-warning"
                variant="attention"
              >
                {inspector.sizeWarning}
              </Badge>
            )}
            <FieldRow label={HEIGHT_LABEL}>
              <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
                {inspector.heightLabel}
              </span>
            </FieldRow>
          </>
        )}
      </QcInspectorSection>

      <QcInspectorSection title={PLACE_SECTION}>
        <FieldRow label={HOST_WALL_LABEL}>
          {inspector.isOrphan ? (
            <div className="flex flex-col items-start gap-2 py-1">
              <Badge variant="attention">{UNATTACHED_BADGE}</Badge>
              {!isViewerRole && (
                <Button
                  onClick={() => onAttachToNearestWall(inspector.id)}
                  size="sm"
                  variant="secondary"
                >
                  {ATTACH_NEAREST_LABEL}
                </Button>
              )}
            </div>
          ) : hostWallId === null || hostWallLabel === null ? (
            <span className="flex h-9 items-center text-[14px] text-text-muted">
              {FREE_STANDING_LABEL}
            </span>
          ) : (
            <button
              className="flex h-9 items-center rounded-sm font-mono text-[14px] text-accent underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              onClick={() => onSelectHostWall(hostWallId)}
              type="button"
            >
              {hostWallLabel}
            </button>
          )}
        </FieldRow>

        <ObjectLayerPositionField
          inspector={inspector}
          isViewerRole={isViewerRole}
          onDragPosition={onDragPosition}
        />

        {isFurniture ? null : (
          <ObjectLayerSwingField
            isViewerRole={isViewerRole}
            onChangeSwing={onChangeSwing}
            inspector={inspector}
          />
        )}
      </QcInspectorSection>

      <QcInspectorSection title={CONFIDENCE_LABEL}>
        {/* Bằng chữ như dòng danh sách, không phải số trần "0,26" (K10). */}
        <span className="flex h-8 items-center text-[14px] text-text-primary">
          {inspector.confidenceLabel}
        </span>
      </QcInspectorSection>

      {inspector.sillHeightLabel === null ? null : (
        <QcInspectorSection collapsible defaultOpen={false} title={ADVANCED_SECTION}>
          <FieldRow isLast label={SILL_HEIGHT_LABEL}>
            <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
              {inspector.sillHeightLabel}
            </span>
          </FieldRow>
        </QcInspectorSection>
      )}
    </>
  );
}
