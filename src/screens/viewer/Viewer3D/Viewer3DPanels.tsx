/**
 * Cột panel phụ của `Viewer3D` — thứ đi vào khe `inspectorSections` của vỏ.
 *
 * ## Vì sao file này tồn tại thay vì viết thẳng trong container
 *
 * Hai lý do, và cả hai đều là luật:
 *
 * 1. **Mục D** — `Viewer3D.container.tsx` đã 338 dòng trước lượt này. Trần R-22
 *    hỏng ở 400 dòng CÓ NỘI DUNG, nên phần con tách ra file anh em còn
 *    `index.ts` giữ nguyên đường nhập, đúng khuôn `ShareScreen/` và
 *    `AuthScreen/`.
 * 2. **R-70** — file này là một component THUẦN TỪ PROPS: nó không đọc kho,
 *    không gọi mạng, không biết `react-router`. Mọi đường ra ngoài đi vào bằng
 *    callback. Nhờ vậy bài kiểm dựng được cả cột panel mà không phải dựng cả
 *    khung nhìn 3D.
 *
 * Bốn container panel bên dưới TỰ đọc phiên đăng nhập và kho của chúng — đó là
 * hợp đồng chúng đã khai (`PropertyInspector.container.tsx:25-33`,
 * `RoomAreaPanel.container.tsx:20-28`), không phải chỗ hở của file này.
 *
 * ## Một panel mở tại một thời điểm
 *
 * Cột thanh tra rộng 344 (`ViewerInspector.tsx:56`). Ba bảng phụ mở cùng lúc ở
 * đó là ba bảng không ai đọc được, nên chúng là một bộ đóng mở loại trừ nhau:
 * bấm nút thứ hai thì bảng thứ nhất đóng lại.
 *
 * `PropertyInspector` KHÔNG nằm trong bộ ấy. Nó không có nút bật: nó xuất hiện
 * khi có đối tượng đang chọn và biến mất khi không — vì "đang chọn gì" là câu
 * hỏi mà chính nó trả lời, và một nút bật cho nó sẽ là một nút thứ hai nói cùng
 * một điều với cú bấm chọn trên mô hình.
 *
 * ## A12 — Esc đóng lớp trên cùng
 *
 * Bảng phụ đang mở đăng ký `Escape` ở tầng `sidePanel`, qua sổ phím tắt chứ
 * không qua `addEventListener` tự gắn (cùng khuôn `CollaborationLayer.tsx:312`).
 * `enabled` tắt hẳn đăng ký khi không bảng nào mở, nên phím Esc của khung nhìn
 * phía sau không bao giờ bị một bảng đã đóng nuốt mất.
 */

import { lazy, Suspense, type ReactNode } from 'react';

import { Skeleton } from '@/components/feedback/Skeleton';
import { useShortcut } from '@/hooks/useShortcut';
import { cn } from '@/lib/utils';

/**
 * Bốn panel nạp theo nhu cầu, không nhập tĩnh.
 *
 * Cả bốn đã được dựng CÓ ĐIỀU KIỆN ở dưới — panel chỉ hiện khi người dùng mở
 * nó, và phần thanh tra chỉ hiện khi có đối tượng được chọn. Nhập tĩnh thì
 * người mở trình xem 3D phải tải cả bốn ngay, kể cả khi không bao giờ bấm vào
 * thư viện đồ đạc: đo được **375,8 KiB trên ngân sách 280 KiB** của chunk màn,
 * tức vượt 95,8. Nạp động đưa mỗi panel về đúng lúc nó được mở.
 *
 * Cách xử này là cách cổng kích thước gói yêu cầu — tách chunk, không nới số.
 */
const FurnitureLibraryPanelContainer = lazy(async () => ({
  default: (await import('@/screens/viewer/FurnitureLibraryPanel')).FurnitureLibraryPanelContainer,
}));
const HistoryPanelContainer = lazy(async () => ({
  default: (await import('@/screens/viewer/HistoryPanel')).HistoryPanelContainer,
}));
const PropertyInspectorContainer = lazy(async () => ({
  default: (await import('@/screens/viewer/PropertyInspector')).PropertyInspectorContainer,
}));
const RoomAreaPanelContainer = lazy(async () => ({
  default: (await import('@/screens/viewer/RoomAreaPanel')).RoomAreaPanelContainer,
}));

/**
 * Vỏ chờ dùng chung cho bốn panel nạp động.
 *
 * Một `Skeleton` chứ không phải khoảng trắng: A11 nói màn trắng là thất bại duy
 * nhất nó tồn tại để chặn, và một ô trống trong lúc chunk đang tải cũng là một
 * màn trắng thu nhỏ.
 */
