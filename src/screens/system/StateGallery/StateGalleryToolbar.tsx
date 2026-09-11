/**
 * S-47 — thanh công cụ duyệt và bảng bốn phép kiểm.
 *
 * Ba công tắc ở đây KHÔNG tự đặt gì lên `<html>`. Chủ đề tối là class `dark`
 * trên phần tử gốc (`hooks/useTheme.ts:22-26`) và giảm chuyển động là thuộc
 * tính `data-reduced-motion` (`useAccountPreferences.ts:101`) — cả hai đều toàn
 * cục, cả hai đều do hook ngoài view lo. View thuần chỉ gọi callback đi lên
 * (`onToggleDarkTheme`, `onToggleReducedMotion`), đúng mục D và R-60.
 *
 * Bảng kết quả là LỚP TRÊN CÙNG của màn này, nên A12 áp ở đây: Esc đóng nó.
 * Trạng thái mở/đóng là trạng thái giao diện cục bộ — nó không phải dữ liệu, nên
 * nó không cần một props mới và không phá tính thuần của view.
 */
import { useCallback, useState } from 'react';

import { Play, X } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Toggle } from '@/components/ui/Toggle';
import { useShortcut } from '@/hooks/useShortcut';

import { QUICK_CHECK_IDS } from './stateGalleryTypes';
import type {
  QuickCheckId,
  QuickCheckRow,
  QuickCheckStatus,
  ReviewToolbarState,
} from './stateGalleryTypes';

const TOOLBAR_REGION_LABEL = 'công cụ duyệt';
const TOGGLE_DARK_THEME = 'chủ đề tối';
const TOGGLE_DARK_THEME_HINT = 'Đổi giữa chủ đề sáng và chủ đề tối cho cả ứng dụng.';
const TOGGLE_REDUCED_MOTION = 'giảm chuyển động';
const TOGGLE_REDUCED_MOTION_HINT = 'Tắt hoạt ảnh khi duyệt khung xem trước.';
const TOGGLE_SPACING_GRID = 'lưới đo khoảng cách';
const TOGGLE_SPACING_GRID_HINT = 'Phủ lưới lên khung xem trước để đo khoảng cách.';
const RUN_QUICK_CHECK = 'chạy kiểm nhanh';
const CHECK_TABLE_CAPTION = 'kết quả bốn phép kiểm theo từng màn';
const CHECK_COLUMN_SCREEN = 'màn';
const CHECK_EMPTY = 'chưa chạy phép kiểm nào';
const CLOSE_CHECK_PANEL = 'đóng bảng kết quả';
const CLOSE_CHECK_PANEL_HINT = 'để đóng bảng kết quả';

/** Nhãn cột, đúng thứ tự `QUICK_CHECK_IDS` — bốn phép kiểm của O-03. */
const CHECK_LABELS: Readonly<Record<QuickCheckId, string>> = {
  sevenStates: 'bảy trạng thái',
  noRawColor: 'mã màu thô',
  vietnamese: 'chuỗi tiếng Việt',
  accessible: 'khả năng tiếp cận',
};

const STATUS_LABELS: Readonly<Record<QuickCheckStatus, string>> = {
  pending: 'chờ chạy',
  running: 'đang chạy',
  pass: 'đạt',
  fail: 'hỏng',
};

type StatusTone = 'verified' | 'attention' | 'violation' | 'neutral';

/**
 * Màu của một ô kết quả.
 *
 * `pass` dùng xanh "đã xác minh" vì ô này ghi việc NGƯỜI DUYỆT vừa làm — chính
 * họ bấm "chạy kiểm nhanh" — chứ không phải phỏng đoán của máy; A5 cấm đầu ra
 * của AI đặt màu này, không cấm một phép kiểm xác định do người chạy.
 */
const STATUS_VARIANTS: Readonly<Record<QuickCheckStatus, StatusTone>> = {
  pending: 'neutral',
  running: 'neutral',
  pass: 'verified',
  fail: 'violation',
};

interface StateGalleryToolbarProps {
  readonly toolbar: ReviewToolbarState;
  readonly checkRows: readonly QuickCheckRow[];
  readonly isCheckRunning: boolean;
  readonly onToggleDarkTheme: () => void;
  readonly onToggleReducedMotion: () => void;
  readonly onToggleSpacingGrid: () => void;
  readonly onRunQuickCheck: () => void;
}

interface CheckCellProps {
  readonly row: QuickCheckRow;
  readonly checkId: QuickCheckId;
}

