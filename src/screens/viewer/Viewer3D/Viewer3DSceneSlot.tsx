/**
 * Nội dung khe cắm cảnh của `Viewer3D` — hook cộng view cộng hai lớp phủ.
 *
 * Tách ra khỏi `Viewer3D.container.tsx` vì mục D: container đã vượt trần 400
 * dòng của R-22 sau khi sáu panel được gắn vào, và mục D nói phần con tách ra
 * file anh em còn `index.ts` giữ nguyên đường nhập — không nơi gọi nào phải sửa
 * theo. Cùng khuôn `ShareScreen/` và `AuthScreen/`.
 *
 * Tên file là `Viewer3DSceneSlot` chứ không `Viewer3DScene`: thư mục đã có
 * `viewer3dScene.ts` (module cảnh three.js), và trên Windows hai tên chỉ khác
 * nhau chữ hoa/thường là CÙNG một file — TypeScript báo TS1149 và bản dựng
 * hỏng. Đã đo, không phải lo xa.
 *
 * Props của file này KHÔNG mở rộng `Viewer3DContainerProps`: mở rộng nó sẽ bắt
 * file này nhập ngược lại container đã nhập nó, tức một vòng import mà
 * `pnpm cycles` bắt. Nên nó khai đúng những trường nó đọc, và container vẫn
 * trải cả bộ props xuống như cũ.
 */

import { useState } from 'react';

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { ColoringModeId } from '@/lib/coloring/modes';
import type { ViewerShellGateway } from '@/screens/viewer/ViewerShell';
import type {
  ViewerSceneActions,
  ViewerSceneFrame,
  ViewerScreenState,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';
import type { ProjectRole } from '@/types/project';

import { Viewer3D } from './Viewer3D';
import { Viewer3DOverlays } from './Viewer3DOverlays';
import { useViewer3D } from './useViewer3D';
import type { MountViewerScene, Viewer3DTelemetry } from './viewer3dTypes';

export interface Viewer3DSceneSlotProps {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[] | undefined;
  readonly coloringModeId?: ColoringModeId | undefined;
  readonly forceState?: ViewerScreenState | undefined;
  readonly telemetry?: Viewer3DTelemetry | undefined;
  readonly mountScene?: MountViewerScene | undefined;

  readonly frame: ViewerSceneFrame;
  readonly sceneActions: ViewerSceneActions | undefined;
  /** Đồ thị container đã chốt — ĐÚNG cái vỏ đang đọc. Xem "MỘT nguồn" ở container. */
  readonly resolvedSpatial: NormalizedSpatial | null;
  /** Cổng container đã chốt — cũng là cổng vỏ đang dùng. */
  readonly resolvedGateway: ViewerShellGateway;
  readonly isSearchOpen: boolean;
  readonly onOpenSearch: () => void;
  readonly onCloseSearch: () => void;
  /** Chế độ sửa hình học tường đang bật — lớp phủ của nó vẽ đè lên khung nhìn. */
  readonly isWallEditing: boolean;
  readonly onExitWallEditMode: () => void;
}

/**
 * Hook cộng view, không provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `ViewerShell.container.tsx:107-115`.
 */
export function Viewer3DSceneSlot(props: Viewer3DSceneSlotProps) {

  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const model = useViewer3D({
    projectId: props.projectId,
    canvas,
    frame: props.frame,
    // Đồ thị và cổng KHÔNG còn là chỗ tiêm có điều kiện: container đã chốt
    // chúng, và chốt một lần là cả điểm của mục "MỘT nguồn dữ liệu".
    spatial: props.resolvedSpatial,
    gateway: props.resolvedGateway,
    ...(props.sceneActions !== undefined ? { sceneActions: props.sceneActions } : {}),
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.forceState !== undefined ? { forceState: props.forceState } : {}),
    ...(props.coloringModeId !== undefined ? { coloringModeId: props.coloringModeId } : {}),
    ...(props.telemetry !== undefined ? { telemetry: props.telemetry } : {}),
    ...(props.mountScene !== undefined ? { mountScene: props.mountScene } : {}),
  });

  /* Hai lớp phủ là ANH EM của view, không nằm trong nó: `Viewer3D` là view
     thuần (R-60) và không được biết tới một container nào khác. Khung
     `relative` ở đây là thứ `absolute inset-0` của hai lớp ấy neo vào. */
  return (
    <div className="relative h-full w-full">
      <Viewer3D
        {...model}
        canvasRef={setCanvas}
        search={{
          ...model.search,
          isOpen: props.isSearchOpen,
          onOpen: props.onOpenSearch,
          onClose: props.onCloseSearch,
        }}
      />

      <Viewer3DOverlays
        isSectionOrthographic={props.frame.isOrthographic && props.frame.sectionPlane !== null}
        isWallEditing={props.isWallEditing}
        onExitWallEditMode={props.onExitWallEditMode}
        selectedWallIds={props.frame.selectedEntityIds}
        wallId={props.frame.selectedEntityIds[0] ?? null}
      />
    </div>
  );
}
