/**
 * Màn S-12 "Duyệt lớp tường" (`WallLayerReview`) — view THUẦN, bố cục L23: ray công cụ (56),
 * cột việc (`QcStepColumn`: "Duyệt tường" + chip · thanh Lọc/⚠ · danh sách · cổng và cặp nút bước ở đáy), bản vẽ mang cụm
 * trạng thái nổi, panel phải (`WallLayerInspectorPanel`: đoạn đang chọn; chưa chọn thì mở bằng nút "Chi tiết": "Tầng này" + chú giải).
 *
 * Chỉ nhận {@link WallLayerReviewViewProps} và vẽ. Không `@/api`, không
 * `@/store`, không `@/domain`, không `@/lib/http` (R-60,
 * `local/no-data-layer-in-view`). Không tính hình học, không tự làm tròn hay
 * đổi ngôn ngữ hiển thị số — mọi chuỗi số đã định dạng xong ở hook (A15).
 *
 * ## Ba nhóm props MỞ RỘNG ngoài `WallLayerReviewProps` — vì sao
 *
 * `types.ts` đóng băng vì ba worker lớp 2 viết song song (hook, canvas, panel —
 * worker này). Khi dựng màn theo đặc tả gốc, ba chỗ sau KHÔNG có dữ liệu trong
 * `WallLayerReviewProps = { panel, canvas }`:
 *
 * 1. **`toolRail`** — công cụ đang chọn là trạng thái NGHIỆP VỤ (S-08
 *    `toolMachine`), không phải thứ view tự giữ bằng `useState` (mục D).
 * 2. **`statusBar`** — toạ độ con trỏ / tỷ lệ / trạng thái lưu đến từ theo dõi
 *    chuột trên canvas và từ autosave, không phải dữ liệu lớp tường.
 * 3. **`canvasSlot`** — `WallLayerCanvas.tsx` do một worker khác viết SONG
 *    SONG, chưa tồn tại trong worktree này lúc file này được viết; import
 *    thẳng nó sẽ làm `pnpm typecheck` đỏ NGAY. Nhận qua props (ghép, không
 *    sửa file) để T8 chỉ cần truyền `<WallLayerCanvas ... />` vào, không đụng
 *    một dòng nào ở đây.
 *
 * Quyết định của điều phối viên (sau khi worker này báo ba lỗ hổng hợp đồng):
 * component con được phép tự khai props của chính nó trong file của nó, thay
 * vì sửa `types.ts`. `onNavigateLayer` (từ {@link WallLayerLeftPanelProps}) là
 * một mở rộng thứ tư cùng loại — năm mục cây lớp cố định, nhưng điều hướng
 * sang bốn lớp còn lại cần một callback ngoài hợp đồng L1.
 *
 * ## Bảy trạng thái (A11) — nơi từng trạng thái được vẽ
 *
 * | `state`     | vẽ ở đâu                                                        |
 * |-------------|------------------------------------------------------------------|
 * | `empty`     | `WallLayerList` (panel trái) — `EmptyState` với `emptyNotice`     |
 * | `loading`   | canvas: dự phòng khung xương; panel trái: 12 dòng `Skeleton`      |
 * | `partial`   | mặc định — danh sách + panel phải bình thường                     |
 * | `error`     | `InlineAlert` trong panel trái; đọc lớp hỏng khi chưa có tài liệu → cả màn là `FloorLayerReadFailureScreen` (BUG-326) |
 * | `success`   | cổng ở đáy cột việc (`WallLayerGate`) là cổng chung của tầng (`FloorReviewGate`) |
 * | `forbidden` | ray ẩn công cụ sửa; panel phải chỉ đọc                             |
 * | `collapsed` | cột việc và panel phải ẩn; ray công cụ vẫn đứng cạnh canvas (G4a-20) |
 *
 * Không nhánh nào khiến view trả `null` — canvas, ray công cụ và thanh trạng
 * thái luôn được vẽ, nên màn trắng (thất bại duy nhất A11 tồn tại để chặn)
 * không có chỗ xảy ra.
 */

import type { ReactNode } from 'react';

import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import type { FloorLayerSaveBlock } from '@/hooks/useAutosave';

import { FloorLayerSaveBanner } from './FloorLayerSaveBanner';
import { FloorLayerReadFailureScreen } from '../shared/FloorLayerReadFailureScreen';
import type { FloorLayerReadFailure } from '../shared/floorLayerReadFailure';
import { ProvisionalScaleBanner } from '../shared/ProvisionalScaleBanner';
import { QcFloorNav, type QcFloorNavProps } from '../shared/QcFloorNav';
import { QcScreenFrame, QcWorkspace } from '../shared/QcScreenFrame';
import { queueNumbersOf } from '../shared/qcAsk';
import { QcDisplayPopover } from '../shared/QcDisplayPopover';
import { QcStepColumn } from '../shared/QcStepColumn';
import type { ProvisionalScaleNotice } from '../shared/provisionalScaleNotice';
import { WallLayerGate } from './WallLayerGate';
import { WallLayerInspectorPanel, type WallLayerLegendSource } from './WallLayerInspectorPanel';
import {
  WallLayerLeftPanel,
  type WallLayerLeftPanelExtras,
  type WallLayerOtherKind,
} from './WallLayerLeftPanel';
import { WallLayerStatusBar, type WallLayerStatusBarProps } from './WallLayerStatusBar';
import { WallLayerToolRail, type WallLayerToolRailProps } from './WallLayerToolRail';
import type { WallLayerCanvasProps, WallLayerReviewProps } from './types';
import type { WallOpeningLayerToggle } from './wallLayerHatch';
import { approveAllLabelOf, type WallReviewQueue } from './wallReviewQueue';

