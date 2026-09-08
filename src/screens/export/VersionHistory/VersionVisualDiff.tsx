/**
 * Tab "Trực quan" — khối 3D của mô hình HIỆN TẠI, tô sáng những đối tượng đã đổi.
 *
 * ## Nó KHÔNG phải cái đặc tả vẽ ra, và caption nói thẳng điều đó
 *
 * Đặc tả gốc đòi "hai mô hình chồng lên nhau, đối tượng đã đổi có viền". Repo không dựng được
 * (khoản 1 của docblock `./types`): không có bộ đổi `VersionSnapshot` → hình học, và không có
 * đường nào chồng hai `Scene` three.js. Thứ dựng được là mô hình HIỆN TẠI với các mã đã đổi
 * nằm trong `selectedEntityIds`. Vì vậy `visual.caption` là bắt buộc hiện ở mọi nhánh có mô
 * hình: người đọc không được phép tưởng khối 3D này là bản cũ.
 *
 * ## Vì sao `await import()` động
 *
 * `screens/viewer/Viewer3D` một mình đã 264,8 KiB gzip trên ngân sách `routeChunk` 280 KiB.
 * Một lệnh nhập tĩnh ở đây là kéo cả màn ấy vào gói của màn này và vỡ cổng kích thước ngay
 * lượt dựng đầu — đúng khuôn và đúng lý do đã ghi ở `useViolationDetail.ts:1061-1069`.
 *
 * ## Vì sao hình học đến từ prop chứ không tự nấu
 *
 * `mountViewerScene` đòi `levels: BuildFloorInput[]` và một `ViewerSceneFrame` đầy đủ.
 * `toBuildFloorInput` sống ở `@/domain`, mà `local/no-data-layer-in-view` chặn import chạy
 * trong một view (R-60) — nên hook nấu sẵn và cấp xuống qua `sceneLevels`/`sceneFrame`. Ở đây
 * chỉ còn hai lệnh nhập KIỂU, thứ bị xoá trước khi có gói.
 */

