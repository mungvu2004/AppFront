/**
 * Chế độ Tổng quan — mặc định, cho mọi người dùng.
 *
 * Đây là **màn tạo niềm tin, không phải màn điều khiển**: nó trả lời "hồ sơ này
 * đi nhánh nào, và vì sao", rồi dừng ở đó. Không một tên thư viện kỹ thuật nào
 * được xuất hiện trong file này (mục [CẤM TUYỆT ĐỐI]) — chúng sống ở
 * `PipelineGraphDetail.tsx`.
 *
 * ## Sơ đồ vẽ tay, không thư viện đồ thị
 *
 * Khối là `div` thật nên chữ trong khối đọc được bằng trình đọc màn hình và
 * kiểm được bằng `expectVietnamese`; **cạnh** là `polyline` 1px trong một lớp
 * `svg` nằm dưới, một màu duy nhất lấy từ `currentColor` của token
 * `--border-default`. Không `d3`, không `reactflow`, không màu biểu đồ.
 *
 * ## Nhánh đang dùng
 *
 * Viền đậm cộng một badge trung tính. Nhánh không dùng chỉ **mờ đi**, giữ nguyên
 * màu — bất biến A4 nói có đúng ba màu trạng thái, và "không được chọn" không
 * phải một trong ba.
 */

import { clsx } from 'clsx';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';

import { PIPELINE_GRAPH_TEXT } from './pipelineGraphText';
import type {
  PipelineOverviewBlockViewModel,
  PipelineOverviewViewModel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Kích thước sơ đồ — khối rộng 200, bo 12, đệm 16, viền mảnh.                  */
/* -------------------------------------------------------------------------- */

const BLOCK_WIDTH = 200;
const BLOCK_HEIGHT = 76;
const COLUMN_STEP = 272;
const ROW_STEP = 96;
const DIAGRAM_WIDTH = COLUMN_STEP * 3 + BLOCK_WIDTH;

/**
 * `BLOCK_HEIGHT` là chiều cao ĐỂ NEO CẠNH, không phải chiều cao thật của khối:
 * câu phụ xuống hai dòng thì khối cao hơn. Vùng vẽ vì thế chừa thêm một khoảng
 * cho hàng cuối — đủ cho hai dòng câu phụ cộng một badge — nếu không khối ở
 * hàng 2 bị cắt mất chân.
 */
const BLOCK_OVERFLOW = 64;
const DIAGRAM_HEIGHT = ROW_STEP * 2 + BLOCK_HEIGHT + BLOCK_OVERFLOW;

/**
 * Ô của bảng so sánh chứa một CÂU, không phải một con số.
 *
 * `Table.Cell` mặc định là `h-10 whitespace-nowrap align-middle` — đúng cho bảng
 * dữ liệu, sai ở đây: câu dài bị cắt mất đuôi thay vì xuống dòng.
 */
const COMPARISON_CELL = 'h-auto whitespace-normal py-2 align-top';

/** Nhánh không được chọn mờ đi, không đổi màu. */
const INACTIVE_BRANCH_OPACITY = 0.55;

const blockX = (block: PipelineOverviewBlockViewModel): number => block.column * COLUMN_STEP;
const blockY = (block: PipelineOverviewBlockViewModel): number => block.row * ROW_STEP;

export interface PipelineGraphOverviewProps {
  readonly overview: PipelineOverviewViewModel;
  readonly isCompact: boolean;
  readonly prefersReducedMotion: boolean;
  readonly onRequestSwitchBranch: () => void;
  readonly onConfirmSwitchBranch: () => void;
  readonly onDismissSwitchBranch: () => void;
}

/** Cạnh nối hai khối: ra khỏi cạnh phải, gặp nhau ở nửa khoảng, vào cạnh trái. */
function OverviewEdges({ blocks }: { blocks: readonly PipelineOverviewBlockViewModel[] }) {
  const byId = new Map(blocks.map((block) => [block.id, block]));

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 text-border-default"
      height={DIAGRAM_HEIGHT}
      viewBox={`0 0 ${String(DIAGRAM_WIDTH)} ${String(DIAGRAM_HEIGHT)}`}
      width={DIAGRAM_WIDTH}
    >
      {blocks.flatMap((block) =>
        block.edgeTargets.map((targetId) => {
          const target = byId.get(targetId);

          if (target === undefined) {
            return null;
          }

          const x1 = blockX(block) + BLOCK_WIDTH;
          const y1 = blockY(block) + BLOCK_HEIGHT / 2;
          const x2 = blockX(target);
          const y2 = blockY(target) + BLOCK_HEIGHT / 2;
          const midX = (x1 + x2) / 2;

          return (
            <polyline
              fill="none"
              key={`${block.id}-${targetId}`}
              points={`${String(x1)},${String(y1)} ${String(midX)},${String(y1)} ${String(midX)},${String(y2)} ${String(x2)},${String(y2)}`}
              stroke="currentColor"
              strokeWidth={1}
            />
          );
        }),
      )}
    </svg>
  );
}