export interface WallLayerReviewViewProps extends WallLayerReviewProps {
  readonly toolRail: WallLayerToolRailProps;
  readonly statusBar: WallLayerStatusBarProps;
  /** Nhóm mở rộng thứ tư: điều hướng tầng, tim tường, cờ lớp Tường, hàng đang nháy. */
  readonly leftPanel: WallLayerLeftPanelExtras & WallOpeningLayerToggle;
  /** Vùng canvas thật. Vắng thì dùng dự phòng dựng từ `canvas` (xem đầu file). */
  readonly canvasSlot?: ReactNode | undefined;
  readonly onNavigateLayer?: ((layer: WallLayerOtherKind) => void) | undefined;
  /** Hàng đợi duyệt (Z/S-15): nhóm danh sách, cổng "Duyệt tiếp", đổi về chuẩn. Vắng = bản tối giản. */
  readonly queue?: WallReviewQueue | undefined;
  /** Đầu chung Dự án › Tầng › Lớp + thanh lớp (G4a-24). Tầng lấy từ `leftPanel.floors`. */
  readonly floorNav?: Omit<QcFloorNavProps, 'floors' | 'layer'> | undefined;
  /** Khối lưu lớp của tầng (F-04x-1) — dải trên màn, không trong canvas. */
  readonly saveBlock?: FloorLayerSaveBlock | null | undefined;
  /** Dải tỉ lệ tạm (F-04x-2) — trên màn, không trong canvas. */
  readonly provisionalScaleNotice?: ProvisionalScaleNotice | null | undefined;
  /** Đọc lớp của tầng hỏng khi chưa có tài liệu: thay cả màn, một lối ra (BUG-326). */
  readonly readFailure?: FloorLayerReadFailure | null | undefined;
  /** Chú giải ở mục "Chú giải" của panel phải (cùng dữ liệu với bản vẽ). Vắng = không có mục đó. */
  readonly legend?: WallLayerLegendSource | undefined;
}

const SCREEN_ARIA_LABEL = 'Duyệt lớp tường';
/** H1 ngắn ở đầu cột việc; câu việc dài là dòng mờ dưới nó. */
const TITLE = 'Duyệt tường';
const TASK = 'Duyệt từng đoạn tường máy tìm thấy. Đúng thì giữ, nét thừa thì xoá.';
/** UX-46: người xem không sửa được — tiêu đề không bảo họ giữ/xoá. */
const VIEWER_TITLE = 'Xem tường';
const VIEWER_TASK = 'Xem từng đoạn tường máy tìm thấy.';
const LAYER_GROUP = 'Lớp của bước';
const WALL_LAYER = 'Lớp tường';
const CENTRELINES = 'Tim tường';
const OPENINGS = 'Cửa đi / cửa sổ';
const CANVAS_REGION_FALLBACK_ALT = 'Chưa có ảnh nền để xem';

/**
 * Dự phòng hợp lệ khi `canvasSlot` vắng (story, test, hoặc trước khi T8 ghép
 * `WallLayerCanvas` thật vào) — KHÔNG tính hình học, chỉ đọc `backgroundImageUrl`
 * đã có sẵn trong props.
 */
function CanvasFallback({ canvas }: { canvas: WallLayerCanvasProps }) {
  if (canvas.backgroundImageUrl === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Skeleton className="h-full w-full" preset="canvas" />
      </div>
    );
  }

  return <img alt={canvas.backgroundImageAlt} className="h-full w-full object-contain" src={canvas.backgroundImageUrl} />;
}

