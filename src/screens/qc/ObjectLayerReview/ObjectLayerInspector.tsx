/**
 * Panel phải (344px) — thanh tra đối tượng đang chọn, `ObjectLayerReview`.
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

import { ArrowLeft, ArrowLeftRight, ArrowRight, Columns2 } from 'lucide-react';
import { useEffect, useRef, type ComponentType, type RefObject } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { Radio } from '@/components/ui/Radio';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

import { ObjectLayerFootprintField } from './ObjectLayerFootprintField';
import { ObjectLayerPositionField } from './ObjectLayerPositionField';
import { ObjectSubtypeIcon, type OutlineIconProps } from './objectLayerSubtypeIcons';
import {
  FURNITURE_KIND_OPTIONS,
  OBJECT_SUBTYPES,
  OBJECT_SUBTYPE_LABELS,
  OBJECT_SUBTYPE_LAYER,
  type ObjectLayerInspectorProps,
  type ObjectSubtype,
} from './objectLayerTypes';

/** Bốn hướng mở có radio riêng — xem lý do "bốn, không phải năm" ở đầu file. */
interface SwingOption {
  readonly value: 'left' | 'right' | 'double' | 'sliding';
  /** Nhãn tiếng Việt HIỆN cạnh icon, viết hoa chữ đầu (A6) — cùng nghĩa `SWING_LABELS` của `lib/viewmodel/toViewModel.ts`. */
  readonly label: string;
  readonly icon: ComponentType<OutlineIconProps>;
}

const SWING_OPTIONS: readonly SwingOption[] = [
  { icon: ArrowLeft, label: 'Mở trái', value: 'left' },
  { icon: ArrowRight, label: 'Mở phải', value: 'right' },
  { icon: Columns2, label: 'Hai cánh', value: 'double' },
  { icon: ArrowLeftRight, label: 'Trượt', value: 'sliding' },
];

/* Chỉ các loại lỗ mở: lỗ mở không đổi sang đồ đạc được, chọn một loại nội thất là im lặng (BUG-590). */
const OPENING_SUBTYPES = OBJECT_SUBTYPES.filter((subtype) => OBJECT_SUBTYPE_LAYER[subtype] !== 'furniture');

const TYPE_OPTIONS = OPENING_SUBTYPES.map((subtype) => ({
  label: OBJECT_SUBTYPE_LABELS[subtype],
  value: subtype,
}));

const PANEL_TITLE = 'Đối tượng';
const TYPE_SELECT_LABEL = 'Loại đối tượng';
const FURNITURE_KIND_SELECT_LABEL = 'Đổi loại nội thất';
const WIDTH_LABEL = 'Chiều rộng';
const HEIGHT_LABEL = 'Chiều cao';
/* Nội thất nằm trên mặt bằng: cạnh thứ hai là chiều sâu, không phải chiều cao (K10). */
const FOOTPRINT_LABEL = 'Rộng × Sâu';
const SILL_HEIGHT_LABEL = 'Cao độ bệ cửa';
const HOST_WALL_LABEL = 'Tường chứa nó';
const SWING_LABEL = 'Hướng mở';
const CONFIDENCE_LABEL = 'Độ tin cậy';
const UNATTACHED_BADGE = 'Chưa gắn vào tường nào';
/** Nội thất không áp tường nào — chỗ đứng bình thường của nó, không phải việc phải làm (B-V6-13). */
const FREE_STANDING_LABEL = 'Không gắn tường';
const ATTACH_NEAREST_LABEL = 'Gắn vào tường gần nhất';
const APPROVE_PREFIX = 'Duyệt';
const APPROVED_LABEL = 'Đã duyệt';
const APPROVE_HINT = 'Duyệt xong tự sang đối tượng chưa duyệt kế tiếp. Xoá nhầm thì bấm Hoàn tác trên thông báo.';
/* Hoàn tác thay hộp hỏi (Z/S-16): xoá tức thì, toast hoàn tác tám giây (A8). */
const DELETE_OPENING_LABEL = 'Xoá (không phải cửa)';
const DELETE_FURNITURE_LABEL = 'Xoá (không phải đồ vật)';
const EMPTY_MESSAGE = 'Chọn một mục để xem chi tiết.';
const OPEN_SCALE_LABEL = 'Đặt tỷ lệ';
const SUGGESTION_BADGE = 'Gợi ý';
const ACCEPT_SUGGESTION_LABEL = 'Nhận gợi ý';
const REJECT_SUGGESTION_LABEL = 'Bỏ gợi ý';

