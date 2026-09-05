/**
 * The property inspector panel — a pure function of `PropertyInspectorState`.
 *
 * Mục D: this file touches no store, no gateway, formats no number and picks
 * no colour outside a token — every string on screen either arrived already
 * written through props (A15) or is one of the handful of literal, static
 * chrome strings this view owns outright (button labels, the empty/loading/
 * forbidden copy that no state field carries). Those are recorded verbatim in
 * `view.i18n.fragment.json` for T4 to fold into `src/i18n/vi.json`.
 *
 * `usePropertyInspector` (T5) and `PropertyInspector.container.tsx` (a sibling
 * this file does not own) are the two places that may know where an object's
 * properties actually come from; this file is not one of them, which is what
 * `local/no-data-layer-in-view` (R-60) enforces on every import below.
 *
 * ## The seven states
 *
 * `state.kind` is a discriminated union (see `propertyInspectorTypes.ts`), and
 * this component switches on it directly rather than deriving a second set of
 * booleans — a state this file cannot represent is a state TypeScript refuses
 * to compile, not a branch somebody forgot to add.
 *
 * ## Fixed measures, not layout that reacts to data
 *
 * CẤM TUYỆT ĐỐI số 3: the panel is a fixed 344px regardless of object kind or
 * row count — `FieldRow`'s own 36px row height and 40/60 split do the rest.
 * The one place height legitimately changes — the "Thông số nâng cao"
 * accordion — animates through `PropertyInspectorGroups.tsx` on the `slow`
 * (340ms) rung of the motion ladder, and the content below a changed
 * selection cross-fades at `fast` (180ms) via the same `@/components/motion`
 * gate every other animated component in this codebase uses, so
 * `prefers-reduced-motion` is honoured without this file asking about it.
 *
 * U3 of `docs/contracts/property-inspector/ui.md` records two deviations from
 * the original spec, both because rule B allows only five durations and one
 * palette of tokens: the spec's 400ms accordion becomes 340ms (`slow`, the
 * nearest rung), and its `#EEF4EF` flash background becomes `--accent-wash`
 * (already applied by `FieldRow`'s own `flash` prop, an existing token).
 */
import { MousePointerClick } from 'lucide-react';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { AnimatePresence, motion } from '@/components/motion';
import { durationSeconds } from '@/lib/motion';

import { PropertyInspectorFooter } from './PropertyInspectorFooter';
import { PropertyInspectorGroups } from './PropertyInspectorGroups';
import { PropertyInspectorHeader } from './PropertyInspectorHeader';
import {
  DEFAULT_VISIBLE_FIELD_COUNT,
  PROPERTY_INSPECTOR_LAYOUT,
  type PropertyInspectorPanelContent,
  type PropertyInspectorProps,
} from './propertyInspectorTypes';

const REGION_LABEL = 'Thanh tra đối tượng';
const LOADING_LABEL = 'Đang tải thuộc tính…';
const FORBIDDEN_MESSAGE = 'Bạn đang xem ở vai chỉ xem nên không sửa được thuộc tính này.';
const COLLAPSED_CHIP_LABEL = 'Mở lại thanh tra đối tượng';
const COLLAPSED_SHEET_HINT = 'Kéo lên để xem thuộc tính';

const PANEL_CLASS = 'flex w-[344px] flex-col overflow-hidden rounded-xl bg-bg-surface';

const EXPAND_BUTTON_CLASS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

function PanelContent({
  content,
  forbidden = false,
}: {
  content: PropertyInspectorPanelContent;
  forbidden?: boolean;
}): ReactNode {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={content.header.objectCode}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: durationSeconds('fast') }}
        className="flex flex-col"
      >
        <PropertyInspectorHeader header={content.header} thumbnails={content.thumbnails} />
        {forbidden && (
          <p className="px-5 pb-3 text-[13px] leading-[18px] text-text-secondary">{FORBIDDEN_MESSAGE}</p>
        )}
        <div className="flex-1 px-5">
          <PropertyInspectorGroups groups={content.groups} />
        </div>
        <PropertyInspectorFooter footer={content.footer} />
      </motion.div>
    </AnimatePresence>
  );
}

function LoadingSkeleton(): ReactNode {
  return (
    <div className="flex flex-col gap-2 p-5">
      <span role="status" aria-live="polite" className="sr-only">
        {LOADING_LABEL}
      </span>
      {Array.from({ length: DEFAULT_VISIBLE_FIELD_COUNT }, (_, index) => (
        <div
          key={index}
          className="rounded bg-bg-sunken animate-pulse motion-reduce:animate-none"
          style={{ height: PROPERTY_INSPECTOR_LAYOUT.loadingSkeletonRowHeightPx }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function CollapsedChip({ summaryLabel, onExpand }: { summaryLabel: string; onExpand: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={`${COLLAPSED_CHIP_LABEL} — ${summaryLabel}`}
      className={`flex items-center gap-2 rounded-full bg-bg-surface px-3 py-2 text-[13px] font-medium text-text-primary shadow-float ${EXPAND_BUTTON_CLASS}`}
    >
      {summaryLabel}
    </button>
  );
}

function CollapsedSheet({ summaryLabel, onExpand }: { summaryLabel: string; onExpand: () => void }): ReactNode {
  return (
    <div
      className="fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 rounded-t-xl bg-bg-surface p-3 shadow-overlay"
      style={{ height: `${PROPERTY_INSPECTOR_LAYOUT.collapsedSheetHeightPercent}%` }}
    >
      <button type="button" onClick={onExpand} className={`flex flex-col items-center gap-2 ${EXPAND_BUTTON_CLASS}`}>
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border-default" />
        <span className="text-[13px] text-text-secondary">{COLLAPSED_SHEET_HINT}</span>
      </button>
      <span className="text-[14px] font-medium text-text-primary">{summaryLabel}</span>
    </div>
  );
}

/**
 * `test`, `props` → markup: `PropertyInspector.test.tsx` (a sibling this file
 * does not own) renders every one of the seven states through this component
 * directly, no store or gateway involved.
 */
export function PropertyInspector({ state }: PropertyInspectorProps): ReactNode {
  if (state.kind === 'collapsed') {
    return state.variant === 'chip' ? (
      <CollapsedChip summaryLabel={state.summaryLabel} onExpand={state.onExpand} />
    ) : (
      <CollapsedSheet summaryLabel={state.summaryLabel} onExpand={state.onExpand} />
    );
  }

  return (
    <section role="region" aria-label={REGION_LABEL} className={PANEL_CLASS}>
      {state.kind === 'empty' && (
        <EmptyState
          icon={<MousePointerClick />}
          title={state.message}
          description={state.tabHint}
          className="p-5"
        />
      )}

      {state.kind === 'loading' && <LoadingSkeleton />}

      {(state.kind === 'partial' || state.kind === 'success' || state.kind === 'error') && (
        <PanelContent content={state} />
      )}

      {state.kind === 'forbidden' && <PanelContent content={state} forbidden />}
    </section>
  );
}
