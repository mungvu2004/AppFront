/**
 * S-47 — màn duyệt bảy trạng thái. VIEW THUẦN (R-60, mục D).
 *
 * Mọi thứ vào qua `StateGalleryProps`: không `@/api`, không store, không domain,
 * không `@/lib/http`, và KHÔNG nhập `stateGalleryManifest` — dữ liệu 47 màn do
 * hook dựng rồi truyền xuống, nên một story dựng được màn này chỉ từ một object.
 *
 * ## Bảy trạng thái rẽ nhánh ở đây, và không nhánh nào ra màn trắng (A11)
 *
 * - `forbidden` khoá CẢ màn: trang duyệt chỉ mở trong mạng nội bộ, nên không có
 *   gì bên dưới để vẽ một phần. Đây là nhánh duy nhất bỏ cả cây lẫn công cụ.
 * - `collapsed` chỉ thu cột trái thành một thanh nhỏ; vùng phải vẫn làm việc.
 *   `isCollapsed` và `state === 'collapsed'` gộp lại ở `isTreeCollapsed` — hai
 *   đường vào cùng một hình dạng, không phải hai hình dạng.
 * - `empty` là CHƯA CHỌN MÀN, không phải "không có dữ liệu": cây bên trái vẫn
 *   đầy, chỗ trống nằm ở vùng phải.
 * - `partial` và `success` vẽ cùng một lưới khung; khác nhau ở dải thông báo và ở
 *   con số trong cây, không ở nhánh JSX.
 *
 * Dải "một phần" chỉ nói có màn thiếu; THIẾU CÁI GÌ thì từng hàng trong cây nói,
 * vì đó là nơi người duyệt đang nhìn khi họ cần biết.
 */
import { ChevronsLeft, ChevronsRight, Lock, MousePointerClick } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';

import { StateGalleryFrames } from './StateGalleryFrames';
import { StateGalleryToolbar } from './StateGalleryToolbar';
import { StateGalleryTree } from './StateGalleryTree';
import type { GalleryCoverage, GalleryScreenEntry, StateGalleryProps } from './stateGalleryTypes';

const PAGE_TITLE = 'duyệt bảy trạng thái';
const COVERAGE_LABEL = 'số trạng thái đã có';
const SCREEN_COUNT_LABEL = 'số màn';
const COLLAPSE_TREE = 'thu gọn cây màn';
const EXPAND_TREE = 'mở rộng cây màn';
const COLLAPSED_NOTICE = 'cây màn đang thu gọn';
const LOADING_LABEL = 'đang tải bảng trạng thái';
const EMPTY_TITLE = 'chưa chọn màn nào';
const EMPTY_DESCRIPTION = 'Chọn một màn ở cây bên trái để xem bảy trạng thái của màn đó.';
const ERROR_TITLE = 'không đọc được bảng trạng thái';
const ERROR_FALLBACK = 'Đã có lỗi xảy ra khi đọc bảng trạng thái.';
const RETRY = 'thử lại';
const FORBIDDEN_TITLE = 'trang này chỉ mở trong mạng nội bộ';
const FORBIDDEN_DESCRIPTION =
  'Bạn đang ở ngoài mạng nội bộ nên không mở được trang duyệt trạng thái.';
const PARTIAL_TITLE = 'còn màn thiếu trạng thái';
const PARTIAL_MESSAGE =
  'Một số màn chưa đủ bảy trạng thái; cây bên trái ghi rõ từng màn còn thiếu trạng thái nào.';
const SUCCESS_MESSAGE = 'Không màn nào còn thiếu trạng thái.';

/** Bảy chỗ trống lúc đang tải, một cho mỗi trạng thái. Khoá bằng định danh tiếng Anh (mục E.11). */
const LOADING_FRAME_IDS: readonly string[] = [
  'frame-one',
  'frame-two',
  'frame-three',
  'frame-four',
  'frame-five',
  'frame-six',
  'frame-seven',
];

function CoverageSummary({ coverage }: { readonly coverage: GalleryCoverage }) {
  return (
    <dl className="flex items-center gap-5">
      <div className="flex items-baseline gap-1.5">
        <dt className="text-[13px] leading-[18px] text-text-secondary">{COVERAGE_LABEL}</dt>
        <dd className="text-[14px] font-semibold leading-[20px] text-text-primary">
          {coverage.presentCount}/{coverage.totalCount}
        </dd>
      </div>
      <div className="flex items-baseline gap-1.5">
        <dt className="text-[13px] leading-[18px] text-text-secondary">{SCREEN_COUNT_LABEL}</dt>
        <dd className="text-[14px] font-semibold leading-[20px] text-text-primary">{coverage.screenCount}</dd>
      </div>
    </dl>
  );
}

/** Cột trái lúc thu gọn: một thanh hẹp giữ đúng một việc — mở nó ra lại. */
function CollapsedRail({ onToggleCollapsed }: { readonly onToggleCollapsed: () => void }) {
  return (
    <div className="flex h-full w-10 shrink-0 flex-col items-center gap-2 border-r border-border-default bg-bg-surface py-3">
      <Button
        aria-label={EXPAND_TREE}
        iconBefore={<ChevronsRight aria-hidden="true" size={16} strokeWidth={2} />}
        iconOnly
        onClick={onToggleCollapsed}
        size="sm"
        variant="ghost"
      />
      <span className="sr-only">{COLLAPSED_NOTICE}</span>
    </div>
  );
}

