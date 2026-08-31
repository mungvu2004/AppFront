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
 * đổi nhãn cho khớp đối tượng. Không thêm nút xoá: `onDelete` chưa có phím
 * tắt nào giao cho T7 lẫn không được liệt trong đặc tả UI, nên để trống ở
 * đây — nếu T5/T8 định tuyến nó qua phím tắt thì không cần một view khác.
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
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/lib/utils';

import {
  OBJECT_SUBTYPES,
  OBJECT_SUBTYPE_LABELS,
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
};

/** Bốn hướng mở có radio riêng — xem lý do "bốn, không phải năm" ở đầu file. */
interface SwingOption {
  readonly value: 'left' | 'right' | 'double' | 'sliding';
  /** Nhãn tiếng Việt, viết thường kiểu câu (A6) — khớp `SWING_LABELS` của `lib/viewmodel/toViewModel.ts`. */
  readonly label: string;
  readonly icon: ComponentType<OutlineIconProps>;
}

const SWING_OPTIONS: readonly SwingOption[] = [
  { icon: ArrowLeft, label: 'mở trái', value: 'left' },
  { icon: ArrowRight, label: 'mở phải', value: 'right' },
  { icon: Columns2, label: 'hai cánh', value: 'double' },
  { icon: ArrowLeftRight, label: 'trượt', value: 'sliding' },
];

const TYPE_OPTIONS = OBJECT_SUBTYPES.map((subtype) => ({
  label: OBJECT_SUBTYPE_LABELS[subtype],
  value: subtype,
}));

const PANEL_TITLE = 'Đối tượng';
const TYPE_SELECT_LABEL = 'loại đối tượng';
const WIDTH_LABEL = 'chiều rộng';
const HEIGHT_LABEL = 'chiều cao';
const SILL_HEIGHT_LABEL = 'cao độ bệ cửa';
const HOST_WALL_LABEL = 'tường chứa nó';
const POSITION_LABEL = 'vị trí trên tường';
const SWING_LABEL = 'hướng mở';
const CONFIDENCE_LABEL = 'độ tin cậy';
const UNATTACHED_BADGE = 'Chưa gắn vào tường nào';
const ATTACH_NEAREST_LABEL = 'Gắn vào tường gần nhất';
const APPROVE_LABEL = 'Duyệt đối tượng này';
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
    <div className="flex h-full w-[344px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-bg-surface shadow-panel">
      <div className="flex h-14 shrink-0 items-center px-5">
        <h3 className="text-[16px] font-semibold text-text-primary">{PANEL_TITLE}</h3>
      </div>

      {inspector === null ? (
        <p className="px-5 text-[13px] text-text-secondary">{EMPTY_MESSAGE}</p>
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
  onSelectHostWall,
}: ObjectInspectorBodyProps) {
  const { hostWallId, hostWallLabel } = inspector;
  const CurrentTypeIcon = SUBTYPE_ICONS[inspector.subtype];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto pb-5">
      <p className="px-5 pb-4 font-mono text-[16px] text-text-primary">{inspector.codeLabel}</p>

      <div className="flex items-center gap-2 px-5 pb-4">
        <span
          aria-hidden="true"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-bg-sunken text-text-secondary"
        >
          <CurrentTypeIcon className="h-[18px] w-[18px]" />
        </span>

        {isViewerRole ? (
          <div className="flex h-[38px] flex-1 items-center px-3 text-[14px] text-text-primary">
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
              {OBJECT_SUBTYPES.map((subtype, index) => {
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
          ) : (
            hostWallId !== null &&
            hostWallLabel !== null && (
              <button
                className="flex h-9 items-center rounded font-mono text-[14px] text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                onClick={() => onSelectHostWall(hostWallId)}
                type="button"
              >
                {hostWallLabel}
              </button>
            )
          )}
        </FieldRow>

        {inspector.relativePosition !== null &&
          inspector.distanceToStartLabel !== null &&
          inspector.distanceToEndLabel !== null && (
            <FieldRow label={POSITION_LABEL}>
              {isViewerRole ? (
                <div className="flex h-9 items-center justify-between font-mono text-[13px] tabular-nums text-text-secondary">
                  <span>{inspector.distanceToStartLabel}</span>
                  <span>{inspector.distanceToEndLabel}</span>
                </div>
              ) : (
                <div className="flex h-9 items-center rounded-lg focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
                  <Slider
                    aria-label={POSITION_LABEL}
                    endLabels={[inspector.distanceToStartLabel, inspector.distanceToEndLabel]}
                    max={1}
                    min={0}
                    onChange={(value) => onDragPosition(inspector.id, value)}
                    step={0.01}
                    value={inspector.relativePosition}
                  />
                </div>
              )}
            </FieldRow>
          )}

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
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                );
              })}
            </div>
          ) : (
            <Radio.Group
              className="flex-row items-center gap-2"
              onChange={(value) => onChangeSwing(inspector.id, value as SwingOption['value'])}
              value={inspector.swing}
            >
              {SWING_OPTIONS.map((option) => {
                const Icon = option.icon;

                return (
                  <Radio.Item
                    aria-label={option.label}
                    key={option.value}
                    label={<Icon aria-hidden="true" className="h-4 w-4" />}
                    value={option.value}
                  />
                );
              })}
            </Radio.Group>
          )}
        </FieldRow>

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
        </div>
      )}
    </div>
  );
}
