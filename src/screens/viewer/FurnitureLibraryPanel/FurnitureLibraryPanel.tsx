/**
 * Panel thư viện nội thất bên trái Viewer3D — một hàm thuần của
 * `FurnitureLibraryPanelState`.
 *
 * Mục D và R-60: file này không chạm store, không chạm mạng, không định dạng
 * một con số nào và không chọn một màu nào ngoài token. Mọi chuỗi trên màn hoặc
 * đã được `useFurnitureLibraryPanel` ghép sẵn rồi đi vào bằng props (A15), hoặc
 * là một trong dăm chuỗi khung tĩnh mà chính view này sở hữu — và những chuỗi
 * ấy nằm ở `vi.view.fragment.json` bên cạnh, để lượt tích hợp gộp vào
 * `src/i18n/vi.json`, cuốn từ điển `expectVietnamese` đọc (R-67).
 *
 * ## Bảy trạng thái
 *
 * `state.kind` là discriminated union (`furnitureLibraryPanelTypes.ts` — hợp
 * đồng cứng, file này KHÔNG sở hữu nó), và view rẽ thẳng theo `kind` chứ không
 * suy ra một bộ cờ boolean thứ hai. Không nhánh nào vẽ ra màn trắng: đó là thất
 * bại duy nhất A11 tồn tại để chặn.
 *
 * ## Bề rộng cố định, và cái ngưỡng đổi hình
 *
 * Panel rộng đúng `panelWidthPx`. Dưới `collapsedBreakpointPx` nó đổi hẳn thành
 * tấm trượt đáy cao `collapsedSheetHeightPx` — hai số ấy đi vào CSS qua hai
 * custom property đặt trên chính phần tử gốc, vì một media query không đọc được
 * `style` nội tuyến: viết `style={{ width: panelWidthPx }}` thì `max-lg:w-full`
 * không bao giờ thắng. Cả hai số đọc từ `FURNITURE_LIBRARY_PANEL_LAYOUT`, không
 * có 280 hay 240 nào viết tay (R-71).
 *
 * ## Chuyển động
 *
 * Bốn nhịp, tất cả qua cửa `@/components/motion` hoặc qua thang thời lượng của
 * `@/lib/motion` (R-39, mục B):
 *
 * - lọc lưới: `layout` của framer trên nhịp `standard` (260 ms), ở
 *   `FurnitureLibraryPanelCard.tsx`;
 * - thẻ vào lưới: `delayMs`/`durationMs` ĐÃ TÍNH SẴN trong props — hook gọi
 *   `staggerSchedule`, view chỉ đọc;
 * - ảnh xem trước xoay 30° khi trỏ vào: nhịp `AMBIENT_LOOP_MS` (700 ms);
 * - nháy `bg-selected`: nhịp `slow` (340 ms).
 *
 * Nhịp thứ tư có một chỗ hở đáng nói thẳng ra: hợp đồng props không mang trường
 * nào cho biết thẻ nào vừa được đánh dấu, nên view không thể biết điều đó từ
 * bên ngoài. Nó được vẽ bằng `active:bg-bg-selected` trên chính thẻ — nghĩa là
 * cú nháy chạy đúng lúc người dùng đánh dấu một mô hình, trên đúng nhịp `slow`,
 * mà không cần thêm một trường vào hợp đồng T5 đang dựng theo.
 *
 * Giảm chuyển động không cần API riêng: `MotionProvider` đặt
 * `reducedMotion="user"` một lần cho toàn ứng dụng, hook trả `delayMs`/
 * `durationMs` bằng 0, và mọi lớp CSS ở đây đều có cặp `motion-reduce:`.
 */
import { PackageOpen, SearchX, ServerCrash, Upload } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { AnimatePresence } from '@/components/motion';
import { Button } from '@/components/ui/Button';

import {
  FurnitureLibrarySkeletonGrid,
  FurnitureModelCardTile,
} from './FurnitureLibraryPanelCard';
import {
  FurnitureCategoryChipRow,
  FurnitureDetectedGroups,
  FurnitureLibrarySearchBox,
} from './FurnitureLibraryPanelFilters';
import { FurnitureReplaceAllDialog } from './FurnitureLibraryPanelReplaceAll';
import {
  FURNITURE_LIBRARY_PANEL_LAYOUT,
  type FurnitureLibraryPanelContent,
  type FurnitureLibraryPanelEmptyState,
  type FurnitureLibraryPanelProps,
} from './furnitureLibraryPanelTypes';

const REGION_LABEL = 'Thư viện nội thất';
const GRID_LABEL = 'Lưới mô hình nội thất';
const UPLOAD_LABEL = 'Tải lên mô hình';
const FORBIDDEN_NOTE = 'Bạn đang xem ở vai chỉ xem nên không kéo mô hình vào bản vẽ được.';

const NO_MATCH_TITLE = 'Không có mô hình nào khớp';
/** Chỗ chèn `{{query}}` theo đúng quy ước nội suy của `src/i18n/vi.json`. */
const NO_MATCH_DESCRIPTION = 'Không tìm thấy mô hình nào cho “{{query}}”.';
const NO_MATCH_DESCRIPTION_PLAIN = 'Không tìm thấy mô hình nào khớp bộ lọc đang bật.';
const CLEAR_FILTERS_LABEL = 'Xoá bộ lọc';

const LIBRARY_EMPTY_TITLE = 'Thư viện chưa có mô hình nào';
const LIBRARY_EMPTY_DESCRIPTION =
  'Chưa có mô hình nội thất nào trong thư viện của dự án này để chèn vào bản vẽ.';

const ERROR_TITLE = 'Không tải được thư viện nội thất';
const RETRY_LABEL = 'Thử lại';

