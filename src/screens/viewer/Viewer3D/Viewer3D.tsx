/**
 * `Viewer3D` — view thuần cắm vào khe `renderScene` của `ViewerShell`.
 *
 * View thuần R-60: không nhập `@/api`, `@/store`, `@/domain`, `@/lib/http`.
 * Không tạo geometry/material three.js và không tự gọi vòng lặp vẽ — mọi thứ ở
 * đây là markup + CSS, đúng bảy trạng thái A11 theo
 * `docs/notes/viewer3d/shell-props-contract.md`.
 *
 * Vỏ (`ViewerViewport.tsx`) đã tự vẽ nền/mặt đất/chân trời và khung xương lúc
 * tải — file này không vẽ lại chúng khi cắm vào vỏ thật. Nhưng vì bài kiểm ở
 * đây dựng `Viewer3D` một mình (không qua vỏ, R-70 "test được chỉ từ props"),
 * nền/mặt đất token vẫn được vẽ ở đây để không trạng thái nào ra màn trắng khi
 * đứng độc lập — cùng ba token màu vỏ dùng (`bg-canvas-3d` v.v.), không phải
 * mã riêng.
 *
 * N2: `Viewer3DProps` không khai ở đây nữa — nhập kiểu từ `viewer3dTypes.ts`
 * (docblock ở đó giải thích vì sao gộp về một chỗ vẫn giữ được R-60). Import
 * chỉ-kiểu bị xoá trước khi ra bundle nên không kéo `@/domain` mà file kia
 * nhập vào view lúc chạy.
 */

import { Loader2 } from 'lucide-react';

import { getButtonStyles } from '@/components/ui/buttonVariants';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ViewerSceneActions, ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { ObjectSearch } from './ObjectSearch';
import type { Viewer3DProps } from './viewer3dTypes';

export type { Viewer3DProps };

/** Nền + mặt đất + chân trời một màu token, không gradient — dùng ở mọi trạng thái. */
function ViewerGround() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col">
      <div className="flex-1" />
      <div className="h-1/2 border-t border-canvas-3d-horizon bg-canvas-3d-ground" />
    </div>
  );
}

function EmptyContent({ qcHref }: { readonly qcHref: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="max-w-sm text-[14px] leading-relaxed text-text-secondary">
        Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường.
      </p>
      <a className={getButtonStyles({ variant: 'primary' })} href={qcHref}>
        Quay lại xem lớp tường
      </a>
    </div>
  );
}

function LoadingContent({
  storeyCount,
  buildProgressLabel,
}: {
  readonly storeyCount: number;
  readonly buildProgressLabel: string | null;
}) {
  return (
    <div
      className="relative z-10 flex h-full w-full items-center justify-center"
      role="status"
    >
      <div className="flex items-center gap-2 rounded-[8px] bg-bg-surface/90 px-4 py-2 text-[13px] text-text-secondary shadow-float">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        <span>
          Đang dựng mô hình {storeyCount} tầng
          {buildProgressLabel !== null ? ` — ${buildProgressLabel}` : '…'}
        </span>
      </div>
    </div>
  );
}

function StoreyBlock({
  storeyId,
  isReady,
  caption,
  onHover,
}: {
  readonly storeyId: string;
  readonly isReady: boolean;
  readonly caption: string;
  readonly onHover: (storeyId: string | null) => void;
}) {
  if (isReady) {
    return (
      <div
        className="rounded-[8px] bg-bg-surface/80 px-3 py-1.5 text-[13px] text-text-secondary transition-opacity duration-standard motion-reduce:transition-none"
        onMouseEnter={() => {
          onHover(storeyId);
        }}
        onMouseLeave={() => {
          onHover(null);
        }}
      >
        Tầng đã dựng xong
      </div>
    );
  }

  return (
    <div
      className="rounded-[8px] border-2 border-dashed border-border-default bg-bg-surface/60 px-3 py-1.5 text-[13px] text-text-secondary transition-opacity duration-standard motion-reduce:transition-none"
      onMouseEnter={() => {
        onHover(storeyId);
      }}
      onMouseLeave={() => {
        onHover(null);
      }}
    >
      {caption}
    </div>
  );
}

function PartialContent({
  frame,
  readyStoreyIds,
  wireframeCaptionOf,
  sceneActions,
}: {
  readonly frame: ViewerSceneFrame;
  readonly readyStoreyIds: readonly string[];
  readonly wireframeCaptionOf: (storeyId: string) => string;
  readonly sceneActions: ViewerSceneActions | undefined;
}) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 p-8">
      {frame.visibleStoreyIds.map((storeyId) => (
        <StoreyBlock
          caption={wireframeCaptionOf(storeyId)}
          isReady={readyStoreyIds.includes(storeyId)}
          key={storeyId}
          onHover={(hoveredId) => {
            sceneActions?.hoverEntity(hoveredId);
          }}
          storeyId={storeyId}
        />
      ))}
    </div>
  );
}