export function WallLayerReview({
  panel,
  canvas,
  toolRail,
  statusBar,
  leftPanel,
  canvasSlot,
  queue,
  floorNav,
  saveBlock,
  provisionalScaleNotice,
  readFailure,
  legend,
}: WallLayerReviewViewProps) {
  /*
   * Cờ của vỏ màn, không `state`: ở vai người xem `forbidden` đứng trước `collapsed`, nên nút
   * thu gọn đổi nhãn mà hai panel không thu (BUG-601).
   */
  const isCollapsed = toolRail.isCollapsed;
  /* Một bộ mục cho panel phải và số ở cột trái — dòng "3" là ghim "3" (ghim đi theo `rows` chưa duyệt). */
  const queueItems = panel.rows.map((row) => ({ id: row.id, pending: !row.isReviewed }));
  const display = (
    <QcDisplayPopover
      groups={[
        {
          title: LAYER_GROUP,
          items: [
            { key: 'walls', label: WALL_LAYER, checked: leftPanel.isWallLayerVisible, onToggle: leftPanel.onToggleWallLayer },
            { key: 'centrelines', label: CENTRELINES, checked: leftPanel.showCentrelines, onToggle: leftPanel.onToggleCentrelines },
            ...(leftPanel.onToggleOpeningLayer === undefined
              ? []
              : [{ key: 'openings', label: OPENINGS, checked: leftPanel.isOpeningLayerVisible ?? true, onToggle: leftPanel.onToggleOpeningLayer }]),
          ],
        },
      ]}
      variant="flat"
    />
  );
  /* U17/U32: duyệt hết đoạn máy chắc chắn — nút phụ ở đáy cột, ngay trên cổng (cổng vẫn là nút chính duy nhất). */
  const onApproveConfident = panel.isViewerRole || panel.scaleLock != null ? undefined : queue?.onApproveConfident;
  const confidentCount = queue?.confidentCount ?? 0;
  const approveConfident =
    onApproveConfident !== undefined && confidentCount > 0 ? (
      <Button fullWidth onClick={onApproveConfident} size="sm" variant="secondary">
        {approveAllLabelOf(confidentCount)}
      </Button>
    ) : null;
  const left = isCollapsed ? null : (
    <WallLayerLeftPanel
      extras={leftPanel}
      panel={panel}
      queue={queue}
      queueNumbers={queueNumbersOf(queueItems)}
      thickness={legend?.legendLevels}
    />
  );

  if (readFailure != null) {
    return (
      <QcScreenFrame label={SCREEN_ARIA_LABEL}>
        <FloorLayerReadFailureScreen failure={readFailure} />
      </QcScreenFrame>
    );
  }

  /*
   * Cao bằng khung nhìn (BUG-324): route nằm trong `ScreenMain` (display: contents) nên `h-full`
   * không có chiều cao nào để bám, và thanh trạng thái trôi lên giữa trang — cùng cách SCR-22.
   */
  return (
    <QcScreenFrame label={SCREEN_ARIA_LABEL}>
      {/* H1 thấy được ở đầu cột việc (`QcStepColumn`); tiến độ ở dòng trạng thái + cổng, không lặp ở đây. */}
      {/* Thanh bước mang số đã duyệt/tổng của cả bốn bước (cột việc chỉ nói bước đang làm). */}
      {floorNav != null && <QcFloorNav {...floorNav} floors={leftPanel.floors} layer="walls" minimal titled />}
      {saveBlock != null && (
        <div className="px-2 pt-2">
          <FloorLayerSaveBanner saveBlock={saveBlock} />
        </div>
      )}
      {provisionalScaleNotice != null && (
        <div className="px-2 pt-2">
          <ProvisionalScaleBanner notice={provisionalScaleNotice} />
        </div>
      )}
      {/* Khe chung (A3): rail | cột việc | bản vẽ | panel phải neo (luôn có, ẩn khi thu gọn). */}
      <QcWorkspace
        collapsed={isCollapsed}
        column
        canvas={canvasSlot ?? <CanvasFallback canvas={canvas} />}
        canvasLabel={canvas.backgroundImageAlt || CANVAS_REGION_FALLBACK_ALT}
        left={
          /* Cây bước và cổng cần dự án + tầng; story không có thanh tầng thì chỉ có danh sách. */
          left !== null && floorNav != null ? (
            <QcStepColumn
              activeStep="walls"
              fileHeader={<QcFloorNav {...floorNav} floors={leftPanel.floors} layer="walls" minimal stacked titled />}
              floorId={floorNav.floorId}
              gate={
                <div className="flex flex-col gap-2">
                  {approveConfident}
                  <WallLayerGate floorNav={floorNav} panel={panel} queue={queue} />
                </div>
              }
              projectId={floorNav.projectId}
              task={panel.isViewerRole ? VIEWER_TASK : TASK}
              title={panel.isViewerRole ? VIEWER_TITLE : TITLE}
            >
              {left}
            </QcStepColumn>
          ) : left === null ? null : (
            <>
              {left}
              {approveConfident}
            </>
          )
        }
        /* Tầng khoá vì thiếu tỷ lệ: không bày Vẽ/Tách/Nối/Đo — sửa đều bị từ chối (UX-R2 K23). */
        rail={<WallLayerToolRail {...toolRail} readOnly={panel.isViewerRole || panel.scaleLock != null} />}
        inspector={<WallLayerInspectorPanel display={display} legend={legend} panel={panel} queue={queue} />}
        selectionKey={panel.selectedWallId}
        status={<WallLayerStatusBar {...statusBar} onUndo={panel.isViewerRole ? undefined : panel.onUndo} readOnly={panel.isViewerRole} />}
      />
    </QcScreenFrame>
  );
}
