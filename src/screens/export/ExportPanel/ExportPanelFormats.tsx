/**
 * Cột trái — bốn thẻ định dạng, xếp dọc.
 *
 * Thẻ trắng có biểu tượng nét 20, không phải ô màu lớn (đặc tả bố cục). Bốn
 * thẻ hoạt động như một `radiogroup`: chỉ một định dạng được chọn tại một thời
 * điểm, và `onSelectFormat` là hành động duy nhất mỗi thẻ phát ra.
 *
 * `FOCUS_RING` và `SkeletonText` xuất từ đây vì đây là file anh em đầu tiên
 * của thư mục — các file khác trong `ExportPanel/` import lại thay vì định
 * nghĩa riêng, giống cách `RuleSettingsRow.tsx` giữ `FOCUS_RING` cho cả thư
 * mục `RuleSettings/`. `FORMAT_ICONS` không export: nó là một object, và
 * `react-refresh/only-export-components` chỉ tha hằng nguyên thuỷ
 * (`allowConstantExport`) cạnh một component — đúng lý do `RuleSettingsRow.tsx`
 * cũng không export `SEVERITY_LABELS`.
 */

import { Box, FileJson, FileText, Image as ImageIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ExportFormatCard, ExportFormatId } from './types';

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app';

const FORMAT_ICONS: Readonly<Record<ExportFormatId, LucideIcon>> = {
  glb: Box,
  pdf: FileText,
  image: ImageIcon,
  'spatial-json': FileJson,
};

/** Chỗ một con số đáng lẽ hiện ra, thay bằng khung xương lúc `status === 'loading'`. */
export function SkeletonText({ className }: { readonly className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block animate-pulse rounded bg-bg-sunken motion-reduce:animate-none', className)}
    />
  );
}

interface FormatCardProps {
  readonly format: ExportFormatCard;
  readonly isLoading: boolean;
  readonly onSelect: (id: ExportFormatId) => void;
}

function FormatCard({ format, isLoading, onSelect }: FormatCardProps) {
  const Icon = FORMAT_ICONS[format.id];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={format.isSelected}
      onClick={() => {
        onSelect(format.id);
      }}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors duration-standard',
        FOCUS_RING,
        format.isSelected
          ? 'border-accent bg-bg-selected'
          : 'border-border-default bg-bg-surface hover:bg-bg-hover',
      )}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-secondary" />

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-sm font-medium text-text-primary">{format.extensionLabel}</span>
          {format.pageCountLabel !== null &&
            (isLoading ? (
              <SkeletonText className="h-3 w-14" />
            ) : (
              <span className="text-xs text-text-secondary">{format.pageCountLabel}</span>
            ))}
        </div>

        <p className="text-sm text-text-secondary">{format.audienceSentence}</p>

        {format.sizeState === 'known' &&
          (isLoading ? (
            <SkeletonText className="h-3 w-16" />
          ) : (
            <p className="font-mono text-xs tabular-nums text-text-muted">{format.sizeLabel}</p>
          ))}
      </div>
    </button>
  );
}

export interface ExportPanelFormatsProps {
  readonly formats: readonly ExportFormatCard[];
  readonly isLoading: boolean;
  readonly onSelectFormat: (id: ExportFormatId) => void;
}

export function ExportPanelFormats({ formats, isLoading, onSelectFormat }: ExportPanelFormatsProps) {
  return (
    <div role="radiogroup" aria-label="định dạng xuất" className="flex flex-col gap-3">
      {formats.map((format) => (
        <FormatCard key={format.id} format={format} isLoading={isLoading} onSelect={onSelectFormat} />
      ))}
    </div>
  );
}