/** Một khối của sơ đồ. Nhánh đang dùng có viền đậm và badge. */
function OverviewBlock({
  block,
  isActiveBranch,
  isDimmed,
  hasFailed,
  isAbsolute,
}: {
  block: PipelineOverviewBlockViewModel;
  isActiveBranch: boolean;
  isDimmed: boolean;
  hasFailed: boolean;
  isAbsolute: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col justify-center gap-1 rounded-[12px] bg-bg-surface p-4',
        isAbsolute ? 'absolute' : 'relative w-full',
        hasFailed
          ? 'border-2 border-state-violation'
          : isActiveBranch
            ? 'border-2 border-text-primary'
            : 'border border-border-default',
      )}
      style={{
        ...(isAbsolute
          ? {
              left: blockX(block),
              top: blockY(block),
              width: BLOCK_WIDTH,
              minHeight: BLOCK_HEIGHT,
            }
          : {}),
        ...(isDimmed ? { opacity: INACTIVE_BRANCH_OPACITY } : {}),
      }}
    >
      <span className="text-[14px] text-text-primary">{block.label}</span>
      {isActiveBranch ? (
        <span className="flex">
          <Badge variant="neutral">{PIPELINE_GRAPH_TEXT.activeBadge}</Badge>
        </span>
      ) : null}
      <span className="text-[12px] text-text-secondary">{block.caption}</span>
    </div>
  );
}