/** Một ô: huy hiệu trạng thái, và câu lý do bên dưới khi ô đó hỏng. */
function CheckCell({ row, checkId }: CheckCellProps) {
  const cell = row.cells.find((candidate) => candidate.checkId === checkId);
  const status: QuickCheckStatus = cell === undefined ? 'pending' : cell.status;

  return (
    <Table.Cell className="h-auto whitespace-normal py-2 align-top">
      <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
      {cell !== undefined && cell.detail !== null && (
        <p className="mt-1 text-[13px] leading-[18px] text-text-secondary">{cell.detail}</p>
      )}
    </Table.Cell>
  );
}

function CheckResultTable({ rows }: { readonly rows: readonly QuickCheckRow[] }) {
  return (
    <Table.Root className="max-h-[320px]">
      <caption className="sr-only">{CHECK_TABLE_CAPTION}</caption>
      <Table.Header>
        <Table.Row>
          <Table.Head sticky>{CHECK_COLUMN_SCREEN}</Table.Head>
          {QUICK_CHECK_IDS.map((checkId) => (
            <Table.Head key={checkId}>{CHECK_LABELS[checkId]}</Table.Head>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.screenId}>
            <Table.Cell className="h-auto whitespace-normal py-2 align-top font-medium text-text-primary">
              {row.screenLabel}
            </Table.Cell>
            {QUICK_CHECK_IDS.map((checkId) => (
              <CheckCell checkId={checkId} key={checkId} row={row} />
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export function StateGalleryToolbar({
  toolbar,
  checkRows,
  isCheckRunning,
  onToggleDarkTheme,
  onToggleReducedMotion,
  onToggleSpacingGrid,
  onRunQuickCheck,
}: StateGalleryToolbarProps) {
  const [isPanelDismissed, setIsPanelDismissed] = useState(false);

  const isPanelOpen = !isPanelDismissed && (checkRows.length > 0 || isCheckRunning);

  const closePanel = useCallback(() => {
    setIsPanelDismissed(true);
  }, []);

  const runCheck = useCallback(() => {
    setIsPanelDismissed(false);
    onRunQuickCheck();
  }, [onRunQuickCheck]);

  // A12: Esc đóng lớp trên cùng. Đăng ký qua registry dùng chung — không nơi nào
  // trong mã này gọi `addEventListener('keydown')` trực tiếp.
  useShortcut(
    {
      id: 'stateGallery.closeCheckPanel',
      combo: 'Escape',
      scope: 'sidePanel',
      description: 'đóng bảng kết quả kiểm nhanh',
      onTrigger: closePanel,
    },
    { enabled: isPanelOpen },
  );

  return (
    <section
      aria-label={TOOLBAR_REGION_LABEL}
      className="flex flex-col gap-3 border-b border-border-default bg-bg-surface px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-6">
        <Toggle
          checked={toolbar.isDarkTheme}
          description={TOGGLE_DARK_THEME_HINT}
          label={TOGGLE_DARK_THEME}
          onChange={onToggleDarkTheme}
        />
        <Toggle
          checked={toolbar.isReducedMotion}
          description={TOGGLE_REDUCED_MOTION_HINT}
          label={TOGGLE_REDUCED_MOTION}
          onChange={onToggleReducedMotion}
        />
        <Toggle
          checked={toolbar.isSpacingGridVisible}
          description={TOGGLE_SPACING_GRID_HINT}
          label={TOGGLE_SPACING_GRID}
          onChange={onToggleSpacingGrid}
        />
        <Button
          className="ml-auto"
          iconBefore={<Play aria-hidden="true" size={16} strokeWidth={2} />}
          loading={isCheckRunning}
          onClick={runCheck}
          variant="secondary"
        >
          {RUN_QUICK_CHECK}
        </Button>
      </div>

      {isPanelOpen && (
        <div className="flex flex-col gap-2 rounded-[8px] border border-border-default bg-bg-sunken p-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-text-primary">{CHECK_TABLE_CAPTION}</h2>
            <p className="text-[13px] text-text-secondary">
              <kbd className="rounded-[4px] border border-border-default px-1">Esc</kbd> {CLOSE_CHECK_PANEL_HINT}
            </p>
            <Button
              aria-label={CLOSE_CHECK_PANEL}
              className="ml-auto"
              iconBefore={<X aria-hidden="true" size={16} strokeWidth={2} />}
              iconOnly
              onClick={closePanel}
              size="sm"
              variant="ghost"
            />
          </div>
          {checkRows.length === 0 ? (
            <p className="text-[14px] text-text-secondary">{CHECK_EMPTY}</p>
          ) : (
            <CheckResultTable rows={checkRows} />
          )}
        </div>
      )}
    </section>
  );
}
