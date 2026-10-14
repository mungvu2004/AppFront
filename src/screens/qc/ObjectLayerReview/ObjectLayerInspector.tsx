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
 * ## Hai biểu tượng tự vẽ: bồn cầu và chậu rửa
 *
 * `lucide-react` không có icon cho hai loại nội thất này (đã kiểm bằng
 * duyệt toàn bộ danh sách export). {@link ToiletIcon}/{@link BasinIcon} là
 * SVG viền nét tối giản, không tô đầy màu (CẤM TUYỆT ĐỐI), theo đúng khuôn
 * `stroke="currentColor" fill="none"` của mọi icon `lucide-react` khác dùng
 * trong file — không phải một component chung mới trong `src/components/**`.
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

import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Bed,
  Blinds,
  Box,
  Columns2,
  DoorOpen,
  Sofa,
  UtensilsCrossed,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { FieldRow } from '@/components/ui/FieldRow';
import { Radio } from '@/components/ui/Radio';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

import { ObjectLayerPositionField } from './ObjectLayerPositionField';
import {
  OBJECT_SUBTYPES,
  OBJECT_SUBTYPE_LABELS,
  OBJECT_SUBTYPE_LAYER,
  type ObjectLayerInspectorProps,
  type ObjectSubtype,
} from './objectLayerTypes';

interface OutlineIconProps {
  readonly className?: string | undefined;
}

/** Ký hiệu tự vẽ cho "bồn cầu" — viền nét, không tô đầy màu. */
function ToiletIcon({ className }: OutlineIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="5" rx="1" width="8" x="8" y="3" />
      <path d="M7 8h10" />
      <path d="M8 8c-1 3-1 7 0.5 10a4 4 0 0 0 7 0c1.5-3 1.5-7 0.5-10" />
    </svg>
  );
}

/** Ký hiệu tự vẽ cho "chậu rửa" — viền nét, không tô đầy màu. */
function BasinIcon({ className }: OutlineIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M11 3v4" />
      <path d="M8 5h6" />
      <path d="M3 11h18" />
      <path d="M4 11a8 4 0 0 0 16 0" />
      <path d="M9 15v2a3 3 0 0 0 3 3 3 3 0 0 0 3-3v-2" />
    </svg>
  );
}

/** Bảng tra icon theo loại con — viền nét, không tô đầy màu (CẤM TUYỆT ĐỐI). */
const SUBTYPE_ICONS: Readonly<Record<ObjectSubtype, ComponentType<OutlineIconProps>>> = {
  singleDoor: DoorOpen,
  doubleDoor: Columns2,
  window: Blinds,
  bed: Bed,
  sofa: Sofa,
  diningTable: UtensilsCrossed,
  toilet: ToiletIcon,
  basin: BasinIcon,
  otherFurniture: Box,
};

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
const WIDTH_LABEL = 'Chiều rộng';
const HEIGHT_LABEL = 'Chiều cao';
const SILL_HEIGHT_LABEL = 'Cao độ bệ cửa';
const HOST_WALL_LABEL = 'Tường chứa nó';
const SWING_LABEL = 'Hướng mở';
const CONFIDENCE_LABEL = 'Độ tin cậy';
const UNATTACHED_BADGE = 'Chưa gắn vào tường nào';
/** Nội thất không áp tường nào — chỗ đứng bình thường của nó, không phải việc phải làm (B-V6-13). */
const FREE_STANDING_LABEL = 'Đứng tự do';
const ATTACH_NEAREST_LABEL = 'Gắn vào tường gần nhất';
const APPROVE_LABEL = 'Duyệt đối tượng này';
const DELETE_LABEL = 'Xoá đối tượng';
const EMPTY_MESSAGE = 'Chọn một đối tượng trên bản vẽ hoặc trong danh sách để xem chi tiết.';

export function ObjectLayerInspector({
  inspector,
  isViewerRole,
  onChangeSubtype,
  onChangeSwing,
  onDragPosition,
  onDelete,
  onApprove,
  onAttachToNearestWall,
  onSelectHostWall,
}: ObjectLayerInspectorProps) {
  return (
    <div className="order-2 flex w-full shrink-0 flex-col overflow-hidden rounded-[12px] bg-bg-surface shadow-panel xl:order-none xl:h-full xl:w-[344px]">
      <div className="flex h-14 shrink-0 items-center px-5">
        <h3 className="text-[16px] font-semibold text-text-primary">{PANEL_TITLE}</h3>
      </div>

      {inspector === null ? (
        <p className="px-5 pb-5 text-[13px] text-text-secondary">{EMPTY_MESSAGE}</p>
      ) : (
        <ObjectInspectorBody
          inspector={inspector}
          isViewerRole={isViewerRole}
          onApprove={onApprove}
          onAttachToNearestWall={onAttachToNearestWall}
          onChangeSubtype={onChangeSubtype}
          onChangeSwing={onChangeSwing}
          onDelete={onDelete}
          onDragPosition={onDragPosition}
          onSelectHostWall={onSelectHostWall}
        />
      )}
    </div>
  );
}

type NonNullInspector = NonNullable<ObjectLayerInspectorProps['inspector']>;

interface ObjectInspectorBodyProps
  extends Omit<ObjectLayerInspectorProps, 'inspector'> {
  readonly inspector: NonNullInspector;
}

function ObjectInspectorBody({
  inspector,
  isViewerRole,
  onChangeSubtype,
  onChangeSwing,
  onDragPosition,
  onApprove,
  onAttachToNearestWall,
  onDelete,
  onSelectHostWall,
}: ObjectInspectorBodyProps) {
  const { hostWallId, hostWallLabel } = inspector;
  const CurrentTypeIcon = SUBTYPE_ICONS[inspector.subtype];
  const isFurniture = OBJECT_SUBTYPE_LAYER[inspector.subtype] === 'furniture'; // loại, hướng mở chỉ đọc (BUG-590)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto pb-5">
      <p className="px-5 pb-4 font-mono text-[16px] text-text-primary">{inspector.codeLabel}</p>

      <div className="flex items-center gap-2 px-5 pb-4">
        <span
          aria-hidden="true"
          className="flex h-[46px] w-[46px] sm:h-[38px] sm:w-[38px] shrink-0 items-center justify-center rounded-lg bg-bg-sunken text-text-secondary"
        >
          <CurrentTypeIcon className="h-[18px] w-[18px]" />
        </span>

        {isViewerRole || isFurniture ? (
          <div className="flex h-[46px] sm:h-[38px] flex-1 items-center px-3 text-[14px] text-text-primary">
            {OBJECT_SUBTYPE_LABELS[inspector.subtype]}
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
                const Icon = SUBTYPE_ICONS[subtype];

                return (
                  <Select.Item index={index} key={subtype} value={subtype}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
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
              className="flex h-9 items-center rounded font-mono text-[14px] text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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
          <span className="flex h-9 items-center">
            <ConfidenceMeter value={inspector.confidence} />
          </span>
        </FieldRow>
      </div>

      {!isViewerRole && (
        <div className="mt-auto flex flex-col gap-2 px-5 pt-4">
          <Button
            disabled={inspector.reviewed}
            fullWidth
            onClick={() => onApprove(inspector.id)}
            variant="primary"
          >
            {APPROVE_LABEL}
          </Button>
          <Button fullWidth onClick={() => onDelete(inspector.id)} variant="ghost">{DELETE_LABEL}</Button>
        </div>
      )}
    </div>
  );
}
