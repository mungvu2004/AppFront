/**
 * Màn Sơ đồ xử lý (`PipelineGraph`) — khung của route
 * `ROUTE_PATTERNS.projectPipelineGraph`.
 *
 * View THUẦN (mục D, R-60): chỉ nhận props và vẽ. Không chạm một tầng dữ liệu
 * nào. Mọi câu tiếng Việt và mọi con số đã định dạng xong ở hook — file này
 * không gọi `toFixed`, không `toLocaleString`, không quy đổi đơn vị (A15).
 *
 * ## Bố cục
 *
 * Nội dung 1080 căn giữa trên nền `--bg-app`. Trên cùng là tiêu đề và câu dẫn.
 * Dưới đó là chế độ **Tổng quan** — sơ đồ khối, bảng so sánh hai nhánh, dẫn
 * chứng theo tầng — rồi một khối gấp mở chế độ **Chi tiết kỹ thuật**.
 *
 * Khối gấp là `button` + vùng nội dung có `aria-controls`, không phải
 * `<details>`: trạng thái mở nằm ở hook (`model.mode`) chứ không ở DOM, nên
 * story dựng thẳng được chế độ chi tiết mà không phải bấm gì, và chuyển động
 * 180 ms có chỗ để gắn.
 *
 * ## Bảy trạng thái (A11)
 *
 * | `state`     | thân màn                                                        |
 * |-------------|-----------------------------------------------------------------|
 * | `loading`   | ba khung xương, chưa vẽ sơ đồ                                    |
 * | `empty`     | sơ đồ vẽ mờ, cộng `EmptyState` nói chưa có lượt xử lý nào        |
 * | `partial`   | đầy đủ; `partialNoticeLine` nói xử lý vẫn tiếp tục               |
 * | `error`     | đầy đủ, cộng `InlineAlert` kèm mã kỹ thuật ở đầu màn             |
 * | `success`   | đầy đủ                                                           |
 * | `forbidden` | chỉ Tổng quan; khối gấp và nút đổi nhánh biến mất, kèm một câu    |
 * | `collapsed` | sơ đồ xếp dọc thành danh sách bước                               |
 *
 * Không nhánh nào trả `null`: tiêu đề, câu dẫn và sơ đồ luôn được vẽ, nên màn
 * trắng — thất bại duy nhất A11 tồn tại để chặn — không có chỗ xảy ra.
 */

import { Workflow } from 'lucide-react';
import { clsx } from 'clsx';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';

import { PipelineGraphDetail } from './PipelineGraphDetail';
import { PipelineGraphOverview } from './PipelineGraphOverview';
import { PIPELINE_GRAPH_TEXT } from './pipelineGraphText';
import type { PipelineGraphProps } from './types';

const BREADCRUMB_PROJECTS = 'Dự án';

/** Bao nhiêu khung xương lúc chưa biết nhánh nào đã chạy. */
const SKELETON_ROW_COUNT = 3;

/** Sơ đồ ở trạng thái rỗng vẽ mờ, không biến mất. */
const EMPTY_DIAGRAM_OPACITY = 0.4;

/** Đầu màn: đường dẫn, tiêu đề, câu dẫn. */
function PipelineGraphHeader({ model }: Pick<PipelineGraphProps, 'model'>) {
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label={PIPELINE_GRAPH_TEXT.title} className="text-[13px] text-text-secondary">
        <span>{BREADCRUMB_PROJECTS}</span>
        <span aria-hidden="true"> › </span>
        <span className="text-text-primary">{model.title}</span>
      </nav>
      <h1 className="text-[20px] font-medium text-text-primary">{model.title}</h1>
      <p className="max-w-[680px] text-[14px] text-text-secondary">{model.leadLine}</p>
    </div>
  );
}

/** Khối gấp mở chế độ chi tiết — chỉ dựng khi người xem có quyền. */
function PipelineGraphDisclosure({ actions, model }: PipelineGraphProps) {
  if (model.detail === undefined || model.detailDisclosureLabel === undefined) {
    return model.forbiddenLine === undefined ? null : (
      <p className="text-[13px] text-text-secondary">{model.forbiddenLine}</p>
    );
  }

  const isOpen = model.mode === 'detail';

  return (
    <section className="flex flex-col gap-4 border-t border-border-default pt-6">
      <div className="self-start">
        <Button
          aria-controls="pipeline-graph-detail"
          aria-expanded={isOpen}
          onClick={() => {
            actions.onModeChange(isOpen ? 'overview' : 'detail');
          }}
          size="sm"
          variant="secondary"
        >
          {model.detailDisclosureLabel}
        </Button>
      </div>

      <div
        className={clsx(
          'transition-opacity duration-180 ease-enter',
          isOpen ? 'opacity-100' : 'opacity-0',
        )}
        hidden={!isOpen}
        id="pipeline-graph-detail"
      >
        {isOpen ? (
          <PipelineGraphDetail
            detail={model.detail}
            isCompact={model.isCompact || model.state === 'collapsed'}
            onPanGraph={actions.onPanGraph}
            onRequestRerun={actions.onRequestRerun}
            onResetViewport={actions.onResetViewport}
            onSelectNode={actions.onSelectNode}
            onToggleKeepApproved={actions.onToggleKeepApproved}
            onToggleLog={actions.onToggleLog}
            onConfirmRerun={actions.onConfirmRerun}
            onDismissRerun={actions.onDismissRerun}
            onZoomGraph={actions.onZoomGraph}
            prefersReducedMotion={model.prefersReducedMotion}
          />
        ) : null}
      </div>
    </section>
  );
}

/** Màn Sơ đồ xử lý như một hàm của props (mục D) — test và story dựng thẳng cái này. */
export function PipelineGraph({ actions, model }: PipelineGraphProps) {
  const { alert } = model;
  const isCompact = model.isCompact || model.state === 'collapsed';

  const body =
    model.state === 'loading' ? (
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => (
          <Skeleton key={index} preset="table-row" />
        ))}
      </div>
    ) : (
      <div className="flex flex-col gap-8">
        <div style={model.state === 'empty' ? { opacity: EMPTY_DIAGRAM_OPACITY } : undefined}>
          <PipelineGraphOverview
            isCompact={isCompact}
            onConfirmSwitchBranch={actions.onConfirmSwitchBranch}
            onDismissSwitchBranch={actions.onDismissSwitchBranch}
            onRequestSwitchBranch={actions.onRequestSwitchBranch}
            overview={model.overview}
            prefersReducedMotion={model.prefersReducedMotion}
          />
        </div>

        {model.state === 'empty' ? (
          <EmptyState
            description={PIPELINE_GRAPH_TEXT.emptyDescription}
            icon={<Workflow aria-hidden="true" />}
            title={PIPELINE_GRAPH_TEXT.emptyTitle}
          />
        ) : (
          <PipelineGraphDisclosure actions={actions} model={model} />
        )}
      </div>
    );

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-6 p-8">
        <PipelineGraphHeader model={model} />

        {alert !== undefined ? (
          <div className="flex flex-col gap-2">
            <InlineAlert
              action={{ label: alert.retryLabel, onClick: actions.onRetry }}
              level="violation"
              message={alert.message}
              title={alert.title}
            />
            <code className="font-mono text-[12px] font-medium text-text-muted">
              {alert.technicalCode}
            </code>
          </div>
        ) : null}

        {body}

        {model.partialNoticeLine !== undefined ? (
          <p className="text-[13px] text-text-secondary">{model.partialNoticeLine}</p>
        ) : null}
      </div>
    </div>
  );
}
