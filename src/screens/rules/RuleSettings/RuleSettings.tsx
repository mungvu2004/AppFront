/**
 * Màn cài đặt bộ luật không gian — hai cột, tối đa 960px.
 *
 * View thuần (mục D): mọi giá trị đến từ {@link RuleSettingsProps}, không store,
 * không mạng, không domain — `local/no-data-layer-in-view` (R-60) không có gì
 * để bắt ở đây. Toàn bộ tính toán (số luật, câu impact, hậu quả preset) đã xong
 * ở hook; file này chỉ vẽ.
 *
 * ## Không nút Lưu (A7)
 *
 * Hệ thống tự lưu 800 ms sau thao tác cuối; `SaveIndicator` nói trạng thái đó
 * ra cho trình đọc màn hình.
 *
 * ## Cả năm nhóm cùng nằm trên trang, thanh nav chỉ NHẢY TỚI mục
 *
 * Bản đầu vẽ mỗi lúc một nhóm và thay nhau theo nút nav đang chọn. Cách đó làm
 * 20 trên 25 luật KHÔNG tồn tại trong DOM ở mọi thời điểm, mà nguyên tắc của
 * chính màn này là cho người ta thấy cái gì tồn tại — đó là lý do một luật đã
 * tắt mờ xuống chứ không bị ẩn. Phân trang theo nhóm đánh mất đúng tính chất
 * ấy ở quy mô lớn hơn, nên năm thẻ nhóm cộng thẻ "ngưỡng chung" xếp chồng trên
 * một cột, và thanh bên trái là danh sách LIÊN KẾT tới từng mục.
 *
 * Liên kết thật (`<a href="#...">`) chứ không phải nút cuộn bằng tay: A12 nói
 * bàn phím là đường đi hạng nhất, và một cái neo đã có sẵn Tab, Enter, mở tab
 * mới và "quay lại" mà không cần một dòng mã nào giữ chúng.
 *
 * `activeSection` vì thế không còn quyết định *cái gì được vẽ* — nó chỉ nhớ mục
 * người dùng vừa nhảy tới, để `aria-current` nói ra chỗ đang đứng.
 *
 * ## Bảy trạng thái (A11)
 *
 * `collapsed` là mốc dưới 1024px do hook quyết định (khuôn `ProjectSettingsView`
 * dùng `state === 'collapsed'`) — view không tự đo viewport, chỉ đổi cách vẽ:
 * nav thành một `Select` nhảy tới mục ở ĐẦU trang, ô ngưỡng xuống dòng dưới tên
 * luật.
 */

import { useMemo, useState } from 'react';
import { AlertCircle, ClipboardList, Lock } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { SaveIndicator } from '@/components/feedback/SaveIndicator';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

import { RuleSettingsGeneralThresholdsCard, RuleSettingsGroupCard } from './RuleSettingsGroups';
import { RuleSettingsPresetsRow } from './RuleSettingsPresets';
import { type RuleCode, FOCUS_RING } from './RuleSettingsRow';
import type { RuleSettingsGroup, RuleSettingsProps } from './types';

/** Mục nav cho thẻ "Ngưỡng chung" — không phải mã nhóm luật thật. */
const GENERAL_SECTION_ID = 'general-thresholds';

/**
 * `id` thật của một mục trong DOM.
 *
 * Có tiền tố vì mã nhóm là những từ chung (`area`, `levels`) và một trang có
 * thể mang phần tử khác cùng tên; một cái neo trỏ nhầm chỗ là loại hỏng không
 * ai thấy cho tới lúc bấm.
 */
const sectionIdOf = (id: string): string => `rule-settings-${id}`;

/** Câu của từng luật, tra theo mã — để hàng có `supersededBy` nói rõ tên luật thay thế. */
function sentenceByCodeOf(groups: readonly RuleSettingsGroup[]): ReadonlyMap<RuleCode, string> {
  const map = new Map<RuleCode, string>();
  for (const group of groups) {
    for (const row of group.rows) {
      map.set(row.code, row.sentence);
    }
  }
  return map;
}

interface NavItem {
  readonly id: string;
  readonly label: string;
}

function navItemsOf(groups: readonly RuleSettingsGroup[]): readonly NavItem[] {
  return [
    ...groups.map((group) => ({ id: group.group, label: group.label })),
    { id: GENERAL_SECTION_ID, label: 'ngưỡng chung' },
  ];
}

/**
 * Đưa một mục vào khung nhìn và trao con trỏ bàn phím cho nó.
 *
 * `scrollIntoView` không tồn tại trong jsdom, nên gọi có điều kiện: thiếu bước
 * ấy thì mọi bài kiểm chạm vào ô `Select` đều ngã, và ngã ở một chỗ không liên
 * quan gì tới thứ nó đang kiểm.
 */
const goToSection = (id: string): void => {
  const node = document.getElementById(sectionIdOf(id));

  if (node === null) {
    return;
  }

  node.scrollIntoView?.({ block: 'start' });
  node.focus?.();
};

interface RuleSettingsNavProps {
  readonly items: readonly NavItem[];
  readonly activeId: string;
  readonly isCollapsed: boolean;
  readonly onSelect: (id: string) => void;
}

/**
 * Bộ điều hướng: danh sách LIÊN KẾT dọc; dưới 1024 đổi thành một ô `Select` ở
 * đầu trang. Cả hai đều nhảy tới mục — không mục nào bị gỡ khỏi trang.
 */