function LazyPanel({ children }: { readonly children: ReactNode }) {
  return <Suspense fallback={<Skeleton preset="property-panel" />}>{children}</Suspense>;
}

/** Ba bảng phụ bật/tắt được. `null` là không bảng nào đang mở. */
export type Viewer3DPanelId = 'rooms' | 'furniture' | 'history';

/* Nhãn tiếng Việt, viết thường kiểu câu (A6) — một chỗ viết duy nhất, và ba
   hằng RỜI chứ không một bảng: `react-refresh/only-export-components` với
   `allowConstantExport` chỉ cho hằng nguyên thuỷ đi ra khỏi một file component. */
export const VIEWER_3D_ROOMS_PANEL_LABEL = 'Diện tích phòng';
export const VIEWER_3D_FURNITURE_PANEL_LABEL = 'Thư viện đồ đạc';
export const VIEWER_3D_HISTORY_PANEL_LABEL = 'Lịch sử thao tác';

const PANEL_LABELS: Readonly<Record<Viewer3DPanelId, string>> = {
  rooms: VIEWER_3D_ROOMS_PANEL_LABEL,
  furniture: VIEWER_3D_FURNITURE_PANEL_LABEL,
  history: VIEWER_3D_HISTORY_PANEL_LABEL,
};

/** Nhãn vùng của cột panel phụ, cho trình đọc màn hình và cho bài kiểm. */
export const VIEWER_3D_PANELS_LABEL = 'Bảng phụ của khung nhìn 3D';

/** Nhãn vùng của panel thanh tra thuộc tính. */
export const VIEWER_3D_INSPECTOR_LABEL = 'Thuộc tính đối tượng đã chọn';

/* Nút vào/ra CHẾ ĐỘ sửa hình học tường. Chế độ ấy vẽ đè lên khung nhìn
   (`Viewer3DOverlays.tsx`), nhưng cửa vào nó nằm ở đây — ngay dưới panel thuộc
   tính của chính bức tường đang chọn, chứ không nổi lên giữa mô hình. */
export const VIEWER_3D_ENTER_WALL_EDIT_LABEL = 'Sửa hình học tường';
export const VIEWER_3D_EXIT_WALL_EDIT_LABEL = 'Thoát chế độ sửa hình học';

export interface Viewer3DPanelsProps {
  /** Đối tượng đang chọn đầu tiên; `null` thì panel thuộc tính không được dựng. */
  readonly selectedEntityId: string | null;
  /** Cả danh sách đang chọn — panel thuộc tính cần nó để nói "đang chọn 3 tường". */
  readonly selectedEntityIds: readonly string[];
  /** Bảng phụ đang mở, hoặc `null`. */
  readonly openPanelId: Viewer3DPanelId | null;
  /** Bấm một nút bật: cùng mã đang mở thì đóng, khác thì đổi sang. */
  readonly onTogglePanel: (panelId: Viewer3DPanelId | null) => void;

  /* Bốn đường ra ngoài của panel thuộc tính và bảng diện tích. */
  readonly onDismissInspector: () => void;
  readonly onNavigateToObject: (entityId: string) => void;
  readonly onOpenRuleScreen: (entityId: string) => void;
  readonly onOpenExport: () => void;
  readonly onCheckWallGaps: () => void;

  /**
   * Tầng đang mở. `null` ⇒ nút "Thư viện đồ đạc" KHÔNG được dựng.
   *
   * `FurnitureLibraryPanelContainerProps.floorId` bắt buộc vì bộ lọc "Đã phát
   * hiện" chạy theo tầng, nên một nút bật mà không có tầng nào ở đầu bên kia là
   * đúng thứ nút chết R-73 cấm. Ẩn nút là câu trả lời trung thực.
   */
  readonly floorId: string | null;
  /** Thả một mô hình vào cảnh — thư viện báo ra, khung nhìn dựng lại theo. */
  readonly onModelDropped: (modelId: string, targetEntityId: string | null) => void;
  /** Dự án đang mở; bảng diện tích dùng nó làm khoá bộ nhớ đệm. */
  readonly projectId: string;

  /**
   * Vùng chọn hiện tại có phải tường không.
   *
   * `false` ⇒ nút vào chế độ sửa hình học KHÔNG được dựng: lớp phủ ấy chỉ sửa
   * được tường, nên một nút mở nó ra khi đang chọn một cái ghế là một nút dẫn
   * tới trạng thái rỗng (R-73).
   */
  readonly canEditWallGeometry: boolean;
  /** Chế độ sửa hình học đang bật — nút đổi thành lối ra. */
  readonly isWallEditing: boolean;
  /** Bật/tắt chế độ sửa hình học tường. */
  readonly onToggleWallEditing: () => void;
}

