/**
 * Vùng so sánh của S-33 — hai ô chọn phiên bản, ba số đếm, dải tab, ba panel.
 *
 * VIEW THUẦN: nhận đúng `{ model, actions }`, không chạm store và không chạm mạng (mục D,
 * R-60). Mọi câu chữ và mọi con số đã định dạng đều đến từ `CompareModel`; ở đây không có
 * phép quy đổi đơn vị nào và không có câu nào được ghép tại chỗ (A15, R-61).
 *
 * ## Vì sao ba panel do file này tự dựng thay vì dùng `Tabs.Panel`
 *
 * `Tabs.Panel` (`Tabs.tsx:174-204`) bọc nội dung trong `AnimatePresence` với điều kiện
 * `activeId === id &&`, nên panel không hoạt động bị GỠ KHỎI DOM — và `scrollTop` của nó
 * chết theo. Đặc tả đòi đổi tab giữ nguyên vị trí cuộn, còn R-68 cấm sửa `src/components`.
 * Nên: `Tabs.Root` + `Tabs.Tab` giữ nguyên vai trò dải tab (tiêu điểm, phím mũi tên, gạch
 * chỉ báo), còn ba panel nằm trong DOM cùng lúc và panel không hoạt động mang thuộc tính
 * `hidden`. Mỗi panel là vùng cuộn của chính nó, nên nó tự giữ `scrollTop` — không cần một
 * dòng trạng thái nào ghi nhớ hộ.
 *
 * `Tabs.Tab` trải `...props` SAU khi đặt `aria-controls`, nên `aria-controls` truyền vào đây
 * đè lên được và trỏ đúng panel thật; ngược lại `id` DOM của tab do `Tabs` tự sinh và không
 * đọc ra được, nên panel dùng `aria-label` thay cho `aria-labelledby`.
 */

import { useCallback, useId } from 'react';

import { motion } from '@/components/motion';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { useCountUp } from '@/hooks/useCountUp';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { VersionDiffGroups } from './VersionDiffGroups';
import { VersionJsonDiff } from './VersionJsonDiff';
import { VersionVisualDiff } from './VersionVisualDiff';
import { DIFF_TONE_TOKENS } from './types';
import type {
  CompareModel,
  CompareTabId,
  DiffCountsModel,
  DiffTone,
  VersionHistoryActions,
  VersionHistoryOption,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt tĩnh — khớp `compare.vi.json.fragment`.                     */
/* -------------------------------------------------------------------------- */

const LEFT_SELECT_LABEL = 'Phiên bản gốc';
const RIGHT_SELECT_LABEL = 'Phiên bản đối chiếu';
const SELECT_PLACEHOLDER = 'Chọn phiên bản';
const TABS_LABEL = 'Cách xem khác biệt';
const COMPARE_LABEL = 'Vùng so sánh hai phiên bản';

/* -------------------------------------------------------------------------- */
/* Hằng bố cục — không phải hằng nghiệp vụ (R-71).                             */
/* -------------------------------------------------------------------------- */

/** Ba số đếm là số nguyên: không có "một nửa đối tượng đã đổi". */
const COUNT_FORMAT = { fractionDigits: 0 };

/** Vùng so sánh mờ đi trong lúc tính lại cặp mới, rồi hoà tan trở lại trong 180 ms. */
const RECOMPUTING_OPACITY = 0.4;

/** Đúng ba tab, đúng thứ tự: tiếng thường trước, JSON thô sau, trực quan cuối. */
const TAB_IDS: readonly CompareTabId[] = ['changes', 'json', 'visual'];

/** Đưa một id tab từ `Tabs` về đúng liên hợp của hợp đồng, không dùng phép ép kiểu. */
function toTabId(id: string): CompareTabId | null {
  return TAB_IDS.find((candidate) => candidate === id) ?? null;
}

function toSelectOptions(options: readonly VersionHistoryOption[]) {
  return options.map((option) => ({ value: option.id, label: option.label }));
}

/* -------------------------------------------------------------------------- */
/* Ba số đếm.                                                                  */
/* -------------------------------------------------------------------------- */

interface CountChipProps {
  readonly tone: DiffTone;
  readonly value: number;
  /** "+14" · "−3" · "~8" — dạng cuối cùng, do viewmodel định dạng (A15). */
  readonly label: string;
}

/**
 * Một con số chạy.
 *
 * Chấm màu và con số đều `aria-hidden`: ba chấm màu không đọc được thành lời, nên cả cụm nói
 * bằng đúng một câu — `counts.ariaLabel` — ở ngay dưới. Cùng khuôn `ThicknessSummary.tsx:40`.
 *
 * Trong lúc chạy, con số hiện dạng trần; chạy xong nó về đúng nhãn của viewmodel, thứ mang cả
 * dấu "+", "−", "~". View không tự ghép dấu vào số.
 */
function CountChip({ tone, value, label }: CountChipProps) {
  const { text, done } = useCountUp(value, { format: COUNT_FORMAT });

  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: DIFF_TONE_TOKENS[tone] }}
      />
      <span className="font-mono text-[14px] tabular-nums text-text-primary">
        {done ? label : text}
      </span>
    </span>
  );
}

