/**
 * Cột trái của S-33: danh sách phiên bản, mới nhất trên cùng, hàng cao 48.
 *
 * Ba chấm màu diff dùng `DIFF_TONE_TOKENS` (types.ts) qua `style.backgroundColor` — CHẤM là
 * màu ĐẶC, không phải nền 8% (đó là việc của vùng so sánh). Lớp Tailwind alpha kiểu
 * "bg-state-verified slash 8" và "bg-opacity-10" biên dịch ra class chết trên Tailwind 3.4.6
 * của repo này (không alpha-value trong theme), nên mọi màu trạng thái ở đây đi qua `style`,
 * không qua className — xem docblock types.ts.
 */
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { AnimatePresence, motion } from '@/components/motion';
import { durationSeconds } from '@/lib/motion';

import { DIFF_TONE_TOKENS, type DiffTone, type VersionGroupModel, type VersionRowModel } from './types';

export interface VersionListProps {
  readonly groups: readonly VersionGroupModel[];
  readonly onToggleCompareSelection: (versionId: string) => void;
}

const DIFF_DOT_TONES: readonly DiffTone[] = ['added', 'removed', 'changed'];

function VersionDiffDots({ row }: { row: VersionRowModel }) {
  const counts = row.counts;
  const labelByTone: Readonly<Record<DiffTone, string>> = {
    added: counts.addedLabel,
    removed: counts.removedLabel,
    changed: counts.changedLabel,
  };

  return (
    <span className="flex items-center gap-2 tabular-nums text-[13px] text-text-secondary" aria-hidden="true">
      {DIFF_DOT_TONES.map((tone) => (
        <span key={tone} className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: DIFF_TONE_TOKENS[tone] }}
          />
          {labelByTone[tone]}
        </span>
      ))}
    </span>
  );
}

function VersionListRow({
  row,
  onToggleCompareSelection,
}: {
  readonly row: VersionRowModel;
  readonly onToggleCompareSelection: (versionId: string) => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: durationSeconds('fast') }}
      className="flex h-12 items-center gap-3 border-b border-border-default px-3"
    >
      <Checkbox
        checked={row.isSelectedForCompare}
        disabled={!row.isPickable}
        onChange={() => onToggleCompareSelection(row.id)}
        aria-label={`Chọn phiên bản ${row.label} để so sánh`}
      />
      <Avatar
        {...(row.avatarUrl !== null ? { src: row.avatarUrl } : {})}
        initials={row.authorInitials}
        alt={row.authorName}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium tabular-nums text-text-primary">{row.label}</span>
          {row.isCurrent && <Badge variant="verified">hiện tại</Badge>}
          {row.tagLabel !== null && <Badge variant="neutral">{row.tagLabel}</Badge>}
        </div>
        <p className="truncate text-[13px] text-text-secondary">{row.description}</p>
        {row.isMetadataOnly && row.retentionNotice !== null && (
          <p className="text-[12px] text-text-tertiary">{row.retentionNotice}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="text-[13px] text-text-secondary"
          title={row.absoluteTimeLabel}
        >
          {row.relativeTimeLabel}
        </span>
        <VersionDiffDots row={row} />
        <span className="sr-only">{row.counts.ariaLabel}</span>
      </div>
    </motion.li>
  );
}

export function VersionList({ groups, onToggleCompareSelection }: VersionListProps) {
  return (
    <nav aria-label="Danh sách phiên bản" className="flex h-full flex-col overflow-y-auto">
      {groups.map((group) => (
        <div key={group.id}>
          <h3 className="sticky top-0 bg-bg-surface px-3 py-1.5 text-[12px] font-medium text-text-tertiary">
            {group.heading}
          </h3>
          <ul>
            <AnimatePresence initial={false}>
              {group.rows.map((row) => (
                <VersionListRow key={row.id} row={row} onToggleCompareSelection={onToggleCompareSelection} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      ))}
    </nav>
  );
}
