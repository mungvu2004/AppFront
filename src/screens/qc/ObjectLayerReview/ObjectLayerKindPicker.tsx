/**
 * Ô chọn loại cạnh hộp nội thất vừa vẽ (wall-review-ux): vẽ xong là hỏi ngay "đây là gì?",
 * khỏi phải tìm ô loại ở panel phải. Dựng trên `ContextMenu.Root/Item` (cùng menu chuột phải
 * của bản vẽ). Esc hoặc bấm ra ngoài đóng ô, món giữ loại "khác"; "Khác…" mở ô loại đầy đủ.
 * View thuần: vị trí và ba hành động tới từ canvas/hook.
 */

import { useEffect } from 'react';

import { ContextMenu } from '@/components/canvas/ContextMenu';
import { useShortcut } from '@/hooks/useShortcut';

import { ObjectSubtypeIcon } from './objectLayerSubtypeIcons';
import type { ObjectLayerKindPickerModel, ObjectSubtype } from './objectLayerTypes';

type PickArgs = Parameters<ObjectLayerKindPickerModel['onPick']>;

/** Năm loại hay gặp nhất; còn lại nằm sau "Khác…" (ô loại ở panel phải). */
const KIND_CHOICES: readonly { label: string; subtype: ObjectSubtype; kind: PickArgs[0]; variant: PickArgs[1] }[] = [
  { label: 'Giường', subtype: 'bed', kind: 'bed', variant: null },
  { label: 'Sofa', subtype: 'sofa', kind: 'chair', variant: 'sofa' },
  { label: 'Bàn ăn', subtype: 'diningTable', kind: 'table', variant: null },
  { label: 'Bồn cầu', subtype: 'toilet', kind: 'sanitaryFixture', variant: 'wc' },
  { label: 'Lavabo', subtype: 'basin', kind: 'sanitaryFixture', variant: 'basin' },
];

export const KIND_PICKER_LABEL = 'Chọn loại đồ vật';
export const KIND_PICKER_MORE = 'Khác…';

/** Khe giữa hộp vừa vẽ và ô, pixel màn. */
const GAP_PX = 8;

/** Chỗ nhả chuột của lượt vẽ cuối và góc khung canvas, toạ độ màn (client). */
export interface KindPickerAnchor {
  /** Góc trên phải của hộp kéo (cú bấm: chính điểm bấm). */
  readonly pointer: { readonly x: number; readonly y: number };
  readonly frame: { readonly left: number; readonly top: number } | null;
}

export interface ObjectLayerKindPickerProps extends ObjectLayerKindPickerModel {
  readonly anchor: KindPickerAnchor;
  /** Hộp của món vừa vẽ, pixel KHUNG canvas; `null` thì neo theo điểm nhả chuột. */
  readonly boxRect: { readonly x: number; readonly y: number; readonly width: number } | null;
}

export function ObjectLayerKindPicker({ anchor, boxRect, onClose, onMore, onPick }: ObjectLayerKindPickerProps) {
  const position =
    boxRect === null || anchor.frame === null
      ? { x: anchor.pointer.x + GAP_PX, y: anchor.pointer.y }
      : { x: anchor.frame.left + boxRect.x + boxRect.width + GAP_PX, y: anchor.frame.top + boxRect.y };

  /* Esc là lớp trên cùng kể cả khi focus đã rời ô (cùng cách `useContextMenu`). */
  useShortcut({ id: 'objectKindPicker.close', combo: 'Escape', scope: 'dialog', preventDefault: false, onTrigger: onClose });

  /* Bấm ra ngoài thì đóng; gắn sau một khung hình để cú nhả chuột vừa vẽ không tự đóng ô. */
  useEffect(() => {
    const raf = requestAnimationFrame(() => window.addEventListener('click', onClose));

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('click', onClose);
    };
  }, [onClose]);

  return (
    <ContextMenu.Root isVisible onClose={onClose} position={position}>
      <p className="px-3 pb-1 pt-1.5 text-caption text-text-muted">{KIND_PICKER_LABEL}</p>
      {KIND_CHOICES.map((choice) => (
        <ContextMenu.Item
          icon={<ObjectSubtypeIcon className="h-4 w-4" subtype={choice.subtype} />}
          key={choice.subtype}
          onSelect={() => onPick(choice.kind, choice.variant)}
        >
          {choice.label}
        </ContextMenu.Item>
      ))}
      <ContextMenu.Separator />
      <ContextMenu.Item icon={<ObjectSubtypeIcon className="h-4 w-4" subtype="otherFurniture" />} onSelect={onMore}>
        {KIND_PICKER_MORE}
      </ContextMenu.Item>
    </ContextMenu.Root>
  );
}