function RuleSettingsNav({ items, activeId, isCollapsed, onSelect }: RuleSettingsNavProps) {
  if (isCollapsed) {
    return (
      <Select
        label="mục cài đặt"
        value={activeId}
        options={items.map((item) => ({ value: item.id, label: item.label }))}
        onChange={(id) => {
          onSelect(id);
          goToSection(id);
        }}
      />
    );
  }

  return (
    <nav aria-label="mục cài đặt bộ luật" className="flex w-[220px] shrink-0 flex-col gap-1">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${sectionIdOf(item.id)}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => {
              onSelect(item.id);
            }}
            className={cn(
              'rounded px-3 py-2 text-left text-sm no-underline transition-colors duration-standard',
              FOCUS_RING,
              isActive
                ? 'bg-bg-selected font-medium text-accent'
                : 'text-text-secondary hover:bg-bg-hover',
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

interface RuleSettingsMainProps {
  readonly props: RuleSettingsProps;
  readonly activeSection: string;
  readonly onSelectSection: (id: string) => void;
  readonly sentenceByCode: ReadonlyMap<RuleCode, string>;
}

/** Nội dung của ba trạng thái có dữ liệu: `ready`, `partial`, `collapsed`. */
function RuleSettingsMain({ props, activeSection, onSelectSection, sentenceByCode }: RuleSettingsMainProps) {
  const { model, capabilities } = props;
  const isCollapsed = model.status === 'collapsed';
  const navItems = navItemsOf(model.groups);

  return (
    <div className="flex flex-col gap-6">
      {capabilities.readOnlyReason !== null && (
        <InlineAlert level="attention" message={capabilities.readOnlyReason} />
      )}

      {model.disableAllWarning !== null && (
        <InlineAlert level="violation" message={model.disableAllWarning} />
      )}

      {model.status === 'partial' && (
        <p className="text-xs text-text-secondary">Đang tải thêm dữ liệu bộ luật…</p>
      )}

      {capabilities.canApplyPreset && model.presets.length > 0 && (
        <RuleSettingsPresetsRow presets={model.presets} onApplyPreset={props.onApplyPreset} />
      )}

      <div className={cn('flex gap-6', isCollapsed ? 'flex-col' : 'flex-row items-start')}>
        <RuleSettingsNav
          items={navItems}
          activeId={activeSection}
          isCollapsed={isCollapsed}
          onSelect={onSelectSection}
        />

        {/* Cả năm nhóm cùng ở đây: một luật không hiện là một luật người dùng
            không biết là mình có. */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {model.groups.map((group) => (
            <RuleSettingsGroupCard
              key={group.group}
              sectionId={sectionIdOf(group.group)}
              group={group}
              canEdit={capabilities.canEditRules}
              isCollapsed={isCollapsed}
              sentenceByCode={sentenceByCode}
              onToggleGroup={props.onToggleGroup}
              onToggleRule={props.onToggleRule}
              onChangeSeverity={props.onChangeSeverity}
              onChangeThreshold={props.onChangeThreshold}
            />
          ))}

          <RuleSettingsGeneralThresholdsCard
            sectionId={sectionIdOf(GENERAL_SECTION_ID)}
            thresholds={model.generalThresholds}
            canEdit={capabilities.canEditRules}
            onChangeGeneralThreshold={props.onChangeGeneralThreshold}
          />
        </div>
      </div>
    </div>
  );
}

/** Màn cài đặt bộ luật như một hàm của props — test và story dựng thẳng cái này. */
export function RuleSettings(props: RuleSettingsProps) {
  const { model, capabilities } = props;

  const [activeSection, setActiveSection] = useState<string>(
    () => model.groups[0]?.group ?? GENERAL_SECTION_ID,
  );
  const sentenceByCode = useMemo(() => sentenceByCodeOf(model.groups), [model.groups]);
  const { text: enabledText } = useCountUp(model.enabledRuleCount, { format: { fractionDigits: 0 } });
  const { text: totalText } = useCountUp(model.totalRuleCount, { format: { fractionDigits: 0 } });

  const hasContent =
    model.status === 'ready' || model.status === 'partial' || model.status === 'collapsed';
  const showRestoreDefaults = hasContent && !model.isDefault && capabilities.canEditRules;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-app">
      <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-text-primary">cài đặt bộ luật không gian</h2>
            <p className="text-sm text-text-secondary">
              {enabledText}/{totalText} luật đang bật
            </p>
          </div>
          <SaveIndicator saveState={model.saveState} label={model.saveCaption} />
        </header>

        {model.status === 'loading' && <Skeleton preset="property-panel" />}

        {model.status === 'error' && (
          <EmptyState
            icon={<AlertCircle aria-hidden="true" />}
            title="không tải được cài đặt bộ luật"
            description={
              model.errorMessage ?? 'Đã có lỗi khi tải cấu hình bộ luật. Thử lại sau ít phút.'
            }
          />
        )}

        {model.status === 'empty' && (
          <EmptyState
            icon={<ClipboardList aria-hidden="true" />}
            title="chưa có bộ luật để cài đặt"
            description="Chưa có luật không gian nào được nạp cho dự án này."
          />
        )}

        {model.status === 'forbidden' && (
          <EmptyState
            icon={<Lock aria-hidden="true" />}
            title="không có quyền xem cài đặt bộ luật"
            description={
              capabilities.readOnlyReason ?? 'Chỉ người có quyền quản trị dự án mới xem được mục này.'
            }
          />
        )}

        {hasContent && (
          <RuleSettingsMain
            props={props}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            sentenceByCode={sentenceByCode}
          />
        )}
      </div>

      {showRestoreDefaults && (
        <footer className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border-default bg-bg-surface px-6 py-3">
          <p className="text-sm text-text-secondary">Cấu hình đã khác mặc định.</p>
          <Button variant="secondary" onClick={props.onRestoreDefaults}>
            khôi phục mặc định
          </Button>
        </footer>
      )}
    </div>
  );
}