/** Nút đổi nhánh, cộng cảnh báo ngay tại chỗ. Esc đóng lớp xác nhận (A12). */
function SwitchBranchAction({
  onConfirmSwitchBranch,
  onDismissSwitchBranch,
  onRequestSwitchBranch,
  overview,
}: Pick<
  PipelineGraphOverviewProps,
  'onConfirmSwitchBranch' | 'onDismissSwitchBranch' | 'onRequestSwitchBranch' | 'overview'
>) {
  const action = overview.switchAction;

  if (action === undefined) {
    return null;
  }

  if (!action.isConfirming) {
    return (
      <Button onClick={onRequestSwitchBranch} size="sm" variant="secondary">
        {action.label}
      </Button>
    );
  }

  return (
    <div
      aria-label={action.warningTitle}
      className="flex flex-col gap-2 rounded-[8px] border border-danger-border bg-danger-tint p-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onDismissSwitchBranch();
        }
      }}
      role="group"
    >
      <span className="text-[13px] font-medium text-state-violation-text">
        {action.warningTitle}
      </span>
      <span className="text-[13px] text-text-primary">{action.warningMessage}</span>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirmSwitchBranch} size="sm" variant="danger">
          {action.confirmLabel}
        </Button>
        <Button onClick={onDismissSwitchBranch} size="sm" variant="ghost">
          {action.dismissLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Bảng so sánh hai nhánh: bốn dòng, mỗi ô một câu ngắn, không biểu tượng màu.
 *
 * `Table.Root` đã dựng sẵn `<table>` bên trong một `div` cuộn được, nên phần
 * dưới đây là NỘI DUNG của bảng đó — thêm một `<table>` nữa là lồng bảng trong
 * bảng. `<caption>` đứng đầu và là tên có thể tiếp cận của bảng.
 *
 * Hàng là `tr` trần chứ không phải `Table.Row`: bản dùng chung đó tắt viền tiêu
 * điểm mặc định mà không thay bằng cái khác, nên `expectAccessible` báo hỏng bốn
 * lần (A12). Hàng ở đây là nội dung tĩnh, không chọn được, nên không cần một
 * trong hai thứ đó. Sửa `Table.Row` là việc của tầng component, ngoài phạm vi
 * màn (R-68).
 */
function ComparisonTable({ overview }: Pick<PipelineGraphOverviewProps, 'overview'>) {
  if (overview.comparisonRows.length === 0) {
    return null;
  }

  return (
    <Table.Root>
      <caption className="pb-2 text-left text-[14px] text-text-primary">
        {PIPELINE_GRAPH_TEXT.comparisonCaption}
      </caption>
      <Table.Header>
        <tr>
          <Table.Head scope="col">{PIPELINE_GRAPH_TEXT.comparisonAspectHeader}</Table.Head>
          <Table.Head scope="col">{PIPELINE_GRAPH_TEXT.branchLabels.cad}</Table.Head>
          <Table.Head scope="col">{PIPELINE_GRAPH_TEXT.branchLabels.ai}</Table.Head>
        </tr>
      </Table.Header>
      <Table.Body>
        {overview.comparisonRows.map((row) => (
          <tr className="border-b border-border-default last:border-b-0" key={row.id}>
            <Table.Cell className={COMPARISON_CELL}>{row.label}</Table.Cell>
            <Table.Cell className={COMPARISON_CELL}>{row.cadText}</Table.Cell>
            <Table.Cell className={COMPARISON_CELL}>{row.aiText}</Table.Cell>
          </tr>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

/** Dẫn chứng theo tầng — P-03 đổi dữ liệu nhánh thành từng dòng ở hook. */
function EvidenceList({ overview }: Pick<PipelineGraphOverviewProps, 'overview'>) {
  if (overview.evidenceRows.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[14px] text-text-primary">{PIPELINE_GRAPH_TEXT.evidenceCaption}</h2>
      <ul className="flex flex-col">
        {overview.evidenceRows.map((row) => (
          <li
            className="flex flex-col gap-0.5 border-b border-border-default py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-3"
            key={row.id}
          >
            <span className="min-w-[96px] text-[13px] text-text-primary">{row.floorLabel}</span>
            <span className="text-[13px] text-text-secondary">{row.sentence}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PipelineGraphOverview(props: PipelineGraphOverviewProps) {
  const { isCompact, overview } = props;
  const activeBranchId = overview.branches.find((branch) => branch.isActive)?.id;
  const failedBranchIds = new Set(
    overview.branches.filter((branch) => branch.hasFailed).map((branch) => branch.id),
  );

  const describeBlock = (
    block: PipelineOverviewBlockViewModel,
  ): { isActiveBranch: boolean; isDimmed: boolean; hasFailed: boolean } => ({
    isActiveBranch: block.branch !== undefined && block.branch === activeBranchId,
    isDimmed:
      block.branch !== undefined && activeBranchId !== undefined && block.branch !== activeBranchId,
    hasFailed: block.branch !== undefined && failedBranchIds.has(block.branch),
  });

  return (
    <div className="flex flex-col gap-6">
      {isCompact ? (
        <ol aria-label={PIPELINE_GRAPH_TEXT.title} className="flex flex-col gap-3">
          {overview.blocks.map((block) => (
            <li key={block.id}>
              <OverviewBlock block={block} isAbsolute={false} {...describeBlock(block)} />
            </li>
          ))}
        </ol>
      ) : (
        <div
          aria-label={PIPELINE_GRAPH_TEXT.title}
          className="relative overflow-x-auto"
          role="group"
          style={{ height: DIAGRAM_HEIGHT }}
        >
          <OverviewEdges blocks={overview.blocks} />
          {overview.blocks.map((block) => (
            <OverviewBlock block={block} isAbsolute key={block.id} {...describeBlock(block)} />
          ))}
        </div>
      )}

      <p className="max-w-[680px] text-[14px] text-text-primary">{overview.reasonLine}</p>

      <ComparisonTable overview={overview} />
      <EvidenceList overview={overview} />

      {/* `self-start`: cột dọc kéo con của nó rộng hết khung, mà nút thì không
          nên rộng 1080. */}
      <div className="self-start">
        <SwitchBranchAction
          onConfirmSwitchBranch={props.onConfirmSwitchBranch}
          onDismissSwitchBranch={props.onDismissSwitchBranch}
          onRequestSwitchBranch={props.onRequestSwitchBranch}
          overview={overview}
        />
      </div>
    </div>
  );
}
