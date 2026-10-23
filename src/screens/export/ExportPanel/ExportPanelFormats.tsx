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

import type { ExportCapabilities, ExportFormatCard, ExportFormatId } from './types';

export const FOCUS_RING =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app';

/**
 * Vì sao thẻ PDF chưa tải về được, dù số trang trên nó là số thật.
 *
 * Xuất từ đây (một chuỗi, nên `allowConstantExport` của
 * `react-refresh/only-export-components` tha) để `ExportPanel.tsx` nói cùng một
 * câu ở chân trang mà không ai phải chép lại nó.
 */
export const PDF_BLOCKED_CAPTION =
  'Chưa xuất được PDF ở bản này, mới đếm được số trang. Hãy chọn mô hình 3D hoặc dữ liệu dự án.';

/** Vì sao thẻ ảnh chưa tải về được. */
export const IMAGE_BLOCKED_CAPTION =
  'Chưa xuất được ảnh từ màn này. Mở mô hình 3D để chụp ảnh, hoặc chọn mô hình 3D hoặc dữ liệu dự án.';

/**
 * Câu giải thích của một định dạng chưa sinh được tệp, hoặc `null` khi nó sinh
 * được.
 *
 * `.glb` và Spatial JSON có bộ xuất thật nên không bao giờ mang câu này.
 */
function blockedCaptionOf(id: ExportFormatId, capabilities: ExportCapabilities): string | null {
  if (id === 'pdf' && !capabilities.canRenderPdfBytes) {
    return PDF_BLOCKED_CAPTION;
  }

  if (id === 'image' && !capabilities.canCaptureImage) {
    return IMAGE_BLOCKED_CAPTION;
  }

  return null;
}

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
      className={cn('inline-block animate-pulse rounded-sm bg-border-default motion-reduce:animate-none', className)}
    />
  );
}

interface FormatCardProps {
  readonly format: ExportFormatCard;
  readonly isLoading: boolean;
  readonly blockedCaption: string | null;
  readonly onSelect: (id: ExportFormatId) => void;
}

function FormatCard({ format, isLoading, blockedCaption, onSelect }: FormatCardProps) {
  const Icon = FORMAT_ICONS[format.id];
  const isBlocked = blockedCaption !== null;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={format.isSelected}
      aria-disabled={isBlocked || undefined}
      // Roving tabindex: chỉ thẻ đang chọn nằm trong thứ tự Tab, mũi tên đi giữa các thẻ.
      tabIndex={format.isSelected ? 0 : -1}
      onClick={() => {
        // Định dạng chưa hỗ trợ không chọn được: chọn rồi mới biết không xuất được là bẫy.
        if (!isBlocked) {
          onSelect(format.id);
        }
      }}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors duration-standard',
        FOCUS_RING,
        format.isSelected
          ? 'border-accent bg-bg-selected'
          : isBlocked
            ? 'cursor-not-allowed border-border-default bg-bg-sunken'
            : 'border-border-default bg-bg-surface hover:bg-bg-hover',
      )}
    >
      {/* Dấu radio rõ: vòng tròn rỗng / chấm đặc, không chỉ dựa vào viền màu. */}
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
          format.isSelected ? 'border-accent' : 'border-border-control',
          isBlocked && 'opacity-50',
        )}
      >
        {format.isSelected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <Icon
        aria-hidden="true"
        size={20}
        strokeWidth={1.75}
        className={cn('mt-0.5 shrink-0', isBlocked ? 'text-text-muted' : 'text-text-secondary')}
      />

      <div className={cn('flex min-w-0 flex-col gap-1', isBlocked && 'opacity-70')}>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium text-text-primary">{format.extensionLabel}</span>
          {isBlocked && (
            <span className="rounded-sm bg-bg-app px-1.5 text-caption font-medium text-text-secondary">
              Chưa hỗ trợ
            </span>
          )}
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

        {blockedCaption !== null && <p className="text-xs text-state-attention-text">{blockedCaption}</p>}
      </div>
    </button>
  );
}

export interface ExportPanelFormatsProps {
  readonly formats: readonly ExportFormatCard[];
  readonly capabilities: ExportCapabilities;
  readonly isLoading: boolean;
  readonly onSelectFormat: (id: ExportFormatId) => void;
}

export function ExportPanelFormats({
  formats,
  capabilities,
  isLoading,
  onSelectFormat,
}: ExportPanelFormatsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Định dạng xuất"
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;

        if (step === 0 || formats.length === 0) {
          return;
        }

        event.preventDefault();
        const radios = event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
        const current = Array.from(radios).findIndex((radio) => radio === document.activeElement);
        // Mũi tên bỏ qua thẻ chưa hỗ trợ, như radio bị khoá.
        let next = Math.max(current, 0);
        for (let hop = 0; hop < formats.length; hop += 1) {
          next = (next + step + formats.length) % formats.length;
          const candidate = formats[next];
          if (candidate !== undefined && blockedCaptionOf(candidate.id, capabilities) === null) {
            break;
          }
        }
        const target = formats[next];

        if (target !== undefined && blockedCaptionOf(target.id, capabilities) === null) {
          onSelectFormat(target.id);
          radios[next]?.focus();
        }
      }}
    >
      {formats.map((format) => (
        <FormatCard
          key={format.id}
          format={format}
          isLoading={isLoading}
          blockedCaption={blockedCaptionOf(format.id, capabilities)}
          onSelect={onSelectFormat}
        />
      ))}
    </div>
  );
}