import { Boxes, MonitorOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { UNPAINTED_TOKEN } from '@/lib/coloring/scales';
import type { ViewerSceneHandle } from '@/screens/viewer/Viewer3D';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import type { VisualDiffModel } from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt tĩnh — khớp `compare.vi.json.fragment`.                     */
/* -------------------------------------------------------------------------- */

const UNAVAILABLE_TITLE = 'Chưa xem trực quan được';
const UNAVAILABLE_BODY = 'Không dựng được mô hình cho cặp phiên bản đang chọn.';
const WEBGL_TITLE = 'Máy này không dựng được 3D';
const WEBGL_BODY =
  'Trình duyệt không bật WebGL nên khối 3D không hiện. Hai tab còn lại vẫn mô tả đủ khác biệt.';
const BUILDING_LABEL = 'Đang dựng mô hình';

/**
 * Mô hình để trần, không tô theo chế độ màu nào.
 *
 * Tab này chỉ có một việc: cho thấy đối tượng nào đã đổi. Vùng chọn đã mang màu nhấn
 * (`viewer3dScene.ts:350-367`), nên tô thêm một bảng màu nữa lên thân mô hình là lấy mất đúng
 * thứ tab này tồn tại để chỉ ra.
 */
const untintedToken = () => UNPAINTED_TOKEN;

/**
 * Khung cảnh gửi cho `mountViewerScene`/`handle.update`.
 *
 * Cảnh không có API đặt riêng một trường: đổi một mã đang trỏ cũng phải dựng lại CẢ khung
 * (`viewer3dTypes.ts:276-317`). Khung nền do hook cấp, view chỉ ghi đè đúng hai trường của
 * mình — dựng một khung mới ở đây sẽ giật camera về điểm nhìn mặc định mỗi lần con trỏ đi qua
 * một hàng diff.
 */
function frameOf(
  base: ViewerSceneFrame,
  changedEntityIds: readonly string[],
  hoveredEntityId: string | null,
): ViewerSceneFrame {
  return { ...base, selectedEntityIds: changedEntityIds, hoveredEntityId };
}

export interface VersionVisualDiffProps {
  readonly visual: VisualDiffModel;
}

export function VersionVisualDiff({ visual }: VersionVisualDiffProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isWebglMissing, setWebglMissing] = useState(false);
  const handleRef = useRef<ViewerSceneHandle | null>(null);

  /** Mọi thứ lượt lắp cảnh cần, đọc qua một ref để nó không lắp lại mỗi lần render. */
  const sceneRef = useRef(visual);

  useEffect(() => {
    sceneRef.current = visual;
  });

  const canvasRef = useCallback((next: HTMLCanvasElement | null): void => {
    setCanvas(next);
  }, []);

  /*
   * Canvas chỉ được render khi hình học đã có, nên hiệu ứng này chạy đúng một lần cho mỗi
   * canvas và không bao giờ chạy vào lúc `sceneLevels` còn rỗng.
   */
  useEffect(() => {
    if (canvas === null) {
      return undefined;
    }

    let cancelled = false;

    void import('@/screens/viewer/Viewer3D').then((module) => {
      const current = sceneRef.current;

      if (cancelled || current.sceneFrame === null || current.sceneLevels.length === 0) {
        return;
      }

      const mounted = module.mountViewerScene(canvas, {
        levels: current.sceneLevels,
        frame: frameOf(current.sceneFrame, current.changedEntityIds, current.hoveredEntityId),
        tokenOfPartKind: untintedToken,
        canSelect: false,
      });

      if (!mounted.ok) {
        // Không có WebGL là một nhánh hợp lệ, không phải sự cố: khối 3D không hiện và tab nói
        // ra một câu bình thường thay vì để lại một ô đen.
        setWebglMissing(true);
        return;
      }

      handleRef.current = mounted.handle;
    });

    return (): void => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [canvas]);

  /* Trỏ vào một hàng diff, hoặc đổi cặp phiên bản: vẽ lại bằng khung mới. */
  useEffect(() => {
    if (visual.sceneFrame === null) {
      return;
    }

    handleRef.current?.update(
      frameOf(visual.sceneFrame, visual.changedEntityIds, visual.hoveredEntityId),
    );
  }, [visual.sceneFrame, visual.changedEntityIds, visual.hoveredEntityId]);

  if (!visual.isAvailable) {
    return (
      <EmptyState
        icon={<Boxes className="text-text-tertiary" />}
        title={UNAVAILABLE_TITLE}
        description={visual.unavailableReason ?? UNAVAILABLE_BODY}
      />
    );
  }

  if (isWebglMissing) {
    return (
      <EmptyState
        icon={<MonitorOff className="text-text-tertiary" />}
        title={WEBGL_TITLE}
        description={WEBGL_BODY}
      />
    );
  }

  const isReady = visual.sceneFrame !== null && visual.sceneLevels.length > 0;

  /*
   * Trạng thái 3 — đang dựng. Khung xương, không phải màn trắng; và caption đi cùng ngay từ
   * lúc này để câu "đây là mô hình hiện tại" không đến sau khối 3D.
   */
  if (!isReady) {
    if (!visual.isBuilding) {
      return (
        <EmptyState
          icon={<Boxes className="text-text-tertiary" />}
          title={UNAVAILABLE_TITLE}
          description={visual.unavailableReason ?? UNAVAILABLE_BODY}
        />
      );
    }

    return (
      <figure className="flex flex-col gap-2">
        <Skeleton preset="canvas" aria-label={BUILDING_LABEL} role="status" />
        <figcaption className="text-[13px] leading-relaxed text-text-secondary">
          {visual.caption}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-bg-sunken">
        <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" />
        {visual.isBuilding ? (
          <div className="absolute inset-0">
            <Skeleton preset="canvas" aria-label={BUILDING_LABEL} role="status" />
          </div>
        ) : null}
      </div>
      <figcaption className="text-[13px] leading-relaxed text-text-secondary">
        {visual.caption}
      </figcaption>
    </figure>
  );
}
