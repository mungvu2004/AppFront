/**
 * The ordered list of property groups, geometry through the collapsed
 * "Thông số nâng cao" block.
 *
 * `COLLAPSIBLE_GROUP_ID` is the only group with a fold: the other four always
 * render every row they are given. U3 of `ui.md` maps the accordion's spec'd
 * 400ms onto `slow` (340ms) — the nearest rung on the five-value ladder rule B
 * allows — and that deviation is recorded once, here, rather than silently.
 */
import { ChevronDown } from 'lucide-react';

import { AnimatePresence, motion } from '@/components/motion';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { PropertyInspectorRow } from './PropertyInspectorRow';
import { COLLAPSIBLE_GROUP_ID, type PropertyGroup } from './propertyInspectorTypes';

function GroupRows({
  group,
  recentlyCommittedRowId,
}: {
  group: PropertyGroup;
  recentlyCommittedRowId: string | null;
}) {
  return (
    <>
      {group.rows.map((row, index) => (
        <PropertyInspectorRow
          key={row.id}
          row={row}
          groupId={group.id}
          isLast={index === group.rows.length - 1}
          isFlashing={row.id === recentlyCommittedRowId}
        />
      ))}
    </>
  );
}

function CollapsibleGroup({
  group,
  isFirst,
  recentlyCommittedRowId,
}: {
  group: PropertyGroup;
  isFirst: boolean;
  recentlyCommittedRowId: string | null;
}) {
  const isExpanded = group.isExpanded === true;

  return (
    <div className={cn('flex flex-col', !isFirst && 'mt-3 border-t border-border-default pt-3')}>
      <button
        type="button"
        onClick={group.onToggleExpanded}
        aria-expanded={isExpanded}
        className="flex items-center justify-between gap-2 py-1 text-[13px] font-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
      >
        {group.label}
        <ChevronDown
          aria-hidden="true"
          className={cn('h-4 w-4 transition-transform duration-fast', isExpanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: durationSeconds('slow') }}
            className="overflow-hidden"
          >
            <GroupRows group={group} recentlyCommittedRowId={recentlyCommittedRowId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface PropertyInspectorGroupsProps {
  readonly groups: readonly PropertyGroup[];
  /** Dòng vừa được ghi nhận — nháy nền `--accent-wash` đúng dòng đó, không cả nhóm. */
  readonly recentlyCommittedRowId?: string | null | undefined;
}

export function PropertyInspectorGroups({
  groups,
  recentlyCommittedRowId = null,
}: PropertyInspectorGroupsProps) {
  return (
    <div className="flex flex-col">
      {groups.map((group, index) => {
        if (group.id === COLLAPSIBLE_GROUP_ID) {
          return (
            <CollapsibleGroup
              key={group.id}
              group={group}
              isFirst={index === 0}
              recentlyCommittedRowId={recentlyCommittedRowId}
            />
          );
        }

        return (
          <div
            key={group.id}
            className={cn('flex flex-col', index > 0 && 'mt-3 border-t border-border-default pt-3')}
          >
            <p className="py-1 text-[13px] font-medium text-text-secondary">{group.label}</p>
            <GroupRows group={group} recentlyCommittedRowId={recentlyCommittedRowId} />
          </div>
        );
      })}
    </div>
  );
}