function ErrorContent({
  webglUnavailable,
  fallback2dHref,
  onRetryBuild,
}: {
  readonly webglUnavailable: boolean;
  readonly fallback2dHref: string;
  readonly onRetryBuild: () => void;
}) {
  const description = webglUnavailable
    ? 'Máy hoặc trình duyệt của bạn chưa bật được hình ảnh 3D. Thử lại, hoặc xem bản vẽ 2D trong lúc chờ.'
    : 'Không dựng được mô hình 3D lần này. Thử lại, hoặc quay lại lớp tường để xem dữ liệu còn thiếu gì.';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
      {webglUnavailable && (
        <h3 className="text-[16px] font-semibold text-text-primary">
          Trình duyệt này chưa xem được mô hình 3D
        </h3>
      )}
      <p className="max-w-sm text-[14px] leading-relaxed text-text-secondary">{description}</p>
      <div className="flex items-center gap-3">
        <Button onClick={onRetryBuild} variant="primary">
          Thử lại
        </Button>
        <a className={getButtonStyles({ variant: 'secondary' })} href={fallback2dHref}>
          Xem bản 2D
        </a>
      </div>
    </div>
  );
}

export function Viewer3D(props: Viewer3DProps) {
  const {
    state,
    frame,
    sceneActions,
    buildProgressLabel,
    readyStoreyIds,
    wireframeCaptionOf,
    webglUnavailable,
    fallback2dHref,
    qcHref,
    onRetryBuild,
    search,
    canvasRef,
  } = props;

  const isErrorLike = state === 'error' || webglUnavailable;

  return (
    <div
      aria-label="Nội dung mô hình 3D"
      className={cn('relative h-full w-full overflow-hidden bg-canvas-3d')}
      role="region"
    >
      <ViewerGround />

      {/* Mặt vẽ của module cảnh. Trên nền và mặt đất, dưới mọi lớp nội dung —
          nên card lỗi và câu trạng thái rỗng không bao giờ bị hình che. View
          không tạo geometry/material nào ở đây: nó chỉ giao phần tử canvas cho
          container qua callback ref. */}
      {canvasRef !== undefined && !isErrorLike && (
        <canvas aria-hidden="true" className="absolute inset-0 block h-full w-full" ref={canvasRef} />
      )}

      {state === 'empty' && <EmptyContent qcHref={qcHref} />}

      {state === 'loading' && (
        <LoadingContent
          buildProgressLabel={buildProgressLabel}
          storeyCount={frame.visibleStoreyIds.length}
        />
      )}

      {state === 'partial' && !isErrorLike && (
        <PartialContent
          frame={frame}
          readyStoreyIds={readyStoreyIds}
          sceneActions={sceneActions}
          wireframeCaptionOf={wireframeCaptionOf}
        />
      )}

      {isErrorLike && (
        <ErrorContent
          fallback2dHref={fallback2dHref}
          onRetryBuild={onRetryBuild}
          webglUnavailable={webglUnavailable}
        />
      )}

      {/* `pointer-events-none` KHÔNG phải chuyện gọn gàng — thiếu nó thì bấm
          chuột trong khung nhìn không chọn được gì, và đã đo bằng trình duyệt
          thật: hai khối dưới đây phủ kín khung nhìn, nằm SAU `<canvas>` trong
          DOM nên đứng trên nó khi dò trúng đích, và `document.elementFromPoint`
          ở giữa khung trả về đúng chúng chứ không trả về canvas. Bộ bắt tia gắn
          listener trên chính canvas (`viewer3dScene.ts`), nên cú bấm không bao
          giờ tới nơi. Cả hai khối chỉ chứa một câu cho trình đọc màn hình —
          chúng không có gì để nhận chuột. Quay và thu phóng vẫn chạy vì listener
          của chúng ở trên `<main>` và ăn theo bọt sự kiện. */}
      {(state === 'success' || state === 'collapsed') && !isErrorLike && (
        <div className="pointer-events-none relative flex h-full w-full items-center justify-center">
          <span className="sr-only">Mô hình 3D đã dựng xong.</span>
        </div>
      )}

      {state === 'forbidden' && !isErrorLike && (
        <div className="pointer-events-none relative flex h-full w-full items-center justify-center">
          <span className="sr-only">
            Bạn đang xem ở vai Người xem nên không sửa được hình học trên mô hình 3D.
          </span>
        </div>
      )}

      {/* Ô tìm phòng, vẽ ở MỌI trạng thái có phòng để tìm — kể cả `error` và
          `forbidden`. Tìm một phòng và đọc tên nó là việc của người XEM, không
          phải của người sửa, và một cảnh 3D không dựng được cũng không lấy đi
          quyền ấy. Trạng thái không có phòng nào thì `ObjectSearch` tự không vẽ
          gì. */}
      <ObjectSearch
        isOpen={search.isOpen}
        onClose={search.onClose}
        onOpen={search.onOpen}
        onSelectRoom={search.onSelectRoom}
        rooms={search.rooms}
        selectedRoomId={search.selectedRoomId}
      />
    </div>
  );
}
