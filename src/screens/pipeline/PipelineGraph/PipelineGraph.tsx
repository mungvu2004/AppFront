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
 * Nội dung 1280 căn giữa trên nền `--bg-app` (lề 80 ở 1440). Trên cùng là PageHead: eyebrow,
 * H1, chip + câu trạng thái (`overview.reasonLine`). Mỗi phần một khung `Section`. Dưới đó là chế độ **Tổng quan** — sơ đồ khối, bảng so sánh hai nhánh, dẫn
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
 * | `empty`     | `EmptyState` trong khung trước sơ đồ; nhánh nào cũng nét đứt     |
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
import {
  BACK_TO_PROJECTS_LABEL,
  PROJECT_NOT_FOUND_DESCRIPTION,
  PROJECT_NOT_FOUND_TITLE,
} from '@/components/feedback/ProjectSpatialGate';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import { PipelineGraphDetail } from './PipelineGraphDetail';
import { PipelineGraphOverview } from './PipelineGraphOverview';
import { PIPELINE_GRAPH_TEXT } from './pipelineGraphText';
import type { PipelineGraphProps, PipelineOverviewViewModel } from './types';

const BREADCRUMB_PROJECTS = 'Dự án';

/** Bao nhiêu khung xương lúc chưa biết nhánh nào đã chạy. */
const SKELETON_ROW_COUNT = 3;

/**
 * Chip trạng thái của PageHead — sinh từ CÙNG `overview.branches` mà sơ đồ dùng để tô
 * viền nhánh (một nguồn trạng thái, NGUYEN-TAC-BO-CUC §1). Câu đi kèm là `reasonLine`.
 */
function StatusChip({ overview, isRunning }: { overview: PipelineOverviewViewModel; isRunning: boolean }) {
  const failed = overview.branches.find((branch) => branch.hasFailed);
  const active = overview.branches.find((branch) => branch.isActive);

  if (failed !== undefined) {
    return <Badge variant="violation">{PIPELINE_GRAPH_TEXT.chipFailed}</Badge>;
  }
  if (isRunning) {
    return <Badge variant="attention">{PIPELINE_GRAPH_TEXT.chipRunning}</Badge>;
  }
  return <Badge variant="neutral">{active === undefined ? PIPELINE_GRAPH_TEXT.chipNotRun : active.label}</Badge>;
}

/**
 * Đầu màn: đường dẫn + PageHead ba câu (làm gì / trạng thái / bước tiếp nằm ở khối dưới).
 * Breadcrumb chung: cấp "Dự án" bấm được về danh sách (BUG-546), nav mang tên "Đường dẫn
 * trang" chứ không trùng tên nhóm sơ đồ (BUG-558).
 */
function PipelineGraphHeader({ actions, model }: PipelineGraphProps) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        items={[
          { id: 'projects', label: BREADCRUMB_PROJECTS, onClick: actions.onBackToProjects },
          ...(model.projectName !== undefined ? [{ id: 'project', label: model.projectName }] : []),
          { id: 'pipeline-graph', label: model.title },
        ]}
      />
      <PageHead
        className="mb-0"
        eyebrow={PIPELINE_GRAPH_TEXT.eyebrow}
        status={
          model.state === 'loading' ? undefined : (
            <>
              <StatusChip isRunning={model.state === 'partial'} overview={model.overview} />
              <span>{model.overview.reasonLine}</span>
            </>
          )
        }
        title={PIPELINE_GRAPH_TEXT.heading}
      />
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
    <Section>
      <div className="flex flex-col gap-4">
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
      </div>
    </Section>
  );
}

/** Màn Sơ đồ xử lý như một hàm của props (mục D) — test và story dựng thẳng cái này. */
export function PipelineGraph({ actions, model }: PipelineGraphProps) {
  const { alert } = model;

  // Dự án không tồn tại: một câu, một lối ra — như màn Tầng, Chất lượng (BUG-313).
  if (model.isProjectMissing === true) {
    return (
      <div className="min-h-screen bg-bg-app">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-6 p-8">
          <InlineAlert
            action={{ label: BACK_TO_PROJECTS_LABEL, onClick: actions.onBackToProjects }}
            level="violation"
            message={PROJECT_NOT_FOUND_DESCRIPTION}
            title={PROJECT_NOT_FOUND_TITLE}
          />
        </div>
      </div>
    );
  }

  const isCompact = model.isCompact || model.state === 'collapsed';

  const body =
    model.state === 'loading' ? (
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => (
          <Skeleton key={index} preset="table-row" />
        ))}
      </div>
    ) : (
      <div className="flex flex-col gap-6">
        {/* Rỗng: khối "việc tiếp" đứng trước sơ đồ; sơ đồ vẫn vẽ đủ, nhánh nào cũng nét đứt. */}
        {model.state === 'empty' ? (
          <Section>
            <EmptyState
              description={PIPELINE_GRAPH_TEXT.emptyDescription}
              headingLevel="h2"
              icon={<Workflow aria-hidden="true" />}
              title={PIPELINE_GRAPH_TEXT.emptyTitle}
            />
          </Section>
        ) : null}

        <PipelineGraphOverview
          isCompact={isCompact}
          onConfirmSwitchBranch={actions.onConfirmSwitchBranch}
          onDismissSwitchBranch={actions.onDismissSwitchBranch}
          onRequestSwitchBranch={actions.onRequestSwitchBranch}
          overview={model.overview}
          prefersReducedMotion={model.prefersReducedMotion}
        />

        {model.state === 'empty' ? null : <PipelineGraphDisclosure actions={actions} model={model} />}
      </div>
    );

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-8 py-8 xl:px-20">
        <PipelineGraphHeader actions={actions} model={model} />

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