const { collapsedSheetHeightPx, gridColumns, gridGapPx, panelWidthPx } =
  FURNITURE_LIBRARY_PANEL_LAYOUT;

/**
 * Hai số đo của mục 4 đi vào CSS bằng custom property, chứ không bằng bề rộng
 * nội tuyến — xem docblock ở đầu file.
 */
const PANEL_VARIABLES = {
  '--flp-panel-width': `${panelWidthPx}px`,
  '--flp-sheet-height': `${collapsedSheetHeightPx}px`,
} as CSSProperties;

const PANEL_BASE_CLASS = 'flex min-h-0 flex-col overflow-hidden bg-bg-surface';

/** Panel trái cố định; dưới `collapsedBreakpointPx` (lg) thành tấm trượt đáy. */
const PANEL_CLASS =
  `${PANEL_BASE_CLASS} h-full w-[var(--flp-panel-width)] ` +
  'max-lg:h-[var(--flp-sheet-height)] max-lg:w-full';

/** Biến thể `collapsed`: luôn là tấm trượt đáy, bất kể bề rộng khung nhìn. */
const COLLAPSED_PANEL_CLASS =
  `${PANEL_BASE_CLASS} fixed inset-x-0 bottom-0 h-[var(--flp-sheet-height)] w-full ` +
  'rounded-t-xl shadow-overlay';

const GRID_STYLE: CSSProperties = {
  gap: gridGapPx,
  gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
};

const ROW_STYLE: CSSProperties = { gap: gridGapPx };

function EmptyBranch({ state }: { state: FurnitureLibraryPanelEmptyState }): ReactNode {
  if (state.variant === 'library-empty') {
    return (
      <EmptyState
        icon={<PackageOpen />}
        title={LIBRARY_EMPTY_TITLE}
        description={LIBRARY_EMPTY_DESCRIPTION}
        className="p-4"
      />
    );
  }

  const description =
    state.searchedFor === ''
      ? NO_MATCH_DESCRIPTION_PLAIN
      : NO_MATCH_DESCRIPTION.replace('{{query}}', state.searchedFor);

  return (
    <EmptyState
      icon={<SearchX />}
      title={NO_MATCH_TITLE}
      description={description}
      className="p-4"
      {...(state.onClearFilters === undefined
        ? {}
        : {
            action: {
              label: CLEAR_FILTERS_LABEL,
              onClick: state.onClearFilters,
              variant: 'secondary' as const,
            },
          })}
    />
  );
}

/**
 * Thân panel cho bốn nhánh có nội dung: `partial`, `success`, `forbidden`,
 * `collapsed`. Bốn nhánh ấy khác nhau đúng hai chỗ — có bị khoá hết hay không,
 * và lưới hai cột hay một hàng cuộn ngang — nên chúng dùng chung một thân.
 */
function PanelContent({
  content,
  isCollapsed = false,
  forbidden = false,
}: {
  content: FurnitureLibraryPanelContent;
  isCollapsed?: boolean;
  forbidden?: boolean;
}): ReactNode {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <FurnitureLibrarySearchBox
          value={content.searchQuery}
          onChange={content.onSearchQueryChange}
        />
        <FurnitureCategoryChipRow chips={content.categoryChips} />

        {forbidden && (
          <p className="text-[13px] leading-[18px] text-text-secondary">{FORBIDDEN_NOTE}</p>
        )}

        <FurnitureDetectedGroups groups={content.detectedGroups} />

        <ul
          aria-label={GRID_LABEL}
          className={isCollapsed ? 'flex overflow-x-auto pb-1' : 'grid'}
          style={isCollapsed ? ROW_STYLE : GRID_STYLE}
        >
          <AnimatePresence initial={false}>
            {content.cards.map((item) => (
              <FurnitureModelCardTile key={item.card.id} item={item} isRow={isCollapsed} />
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {content.onUploadModel !== null && (
        <div className="shrink-0 border-t border-border-default p-3">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            iconBefore={<Upload className="h-4 w-4" aria-hidden="true" />}
            onClick={content.onUploadModel}
          >
            {UPLOAD_LABEL}
          </Button>
        </div>
      )}

      <FurnitureReplaceAllDialog preview={content.replaceAllPreview} />
    </>
  );
}

/**
 * `props` → markup, không gì khác. `FurnitureLibraryPanel.test.tsx` (một file
 * anh em mà file này không sở hữu) dựng cả bảy trạng thái qua đúng component
 * này, không store và không cổng nào ở giữa.
 */
export function FurnitureLibraryPanel({ state }: FurnitureLibraryPanelProps): ReactNode {
  const isCollapsed = state.kind === 'collapsed';

  return (
    <section
      role="region"
      aria-label={REGION_LABEL}
      className={isCollapsed ? COLLAPSED_PANEL_CLASS : PANEL_CLASS}
      style={PANEL_VARIABLES}
    >
      {state.kind === 'empty' && <EmptyBranch state={state} />}

      {state.kind === 'loading' && (
        <div className="p-3">
          <FurnitureLibrarySkeletonGrid />
        </div>
      )}

      {state.kind === 'error' && (
        <EmptyState
          icon={<ServerCrash />}
          title={ERROR_TITLE}
          description={state.message}
          className="p-4"
          action={{ label: RETRY_LABEL, onClick: state.onRetry, variant: 'secondary' }}
        />
      )}

      {(state.kind === 'partial' || state.kind === 'success') && <PanelContent content={state} />}

      {state.kind === 'forbidden' && <PanelContent content={state} forbidden />}

      {state.kind === 'collapsed' && <PanelContent content={state} isCollapsed />}
    </section>
  );
}
