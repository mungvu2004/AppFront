/**
 * `ExplodedView` — view thuần cắm vào khe `renderScene` của `ViewerShell`,
 * dựng lớp phủ tách tầng: canvas 3D, thang cao độ + hàng ba mức sẵn (mép
 * trái), thẻ nhãn tầng nổi (mép phải), đường nối dọc qua trọng tâm kèm vạch
 * cao độ, đường dẫn thẳng hàng, và nút chụp ảnh.
 *
 * View thuần R-60: không nhập `@/api`, `@/store`, `@/domain`, `@/lib/http`.
 * Mọi số đã là chuỗi định dạng sẵn trong {@link ExplodedViewProps} (A15); màn
 * này chỉ đọc `tone` để chọn màu, không tự suy màu từ con số (A1). Không tô
 * màu theo tầng — khoảng cách và đường nối là thứ truyền đạt sự tách.
 *
 * Khuôn chép từ `Viewer3D.tsx`: nền/mặt đất ba token vẽ ở đây để không trạng
 * thái nào ra màn trắng khi `ExplodedView` được test đứng một mình (R-70), và
 * các lớp phủ trạng thái dùng `relative h-full w-full` giống hệt cách
 * `EmptyContent`/`LoadingContent`/`ErrorContent` của file đó làm.
 *
 * Rail (thang + ba mức sẵn), thẻ tầng, và đường nối/thẳng hàng tách sang ba
 * file anh em (`ExplodedViewRail.tsx`, `ExplodedViewFloorCards.tsx`,
 * `ExplodedViewAlignmentPaths.tsx`) vì cộng lại vượt trần 400 dòng của R-22;
 * mỗi file có docblock riêng giải thích quyết định của phần đó.
 */
import { Camera } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { IconButton } from '@/components/ui/IconButton';

import { ExplodedViewAlignmentPaths } from './ExplodedViewAlignmentPaths';
import type { ExplodedViewProps } from './explodedViewTypes';
import { ExplodedViewFloorCards } from './ExplodedViewFloorCards';
import { ExplodedViewRail } from './ExplodedViewRail';

/** Nền + mặt đất + chân trời một màu token, dùng ở mọi trạng thái — cùng `Viewer3D.tsx`. */
function Ground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col">
      <div className="flex-1" />
      <div className="h-1/2 border-t border-canvas-3d-horizon bg-canvas-3d-ground" />
    </div>
  );
}

function EmptyMessage() {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-8 text-center">
      <p className="max-w-sm text-[14px] leading-relaxed text-text-secondary">
        Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.
      </p>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="relative flex h-full w-full items-center justify-center" role="status">
      <div className="flex items-center gap-2 rounded-[8px] bg-bg-surface/90 px-4 py-2 text-[13px] text-text-secondary shadow-float">
        <span>Đang tách các tầng...</span>
      </div>
    </div>
  );
}

function ErrorMessage() {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-8 text-center">
      <p className="max-w-sm text-[14px] leading-relaxed text-text-secondary">
        Không tách được các tầng lúc này. Vui lòng thử lại sau.
      </p>
    </div>
  );
}

export function ExplodedView(props: ExplodedViewProps) {
  const { state, actions, canvasRef } = props;

  const isEmpty = state === 'empty';
  const isError = state === 'error';
  const showControls = !isEmpty && !isError;

  return (
    <div aria-label="Nội dung tách tầng" className="relative h-full w-full overflow-hidden bg-canvas-3d" role="region">
      <Ground />

      {canvasRef !== undefined && !isError && (
        <canvas aria-hidden="true" className="absolute inset-0 block h-full w-full" ref={canvasRef} />
      )}

      {isEmpty && <EmptyMessage />}
      {state === 'loading' && <LoadingMessage />}
      {isError && <ErrorMessage />}

      {showControls && (
        <>
          <ExplodedViewAlignmentPaths alignmentPaths={props.alignmentPaths} ticks={props.ticks} />

          <ExplodedViewRail
            activePresetId={props.activePresetId}
            isCollapsed={props.isCollapsed}
            maxLabel={props.maxLabel}
            minLabel={props.minLabel}
            onPresetSelect={actions.onPresetSelect}
            onSeparationChange={actions.onSeparationChange}
            presets={props.presets}
            separation={props.separation}
          />

          <ExplodedViewFloorCards
            areLabelsVisible={props.areLabelsVisible}
            floors={props.floors}
            hoveredStoreyId={props.hoveredStoreyId}
            onFloorActivate={actions.onFloorActivate}
            onFloorHover={actions.onFloorHover}
            onFloorVisibilityToggle={actions.onFloorVisibilityToggle}
            reducedMotion={props.reducedMotion}
          />

          <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
            <IconButton
              aria-label="Chụp ảnh khung nhìn"
              disabled={props.isCapturing}
              icon={<Camera aria-hidden="true" className="h-[18px] w-[18px]" />}
              loading={props.isCapturing}
              onClick={actions.onCapture}
            />
            {props.captureError !== null && <InlineAlert level="violation" message={props.captureError} />}
          </div>
        </>
      )}

      {state === 'forbidden' && (
        <span className="sr-only">Bạn đang xem ở vai người xem nên không sửa được vị trí tầng.</span>
      )}

      <div aria-live="polite" className="sr-only">
        {props.liveMessage}
      </div>
    </div>
  );
}