/** Một nút bật của bộ đóng mở loại trừ nhau. */
function PanelToggle({
  panelId,
  isOpen,
  onToggle,
}: {
  readonly panelId: Viewer3DPanelId;
  readonly isOpen: boolean;
  readonly onToggle: (panelId: Viewer3DPanelId | null) => void;
}) {
  return (
    <button
      aria-controls={`viewer-3d-panel-${panelId}`}
      aria-expanded={isOpen}
      className={cn(
        'rounded-[6px] px-2 py-1 text-[13px] font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        isOpen ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover',
      )}
      onClick={() => {
        onToggle(isOpen ? null : panelId);
      }}
      type="button"
    >
      {PANEL_LABELS[panelId]}
    </button>
  );
}

export function Viewer3DPanels(props: Viewer3DPanelsProps) {
  const { openPanelId, onTogglePanel } = props;

  /* A12: Esc đóng bảng phụ đang mở, và chỉ khi có bảng đang mở. */
  useShortcut(
    {
      id: 'viewer3d.panels.close',
      combo: 'Escape',
      scope: 'sidePanel',
      description: 'đóng bảng phụ đang mở',
      onTrigger: () => {
        onTogglePanel(null);
      },
    },
    { enabled: openPanelId !== null },
  );

  /* Tầng chưa biết thì không dựng nút thư viện — xem `floorId` ở trên. */
  const togglePanelIds: readonly Viewer3DPanelId[] =
    props.floorId === null ? ['rooms', 'history'] : ['rooms', 'furniture', 'history'];

  return (
    <div className="flex min-h-0 shrink-0 flex-col border-t border-border-default">
      {props.selectedEntityId !== null && (
        <section
          aria-label={VIEWER_3D_INSPECTOR_LABEL}
          className="min-h-0 max-h-[320px] overflow-y-auto"
        >
          <LazyPanel>
            <PropertyInspectorContainer
              onDismiss={props.onDismissInspector}
              onNavigateToObject={props.onNavigateToObject}
              onOpenRuleScreen={props.onOpenRuleScreen}
              selectedEntityId={props.selectedEntityId}
              selectedEntityIds={props.selectedEntityIds}
            />
          </LazyPanel>
        </section>
      )}

      {props.canEditWallGeometry && (
        <div className="shrink-0 px-2 pt-2">
          <button
            aria-pressed={props.isWallEditing}
            className={cn(
              'w-full rounded-[6px] px-2 py-1 text-[13px] font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              props.isWallEditing
                ? 'bg-bg-hover text-text-primary'
                : 'text-accent hover:bg-bg-hover',
            )}
            onClick={props.onToggleWallEditing}
            type="button"
          >
            {props.isWallEditing
              ? VIEWER_3D_EXIT_WALL_EDIT_LABEL
              : VIEWER_3D_ENTER_WALL_EDIT_LABEL}
          </button>
        </div>
      )}

      <nav aria-label={VIEWER_3D_PANELS_LABEL} className="flex shrink-0 flex-wrap gap-1 p-2">
        {togglePanelIds.map((panelId) => (
          <PanelToggle
            isOpen={openPanelId === panelId}
            key={panelId}
            onToggle={onTogglePanel}
            panelId={panelId}
          />
        ))}
      </nav>

      {openPanelId === 'rooms' && (
        <div className="min-h-0 max-h-[360px] overflow-y-auto" id="viewer-3d-panel-rooms">
          <LazyPanel>
            <RoomAreaPanelContainer
              onCheckWallGaps={props.onCheckWallGaps}
              onOpenExport={props.onOpenExport}
              projectId={props.projectId}
            />
          </LazyPanel>
        </div>
      )}

      {openPanelId === 'furniture' && props.floorId !== null && (
        <div className="min-h-0 max-h-[360px] overflow-y-auto" id="viewer-3d-panel-furniture">
          <LazyPanel>
            <FurnitureLibraryPanelContainer
              floorId={props.floorId}
              onModelDropped={props.onModelDropped}
            />
          </LazyPanel>
        </div>
      )}

      {openPanelId === 'history' && (
        <div className="min-h-0 max-h-[360px] overflow-y-auto" id="viewer-3d-panel-history">
          <LazyPanel>
            <HistoryPanelContainer layout="panel" />
          </LazyPanel>
        </div>
      )}
    </div>
  );
}