/** Tầng thiếu tỷ lệ: nút chính là lối sang bước Tỷ lệ, kèm lý do (UX-R1 r3). */
function ScaleLockFooter({ scaleLock }: { readonly scaleLock: NonNullable<ObjectLayerInspectorProps['scaleLock']> }) {
  return (
    <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-border-default bg-bg-surface px-5 py-3">
      <p className="text-[13px] text-state-violation-text">{scaleLock.reason}</p>
      {scaleLock.onOpenScale === null ? null : (
        <Button fullWidth onClick={scaleLock.onOpenScale} variant="primary">
          {OPEN_SCALE_LABEL}
        </Button>
      )}
    </div>
  );
}

export function ObjectLayerInspector({
  inspector,
  isViewerRole,
  onChangeSubtype,
  onChangeSwing,
  onChangeFurnitureKind,
  onDragPosition,
  onDelete,
  onApprove,
  onAttachToNearestWall,
  onSelectHostWall,
  scaleLock = null,
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

  return (
    /* `lg:h-full`: ở 1024 ngăn kéo cũng có chiều cao chặn, nên khối nút ghim đáy luôn thấy (Z/S-16). */
    <div className="order-2 flex w-full shrink-0 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel lg:h-full xl:order-0">
      <div className="flex h-14 shrink-0 items-center gap-2 px-5">
        <h2 className="text-[13px] font-medium text-text-secondary">{PANEL_TITLE}</h2>
        {inspector === null ? null : (
          <>
            <span className="text-heading tabular-nums text-text-primary">{inspector.codeLabel}</span>
            {inspector.reviewed && <Badge variant="verified">{APPROVED_LABEL}</Badge>}
            {inspector.isSuggested === true && <Badge variant="neutral">{SUGGESTION_BADGE}</Badge>}
          </>
        )}
      </div>

      {inspector === null ? (
        <p className="px-5 pb-5 text-[13px] text-text-secondary">{EMPTY_MESSAGE}</p>
      ) : (
        <ObjectInspectorBody
          inspector={inspector}
          isViewerRole={isViewerRole}
          onApprove={onApprove}
          onAttachToNearestWall={onAttachToNearestWall}
          onChangeFurnitureKind={onChangeFurnitureKind}
          onChangeSubtype={onChangeSubtype}
          onChangeSwing={onChangeSwing}
          onDelete={onDelete}
          onDragPosition={onDragPosition}
          onSelectHostWall={onSelectHostWall}
          kindTriggerRef={kindTriggerRef}
          onResize={onResize}
          onRotate={onRotate}
        />
      )}
      {scaleLock === null ? null : <ScaleLockFooter scaleLock={scaleLock} />}
    </div>
  );
}

type NonNullInspector = NonNullable<ObjectLayerInspectorProps['inspector']>;

interface ObjectInspectorBodyProps
  extends Omit<ObjectLayerInspectorProps, 'inspector'> {
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
  onApprove,
  onAttachToNearestWall,
  onDelete,
  onSelectHostWall,
  kindTriggerRef,
  onResize,
  onRotate,
}: ObjectInspectorBodyProps) {
  const { footprintMm, hostWallId, hostWallLabel } = inspector;
  const isSuggested = inspector.isSuggested === true;
  const isFurniture = OBJECT_SUBTYPE_LAYER[inspector.subtype] === 'furniture'; // loại, hướng mở chỉ đọc (BUG-590)

  return (
    <>
      {!isViewerRole && (
        /*
         * U12: nút duyệt ở ĐẦU thẻ, ngoài vùng cuộn — chỗ của nó không đổi theo loại đồ (thân thẻ cao
         * thấp khác nhau) và không phải cuộn mới thấy.
         */
        <div className="flex shrink-0 flex-col gap-2 px-5 pb-4">
          <Button
            aria-keyshortcuts={isSuggested ? 'Enter' : 'A'}
            disabled={inspector.reviewed}
            fullWidth
            onClick={() => onApprove(inspector.id)}
            {...(inspector.reviewed ? {} : { shortcut: isSuggested ? 'Enter' : 'A' })}
            variant={inspector.reviewed ? 'secondary' : 'primary'}
          >
            {inspector.reviewed ? APPROVED_LABEL : isSuggested ? ACCEPT_SUGGESTION_LABEL : `${APPROVE_PREFIX} ${inspector.codeLabel}`}
          </Button>
          <p className="text-[12px] text-text-secondary">{APPROVE_HINT}</p>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-5">

      <div className="flex items-center gap-2 px-5 pb-4">
        <span
          aria-hidden="true"
          className="flex h-[46px] w-[46px] sm:h-[38px] sm:w-[38px] shrink-0 items-center justify-center rounded-lg bg-bg-sunken text-text-secondary"
        >
          <ObjectSubtypeIcon className="h-[18px] w-[18px]" subtype={inspector.subtype} />
        </span>

        {isFurniture && !isViewerRole && inspector.furnitureKind !== null ? (
          <Select.Root
            className="flex-1"
            onChange={(value) => onChangeFurnitureKind(inspector.id, value as (typeof FURNITURE_KIND_OPTIONS)[number]['value'])}
            options={FURNITURE_KIND_OPTIONS}
            value={inspector.furnitureKind}
          >
            <Select.Trigger aria-label={FURNITURE_KIND_SELECT_LABEL} options={FURNITURE_KIND_OPTIONS} ref={kindTriggerRef} />
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
                      <ObjectSubtypeIcon className="h-4 w-4 shrink-0 text-text-secondary" subtype={subtype} />
                      <span>{OBJECT_SUBTYPE_LABELS[subtype]}</span>
                    </span>
                  </Select.Item>
                );
              })}
            </Select.Content>
          </Select.Root>
        )}
      </div>

      <div className="flex flex-col px-5">
        {isFurniture && !isViewerRole && footprintMm !== undefined && onResize !== undefined && onRotate !== undefined ? (
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
            <FieldRow label={HEIGHT_LABEL}>
              <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
                {inspector.heightLabel}
              </span>
            </FieldRow>
          </>
        )}

        {inspector.sillHeightLabel !== null && (
          <FieldRow label={SILL_HEIGHT_LABEL}>
            <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
              {inspector.sillHeightLabel}
            </span>
          </FieldRow>
        )}

        <FieldRow label={HOST_WALL_LABEL}>
          {inspector.isOrphan ? (
            <div className="flex flex-col items-start gap-2 py-1">
              <Badge variant="attention">{UNATTACHED_BADGE}</Badge>
              {!isViewerRole && (
                <Button onClick={() => onAttachToNearestWall(inspector.id)} size="sm" variant="secondary">
                  {ATTACH_NEAREST_LABEL}
                </Button>
              )}
            </div>
          ) : hostWallId === null || hostWallLabel === null ? (
            <span className="flex h-9 items-center text-[14px] text-text-muted">{FREE_STANDING_LABEL}</span>
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

        <ObjectLayerPositionField inspector={inspector} isViewerRole={isViewerRole} onDragPosition={onDragPosition} />

        {isFurniture ? null : (
        <FieldRow label={SWING_LABEL}>
          {isViewerRole ? (
            <div aria-label={SWING_LABEL} className="flex h-9 items-center gap-3" role="group">
              {SWING_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = option.value === inspector.swing;

                return (
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      isActive ? 'bg-accent-wash text-accent' : 'text-text-muted',
                    )}
                    key={option.value}
                    title={option.label}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                );
              })}
            </div>
          ) : (
            /* Cột dọc, mỗi lựa chọn có chữ cạnh icon: hàng ngang chỉ-icon không tên nhìn thấy và tràn mép phải 1440 (BUG-399). */
            <Radio.Group
              onChange={(value) => onChangeSwing(inspector.id, value as SwingOption['value'])}
              value={inspector.swing}
            >
              {SWING_OPTIONS.map((option) => {
                const Icon = option.icon;

                return (
                  <Radio.Item
                    key={option.value}
                    label={
                      <span className="flex items-center gap-1.5">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        {option.label}
                      </span>
                    }
                    value={option.value}
                  />
                );
              })}
            </Radio.Group>
          )}
        </FieldRow>
        )}

        <FieldRow isLast label={CONFIDENCE_LABEL}>
          {/* Bằng chữ như dòng danh sách, không phải số trần "0,26" (K10). */}
          <span className="flex h-9 items-center text-[14px] text-text-primary">{inspector.confidenceLabel}</span>
        </FieldRow>
      </div>
      </div>

      {!isViewerRole && (
        /* Nút xoá ghim đáy, tách xa nút duyệt ở đầu thẻ (G4a-27). */
        <div className="flex shrink-0 flex-col gap-2 border-t border-border-default bg-bg-surface px-5 py-3">
          <Button aria-keyshortcuts="Delete" fullWidth onClick={() => onDelete(inspector.id)} shortcut="Del" variant="secondary">
            {isSuggested ? REJECT_SUGGESTION_LABEL : isFurniture ? DELETE_FURNITURE_LABEL : DELETE_OPENING_LABEL}
          </Button>
        </div>
      )}
    </>
  );
}
