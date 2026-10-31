/**
 * Hàng "Hướng mở" của panel thanh tra đối tượng: bốn radio biểu tượng (xem lý do
 * "bốn, không phải năm" ở đầu `ObjectLayerInspector.tsx`); vai Người xem thấy bản đọc-tĩnh.
 */

import { ArrowLeft, ArrowLeftRight, ArrowRight, Columns2 } from 'lucide-react';
import type { ComponentType } from 'react';

import { FieldRow } from '@/components/ui/FieldRow';
import { Radio } from '@/components/ui/Radio';
import { cn } from '@/lib/utils';

import type { OutlineIconProps } from './objectLayerSubtypeIcons';
import type { ObjectLayerInspectorProps } from './objectLayerTypes';

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

const SWING_LABEL = 'Hướng mở';

interface ObjectLayerSwingFieldProps {
  readonly inspector: NonNullable<ObjectLayerInspectorProps['inspector']>;
  readonly isViewerRole: boolean;
  readonly onChangeSwing: ObjectLayerInspectorProps['onChangeSwing'];
}

export function ObjectLayerSwingField({ inspector, isViewerRole, onChangeSwing }: ObjectLayerSwingFieldProps) {
  return (
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
  );
}
