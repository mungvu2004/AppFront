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
 */

import { Loader2, Wrench } from 'lucide-react';

import { getButtonStyles } from '@/components/ui/buttonVariants';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type {
  ViewerSceneActions,
  ViewerSceneFrame,
  ViewerScreenState,
} from '@/screens/viewer/ViewerShell/viewerShellTypes';

export interface Viewer3DProps {
  /** Bảy trạng thái A11 — `ViewerSceneFrame` không mang trường này. */
  readonly state: ViewerScreenState;
  /** Điểm nhìn, tầng hiện, chọn/hover — vỏ cấp, tham số thứ nhất `renderScene`. */
  readonly frame: ViewerSceneFrame;
  /** Hai việc báo ngược lên vỏ. Tuỳ chọn để qua kiểu một tham số của container. */
  readonly sceneActions?: ViewerSceneActions | undefined;
  /** Phần trăm dựng thật của R-03, đã ghép chuỗi sẵn (A15). */
  readonly buildProgressLabel: string | null;
  /** Tầng đã dựng xong hình thật; còn lại vẽ khung dây. */
  readonly readyStoreyIds: readonly string[];
  /** Caption một câu cho một tầng khung dây, đã ghép sẵn (A15). */
  readonly wireframeCaptionOf: (storeyId: string) => string;
  /** Không có WebGL — phát hiện ngoài bảy trạng thái của vỏ. */
  readonly webglUnavailable: boolean;
  /** Liên kết sang bản 2D, cho card lỗi và cho trạng thái rỗng. */
  readonly fallback2dHref: string;
  /** Nút "sang QC" của trạng thái rỗng. */
  readonly qcHref: string;
  /** Thử lại bước dựng hình (khác `onRetry` của vỏ — vỏ retry truy vấn dự án). */
  readonly onRetryBuild: () => void;
  /** Vai đã lọc: được double-click chọn/sửa hình học hay chỉ xem. */
  readonly canEdit: boolean;
}

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

/** Chip nổi cho hành động sửa hình học — chỉ vẽ khi được phép (A2, không làm mờ). */
function EditAffordance() {
  return (
    <div className="absolute bottom-3 right-3">
      <Button
        aria-label="Sửa hình học đã chọn"
        onClick={() => {
          /* Chưa nối hành vi thật: khe cắm chưa có callback riêng cho việc sửa
             hình học (mục D của hợp đồng), chỉ khai điều kiện hiện/ẩn theo
             `canEdit`. Việc nối lệnh thật là của hook đi kèm màn nội dung. */
        }}
        size="sm"
        variant="secondary"
      >
        <Wrench aria-hidden="true" className="h-4 w-4" />
        Sửa hình học
      </Button>
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
    canEdit,
  } = props;

  const isErrorLike = state === 'error' || webglUnavailable;

  return (
    <div
      aria-label="Nội dung mô hình 3D"
      className={cn('relative h-full w-full overflow-hidden bg-canvas-3d')}
      role="region"
    >
      <ViewerGround />

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

      {(state === 'success' || state === 'collapsed') && !isErrorLike && (
        <div className="relative flex h-full w-full items-center justify-center">
          <span className="sr-only">Mô hình 3D đã dựng xong.</span>
        </div>
      )}

      {state === 'forbidden' && !isErrorLike && (
        <div className="relative flex h-full w-full items-center justify-center">
          <span className="sr-only">
            Bạn đang xem ở vai Người xem nên không sửa được hình học trên mô hình 3D.
          </span>
        </div>
      )}

      {canEdit && !isErrorLike && state !== 'empty' && state !== 'loading' && <EditAffordance />}
    </div>
  );
}