function CompareCounts({ counts }: { readonly counts: DiffCountsModel }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-4">
        <CountChip tone="added" value={counts.added} label={counts.addedLabel} />
        <CountChip tone="removed" value={counts.removed} label={counts.removedLabel} />
        <CountChip tone="changed" value={counts.changed} label={counts.changedLabel} />
      </div>
      <p className="sr-only" role="status">
        {counts.ariaLabel}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Vùng so sánh.                                                               */
/* -------------------------------------------------------------------------- */

export interface VersionCompareProps {
  readonly model: CompareModel;
  readonly actions: Pick<
    VersionHistoryActions,
    'selectLeftVersion' | 'selectRightVersion' | 'setTab' | 'hoverDiffRow'
  >;
}

export function VersionCompare({ model, actions }: VersionCompareProps) {
  const panelPrefix = useId();
  const { setTab } = actions;

  const handleTabChange = useCallback(
    (id: string): void => {
      const next = toTabId(id);

      if (next !== null) {
        setTab(next);
      }
    },
    [setTab],
  );

  const panelDomId = (tabId: string): string => 'vh-compare-panel-' + panelPrefix + '-' + tabId;

  const panelOf = (tabId: CompareTabId) => {
    if (tabId === 'changes') {
      return <VersionDiffGroups groups={model.groups} onHoverRow={actions.hoverDiffRow} />;
    }

    if (tabId === 'json') {
      return <VersionJsonDiff lines={model.jsonLines} />;
    }

    return <VersionVisualDiff visual={model.visual} />;
  };

  /*
   * Trạng thái 1 — chỉ có một phiên bản. Một câu dạy việc, không phải lỗi: không có ô chọn
   * nào để bấm và không có tab nào để mở, nên cả hai rời khỏi DOM thay vì đứng đó bị tắt.
   */
  if (model.teachingSentence !== null) {
    return (
      <div className="rounded-lg border border-border-default bg-bg-surface p-6">
        <p className="text-[14px] leading-relaxed text-text-secondary">{model.teachingSentence}</p>
      </div>
    );
  }

  return (
    <section aria-label={COMPARE_LABEL} className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label={LEFT_SELECT_LABEL}
          placeholder={SELECT_PLACEHOLDER}
          options={toSelectOptions(model.leftOptions)}
          {...(model.leftVersionId === null ? {} : { value: model.leftVersionId })}
          onChange={actions.selectLeftVersion}
          className="min-w-[180px]"
        />
        <Select
          label={RIGHT_SELECT_LABEL}
          placeholder={SELECT_PLACEHOLDER}
          options={toSelectOptions(model.rightOptions)}
          {...(model.rightVersionId === null ? {} : { value: model.rightVersionId })}
          onChange={actions.selectRightVersion}
          className="min-w-[180px]"
        />
        <div className="ml-auto">
          <CompareCounts counts={model.totals} />
        </div>
      </div>

      <Tabs.Root activeId={model.activeTab} onChange={handleTabChange}>
        <Tabs.List aria-label={TABS_LABEL}>
          {model.tabs.map((tab) => (
            <Tabs.Tab key={tab.id} id={tab.id} aria-controls={panelDomId(tab.id)}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.Root>

      {/* Hoà tan 180 ms khi đổi cặp phiên bản; ba panel BÊN TRONG không bị gắn lại. */}
      <motion.div
        className="flex min-h-0 flex-1 flex-col"
        animate={{ opacity: model.isRecomputing ? RECOMPUTING_OPACITY : 1 }}
        transition={{ duration: durationSeconds('fast') }}
      >
        {model.tabs.map((tab) => {
          const tabId = toTabId(tab.id);

          if (tabId === null) {
            return null;
          }

          return (
            <div
              key={tab.id}
              id={panelDomId(tab.id)}
              role="tabpanel"
              aria-label={tab.label}
              tabIndex={0}
              hidden={tabId !== model.activeTab}
              className={cn(
                'min-h-0 flex-1 overflow-y-auto rounded-lg pt-4',
                'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              )}
            >
              {panelOf(tabId)}
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}
