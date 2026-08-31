/**
 * Màn S-12 "Duyệt lớp tường" (`WallLayerReview`) — view THUẦN, ghép ba vùng:
 * ray công cụ trái (56), panel trái (280), panel phải/thanh tra (344), cộng
 * canvas giữa và thanh trạng thái (32) dính đáy.
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
 * | `partial`   | mặc định — danh sách + thanh tra bình thường                      |
 * | `error`     | `InlineAlert` trong panel trái; canvas VẪN xem được ảnh nền        |
 * | `success`   | panel trái hiện nút "Sang lớp Cửa và nội thất"                    |
 * | `forbidden` | ray ẩn công cụ sửa; thanh tra bỏ viền + một câu giải thích         |
 * | `collapsed` | hai panel ẩn; ray công cụ nổi trên canvas                          |
 *
 * Không nhánh nào khiến view trả `null` — canvas, ray công cụ và thanh trạng
 * thái luôn được vẽ, nên màn trắng (thất bại duy nhất A11 tồn tại để chặn)
 * không có chỗ xảy ra.
 */

import type { ReactNode } from 'react';

import { Skeleton } from '@/components/feedback/Skeleton';

import { WallLayerInspector } from './WallLayerInspector';
import { WallLayerLeftPanel, type WallLayerOtherKind } from './WallLayerLeftPanel';
import { WallLayerStatusBar, type WallLayerStatusBarProps } from './WallLayerStatusBar';
import { WallLayerToolRail, type WallLayerToolRailProps } from './WallLayerToolRail';
import type { WallLayerCanvasProps, WallLayerReviewProps } from './types';

export interface WallLayerReviewViewProps extends WallLayerReviewProps {
  readonly toolRail: WallLayerToolRailProps;
  readonly statusBar: WallLayerStatusBarProps;
  /** Vùng canvas thật. Vắng thì dùng dự phòng dựng từ `canvas` (xem đầu file). */
  readonly canvasSlot?: ReactNode | undefined;
  readonly onNavigateLayer?: ((layer: WallLayerOtherKind) => void) | undefined;
}

const SCREEN_ARIA_LABEL = 'Duyệt lớp tường';
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
  canvasSlot,
  onNavigateLayer,
}: WallLayerReviewViewProps) {
  const isCollapsed = panel.state === 'collapsed';

  return (
    <div aria-label={SCREEN_ARIA_LABEL} className="flex h-full min-h-0 w-full flex-col bg-bg-app" role="region">
      <div className="relative flex min-h-0 flex-1 gap-2 p-2">
        {isCollapsed ? (
          <div className="absolute left-4 top-4 z-10 rounded-[12px] bg-bg-surface shadow-panel">
            <WallLayerToolRail {...toolRail} readOnly={panel.isViewerRole} />
          </div>
        ) : (
          <WallLayerToolRail {...toolRail} readOnly={panel.isViewerRole} />
        )}

        {!isCollapsed && <WallLayerLeftPanel onNavigateLayer={onNavigateLayer} panel={panel} />}

        <section
          aria-label={canvas.backgroundImageAlt || CANVAS_REGION_FALLBACK_ALT}
          className="min-h-0 min-w-[640px] flex-1 overflow-hidden rounded-[16px] bg-bg-sunken"
        >
          {canvasSlot ?? <CanvasFallback canvas={canvas} />}
        </section>

        {!isCollapsed && <WallLayerInspector panel={panel} />}
      </div>

      <WallLayerStatusBar {...statusBar} />
    </div>
  );
}
