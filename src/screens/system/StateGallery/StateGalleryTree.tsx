/**
 * S-47 — cột trái rộng 280: cây 47 màn xếp theo tám nhóm A → H.
 *
 * Mỗi màn hiện số trạng thái đã có dạng "7/7". Màn thiếu hiện "5/7" VÀ nói rõ
 * thiếu trạng thái nào — con số một mình chỉ báo có chuyện, nó không nói phải
 * viết story nào, nên danh sách thiếu đi kèm ngay dưới chứ không nằm ở chỗ khác.
 *
 * View không tự lọc: `screens` đã được hook lọc và sắp sẵn (hợp đồng
 * `StateGalleryProps`). Việc duy nhất ở đây là XẾP NHÓM để vẽ, vì `groups` đến
 * rời khỏi `screens`.
 *
 * Huy hiệu số đếm KHÔNG dùng xanh "đã xác minh": A5 giữ màu đó cho việc người
 * duyệt làm, còn con số này do manifest dẫn ra. Đủ bảy thì trung tính, thiếu thì
 * màu "cần chú ý".
 */
import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

import type { GalleryScreenEntry, ScreenCoverage, ScreenGroup } from './stateGalleryTypes';

const TREE_NAV_LABEL = 'cây màn theo nhóm';
const SEARCH_LABEL = 'tìm màn';
const SEARCH_PLACEHOLDER = 'nhập tên màn cần tìm';
const TREE_NO_MATCH = 'không có màn nào khớp với từ đang tìm';
const GROUP_PREFIX = 'nhóm';
const RATIO_PREFIX = 'đã có';
const MISSING_PREFIX = 'còn thiếu';
const COMPLETE_HINT = 'đủ bảy trạng thái';
const MISSING_SEPARATOR = ', ';

interface StateGalleryTreeProps {
  readonly groups: readonly ScreenGroup[];
  readonly screens: readonly GalleryScreenEntry[];
  readonly coverageByScreen: Readonly<Record<string, ScreenCoverage>>;
  readonly selectedScreenId: string | null;
  readonly searchText: string;
  readonly onSelectScreen: (screenId: string) => void;
  readonly onSearchTextChange: (value: string) => void;
}

interface ScreenRowProps {
  readonly screen: GalleryScreenEntry;
  readonly coverage: ScreenCoverage | undefined;
  readonly isSelected: boolean;
  readonly onSelectScreen: (screenId: string) => void;
}

function ScreenRow({ screen, coverage, isSelected, onSelectScreen }: ScreenRowProps) {
  const missingLabels = coverage === undefined ? [] : coverage.missingLabels;
  const isComplete = missingLabels.length === 0;

  return (
    <li>
      <button
        aria-current={isSelected ? 'true' : undefined}
        className={[
          'flex w-full flex-col gap-1 rounded-[6px] px-2 py-1.5 text-left',
          'transition-colors duration-120 hover:bg-bg-hover',
          'outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
          isSelected ? 'bg-bg-selected' : 'bg-transparent',
        ].join(' ')}
        onClick={() => {
          onSelectScreen(screen.id);
        }}
        type="button"
      >
        <span className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] leading-[20px] text-text-primary">
            {screen.label}
          </span>
          <Badge noDot variant={isComplete ? 'neutral' : 'attention'}>
            <span className="sr-only">{RATIO_PREFIX} </span>
            {coverage === undefined ? null : `${coverage.presentCount}/${coverage.totalCount}`}
          </Badge>
        </span>
        {isComplete ? (
          <span className="sr-only">{COMPLETE_HINT}</span>
        ) : (
          <span className="text-[13px] leading-[18px] text-state-attention-text">
            {MISSING_PREFIX}: {missingLabels.join(MISSING_SEPARATOR)}
          </span>
        )}
      </button>
    </li>
  );
}

export function StateGalleryTree({
  groups,
  screens,
  coverageByScreen,
  selectedScreenId,
  searchText,
  onSelectScreen,
  onSearchTextChange,
}: StateGalleryTreeProps) {
  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col gap-3 border-r border-border-default bg-bg-surface p-3">
      <Input
        label={SEARCH_LABEL}
        onChange={(event) => {
          onSearchTextChange(event.target.value);
        }}
        placeholder={SEARCH_PLACEHOLDER}
        prefix={<Search aria-hidden="true" size={16} strokeWidth={2} />}
        type="search"
        value={searchText}
      />

      <nav aria-label={TREE_NAV_LABEL} className="min-h-0 flex-1 overflow-y-auto">
        {screens.length === 0 ? (
          <p className="px-2 py-1.5 text-[14px] leading-[20px] text-text-secondary">{TREE_NO_MATCH}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((group) => {
              const groupScreens = screens.filter((screen) => screen.group === group.id);

              if (groupScreens.length === 0) {
                return null;
              }

              return (
                <li key={group.id}>
                  <h3 className="px-2 pb-1 text-[13px] font-semibold leading-[18px] text-text-muted">
                    {GROUP_PREFIX} {group.id}
                    <span aria-hidden="true"> · </span>
                    {group.label}
                  </h3>
                  <ul className="flex flex-col">
                    {groupScreens.map((screen) => (
                      <ScreenRow
                        coverage={coverageByScreen[screen.id]}
                        isSelected={screen.id === selectedScreenId}
                        key={screen.id}
                        onSelectScreen={onSelectScreen}
                        screen={screen}
                      />
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
