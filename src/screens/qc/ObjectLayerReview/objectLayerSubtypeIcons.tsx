/** Icon viền nét theo loại con của đối tượng (tách từ `ObjectLayerInspector.tsx`, trần 400 dòng). */

import { Bed, Blinds, Box, Columns2, DoorOpen, Sofa, UtensilsCrossed } from 'lucide-react';
import type { ComponentType } from 'react';

import type { ObjectSubtype } from './objectLayerTypes';

export interface OutlineIconProps {
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

/** Icon của một loại con — file chỉ xuất component để Fast Refresh giữ được trạng thái. */
export function ObjectSubtypeIcon({ subtype, className }: { readonly subtype: ObjectSubtype } & OutlineIconProps) {
  const Icon = SUBTYPE_ICONS[subtype];

  return <Icon className={className} />;
}