function LoadingFrames() {
  return (
    <div aria-label={LOADING_LABEL} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status">
      {LOADING_FRAME_IDS.map((frameId) => (
        <div className="flex flex-col gap-1.5" key={frameId}>
          <div className="h-4 w-24 rounded-[4px] bg-bg-sunken animate-pulse motion-reduce:animate-none" />
          <div className="h-[148px] rounded-[8px] bg-bg-sunken animate-pulse motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

interface RightPaneProps {
  readonly state: StateGalleryProps['state'];
  readonly selectedScreen: GalleryScreenEntry | null;
  readonly isSpacingGridVisible: boolean;
  readonly errorMessage: string | null;
  readonly onRetry: () => void;
}

function RightPane({ state, selectedScreen, isSpacingGridVisible, errorMessage, onRetry }: RightPaneProps) {
  if (state === 'loading') {
    return <LoadingFrames />;
  }

  if (state === 'error') {
    return (
      <InlineAlert
        action={{ label: RETRY, onClick: onRetry, variant: 'secondary' }}
        level="violation"
        message={errorMessage ?? ERROR_FALLBACK}
        title={ERROR_TITLE}
      />
    );
  }

  if (selectedScreen === null) {
    return (
      <EmptyState
        description={EMPTY_DESCRIPTION}
        icon={<MousePointerClick aria-hidden="true" />}
        title={EMPTY_TITLE}
      />
    );
  }

  return (
    <>
      {state === 'partial' && (
        <InlineAlert level="attention" message={PARTIAL_MESSAGE} title={PARTIAL_TITLE} />
      )}
      {state === 'success' && (
        <p className="text-[14px] leading-[20px] text-text-secondary" role="status">
          {SUCCESS_MESSAGE}
        </p>
      )}
      <StateGalleryFrames isSpacingGridVisible={isSpacingGridVisible} screen={selectedScreen} />
    </>
  );
}

export function StateGallery({
  state,
  coverage,
  groups,
  screens,
  coverageByScreen,
  selectedScreenId,
  searchText,
  toolbar,
  isCollapsed,
  checkRows,
  isCheckRunning,
  errorMessage,
  onSelectScreen,
  onSearchTextChange,
  onToggleDarkTheme,
  onToggleReducedMotion,
  onToggleSpacingGrid,
  onRunQuickCheck,
  onToggleCollapsed,
  onRetry,
}: StateGalleryProps) {
  // "không có quyền" khoá cả màn: không có nửa trang nào vẽ được cho người ở
  // ngoài mạng nội bộ, nên nhánh này không dựng cây và không dựng công cụ.
  if (state === 'forbidden') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg-app p-6">
        <EmptyState
          description={FORBIDDEN_DESCRIPTION}
          icon={<Lock aria-hidden="true" />}
          title={FORBIDDEN_TITLE}
        />
      </div>
    );
  }

  const isTreeCollapsed = isCollapsed || state === 'collapsed';
  const selectedScreen = screens.find((screen) => screen.id === selectedScreenId) ?? null;

  return (
    <div className="flex h-full w-full flex-col bg-bg-app">
      <header className="flex flex-wrap items-center gap-4 border-b border-border-default bg-bg-surface px-4 py-3">
        <Button
          aria-label={isTreeCollapsed ? EXPAND_TREE : COLLAPSE_TREE}
          iconBefore={
            isTreeCollapsed ? (
              <ChevronsRight aria-hidden="true" size={16} strokeWidth={2} />
            ) : (
              <ChevronsLeft aria-hidden="true" size={16} strokeWidth={2} />
            )
          }
          iconOnly
          onClick={onToggleCollapsed}
          size="sm"
          variant="ghost"
        />
        <h1 className="text-[16px] font-semibold leading-[22px] text-text-primary">{PAGE_TITLE}</h1>
        <div className="ml-auto">
          <CoverageSummary coverage={coverage} />
        </div>
      </header>

      <StateGalleryToolbar
        checkRows={checkRows}
        isCheckRunning={isCheckRunning}
        onRunQuickCheck={onRunQuickCheck}
        onToggleDarkTheme={onToggleDarkTheme}
        onToggleReducedMotion={onToggleReducedMotion}
        onToggleSpacingGrid={onToggleSpacingGrid}
        toolbar={toolbar}
      />

      <div className="flex min-h-0 flex-1">
        {isTreeCollapsed ? (
          <CollapsedRail onToggleCollapsed={onToggleCollapsed} />
        ) : (
          <StateGalleryTree
            coverageByScreen={coverageByScreen}
            groups={groups}
            onSearchTextChange={onSearchTextChange}
            onSelectScreen={onSelectScreen}
            screens={screens}
            searchText={searchText}
            selectedScreenId={selectedScreenId}
          />
        )}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <RightPane
            errorMessage={errorMessage}
            isSpacingGridVisible={toolbar.isSpacingGridVisible}
            onRetry={onRetry}
            selectedScreen={selectedScreen}
            state={state}
          />
        </main>
      </div>
    </div>
  );
}
