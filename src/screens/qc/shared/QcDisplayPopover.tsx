import { ChevronDown, Layers } from 'lucide-react';
import { useRef, useState } from 'react';

import { Popover } from '@/components/overlay/Popover';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/utils';

/**
 * Nút "Hiển thị ▾" ở góc trên phải bản vẽ (bố cục L23, đợt 1): gom mọi công tắc lớp của bước
 * vào MỘT popover, thay cho các ô "Hiện lớp …" rải ở cột trái hay dãy nút đáy bản vẽ.
 * Màn truyền nhóm và công tắc đã có sẵn; popover không tự giữ trạng thái lớp.
 */
export interface QcDisplayToggle {
  readonly key: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onToggle: () => void;
}

export interface QcDisplayGroup {
  readonly title: string;
  readonly items: readonly QcDisplayToggle[];
}

export interface QcDisplayPopoverProps {
  readonly groups: readonly QcDisplayGroup[];
}

const BUTTON_LABEL = 'Hiển thị';
const POPOVER_LABEL = 'Hiển thị trên bản vẽ';

export function QcDisplayPopover({ groups }: QcDisplayPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const visible = groups.filter((group) => group.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={anchorRef}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg bg-bg-surface px-3 text-body-sm font-medium text-text-primary shadow-float',
          'hover:bg-bg-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent',
        )}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <Layers aria-hidden="true" className="h-4 w-4" />
        {BUTTON_LABEL}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-text-muted" />
      </button>
      <Popover anchorRef={anchorRef} aria-label={POPOVER_LABEL} isOpen={isOpen} onClose={() => setIsOpen(false)} width={280}>
        <div className="flex flex-col gap-3 p-4">
          {visible.map((group) => (
            <fieldset key={group.title} className="flex flex-col gap-1.5">
              <legend className="mb-1 text-caption font-medium uppercase tracking-[0.06em] text-text-muted">{group.title}</legend>
              {group.items.map((item) => (
                <Checkbox
                  key={item.key}
                  aria-label={item.label}
                  checked={item.checked}
                  label={item.label}
                  onChange={item.onToggle}
                  size="sm"
                />
              ))}
            </fieldset>
          ))}
        </div>
      </Popover>
    </>
  );
}
