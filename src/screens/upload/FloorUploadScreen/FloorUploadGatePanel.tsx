/**
 * Khung "Điều kiện để xử lý" — câu 3 của màn, đặt cạnh danh sách bản vẽ (ngoại lệ HOP-DONG-V6 §1:
 * điều kiện gắn với nội dung nên cổng nằm cạnh nội dung; thanh bước chỉ còn thanh + số, không nút).
 *
 * Ba điều kiện chặn + MỘT nút "Bắt đầu xử lý". Chưa đủ điều kiện thì nút là kiểu phụ nhưng KHÔNG bị
 * vô hiệu hoá: bấm thì `blockNotice` liệt kê tầng nào thiếu gì và trang cuộn tới tầng đầu tiên.
 * `isSubmitting` thì nút chuyển sang trạng thái chờ của chính `Button`.
 *
 * Bộ đếm "3 / 4 tầng đã có bản vẽ" là chữ của điều kiện đầu: chỉ vế "đã xong" chạy số khi đổi, tổng
 * và chữ cắt ra từ `counterLabel` của hook (A15). Trình đọc màn hình nghe giá trị cuối qua vùng sống.
 */

import { AlertTriangle, ArrowRight, Check, Circle } from 'lucide-react';

import { Section } from '@/components/shell/Section';
import { Button } from '@/components/ui/Button';
import { useCountUp, type UseCountUpOptions } from '@/hooks/useCountUp';

import type { UploadGate, UploadGateCondition } from './floorUploadGate';
import type { FloorUploadBlockNotice, FloorUploadFooterModel } from './types';

/** Mã cho test bám vào danh sách lý do. */
export const BLOCK_NOTICE_TEST_ID = 'floor-upload-block-notice';

/** Mã cho test bám vào con số đang chạy. */
export const COUNTER_NUMBER_TEST_ID = 'floor-upload-counter-number';

/** `id` của khung — đích cuộn của các lối "tới điều kiện". */
export const GATE_PANEL_ID = 'dieu-kien-xu-ly';

const TITLE_READY = 'Sẵn sàng xử lý';
const TITLE_PENDING = 'Điều kiện để xử lý';
const LABEL_ELEVATION = 'Đủ cao độ sàn';
const LABEL_OVERLAP = 'Không trùng cao độ';
const LABEL_SHOW_FLOOR = 'Tới';
const LABEL_FIX_IN_FLOORS = 'Sửa ở Quản lý tầng';
const WARNING_TITLE = 'Đúng tầng';
const WARNING_TAG = 'khuyến nghị';
const AI_LINE = 'Ở bước Xử lý, AI tìm tường, cửa, phòng và kích thước. Tỷ lệ được kiểm ở bước đó.';

/** Một tầng là một tầng: không phần lẻ, không dấu chấm nhóm nghìn (cùng tuỳ chọn với `counterLabel`). */
const COUNTER_FORMAT: UseCountUpOptions = Object.freeze({
  format: { fractionDigits: 0, grouping: false },
});

/** Chỗ cắt `"3 / 4 tầng đã có bản vẽ"` thành con số chạy và phần đứng yên. */
const COUNTER_SEPARATOR = ' / ';

export interface FloorUploadGatePanelProps {
  readonly gate: UploadGate;
  readonly footer: FloorUploadFooterModel;
  readonly blockNotice: FloorUploadBlockNotice | null;
  readonly onSubmit: () => void;
  /** Cuộn tới thẻ của một tầng — lối sửa của điều kiện "bản vẽ". */
  readonly onShowFloor: (floorId: string) => void;
  /** Tới Quản lý tầng — lối sửa của cao độ. Vắng khi không sửa được. */
  readonly onOpenFloors?: (() => void) | undefined;
}

function Counter({ footer }: { readonly footer: FloorUploadFooterModel }) {
  // Chạy khi ĐỔI, không chạy lúc HIỆN RA: `NaN` lúc chưa có tầng xoá giá trị đang hiện, nên con số
  // đầu tiên hiện thẳng; mỗi lần đổi sau đó mới chạy, từ con số người đọc đang nhìn.
  const hasCounter = footer.totalCount > 0;
  const done = useCountUp(hasCounter ? footer.doneCount : Number.NaN, {
    ...COUNTER_FORMAT,
    from: footer.doneCount,
  });
  const counterTail = footer.counterLabel.slice(footer.counterLabel.indexOf(COUNTER_SEPARATOR));

  return (
    <>
      <span aria-hidden="true" data-testid={COUNTER_NUMBER_TEST_ID}>
        {hasCounter ? (
          <>
            {done.text}
            {counterTail}
          </>
        ) : (
          footer.counterLabel
        )}
      </span>
      <span className="sr-only" role="status">
        {footer.counterLabel}
      </span>
    </>
  );
}

function ConditionRow({
  condition,
  footer,
  onShowFloor,
  onOpenFloors,
}: {
  readonly condition: UploadGateCondition;
  readonly footer: FloorUploadFooterModel;
  readonly onShowFloor: (floorId: string) => void;
  readonly onOpenFloors?: (() => void) | undefined;
}) {
  const { reason } = condition;
  const fix =
    reason === null
      ? null
      : condition.id === 'drawings'
        ? reason.floorId === ''
          ? null
          : { label: `${LABEL_SHOW_FLOOR} ${reason.floorName}`, onClick: () => onShowFloor(reason.floorId) }
        : onOpenFloors === undefined
          ? null
          : { label: LABEL_FIX_IN_FLOORS, onClick: onOpenFloors };

  return (
    <li className="flex gap-2">
      {condition.done ? (
        <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-state-verified-text" />
      ) : (
        <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-body text-text-primary">
          {condition.id === 'drawings' ? (
            <Counter footer={footer} />
          ) : condition.id === 'elevation' ? (
            LABEL_ELEVATION
          ) : (
            LABEL_OVERLAP
          )}
          <span className="sr-only">{condition.done ? ': đã đạt' : ': chưa đạt'}</span>
        </p>
        {reason !== null && (
          <p className="text-body-sm text-text-secondary">
            {reason.sentence}
            {fix !== null && (
              <>
                {' '}
                <button
                  className="rounded-sm text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  onClick={fix.onClick}
                  type="button"
                >
                  {fix.label}
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

export function FloorUploadGatePanel({
  gate,
  footer,
  blockNotice,
  onSubmit,
  onShowFloor,
  onOpenFloors,
}: FloorUploadGatePanelProps) {
  const title = gate.isReady ? TITLE_READY : `${TITLE_PENDING} · ${String(gate.doneCount)}/${String(gate.total)}`;

  return (
    <Section id={GATE_PANEL_ID} title={title}>
      <div className="flex flex-col gap-4">
        <ul aria-label={TITLE_PENDING} className="flex flex-col gap-3">
          {gate.conditions.map((condition) => (
            <ConditionRow
              condition={condition}
              footer={footer}
              key={condition.id}
              onOpenFloors={onOpenFloors}
              onShowFloor={onShowFloor}
            />
          ))}
        </ul>

        {/* Cảnh báo không đếm vào n/3 và không chặn nút: icon tam giác + "khuyến nghị". */}
        {gate.unconfirmedCount > 0 && (
          <div className="flex gap-2 border-t border-border-default pt-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-state-attention-text" />
            <p className="text-body-sm text-text-secondary">
              <span className="text-body text-text-primary">{WARNING_TITLE}</span>{' '}
              <span className="text-caption text-text-secondary">{WARNING_TAG}</span>
              <br />
              {`${String(gate.unconfirmedCount)} tầng có tệp ghép theo tên tệp. Xem lại ảnh rồi đánh dấu đã xác nhận.`}
            </p>
          </div>
        )}

        {blockNotice !== null && (
          <div
            className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg bg-state-attention-tint p-3"
            data-testid={BLOCK_NOTICE_TEST_ID}
            role="alert"
          >
            <p className="text-body-sm font-medium text-state-attention-text">{blockNotice.title}</p>
            <ul className="flex flex-col gap-1">
              {blockNotice.reasons.map((reason) => (
                <li className="text-body-sm text-text-secondary" key={`${reason.floorId}-${reason.kind}`}>
                  {reason.sentence}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Người xem không bắt đầu được lượt xử lý; câu "chỉ được xem" đầu màn đã nói vì sao (BUG-536). */}
        {!footer.isSubmitHidden && (
          <Button
            className="w-full"
            {...(gate.isReady ? { iconAfter: <ArrowRight aria-hidden="true" /> } : {})}
            loading={footer.isSubmitting}
            onClick={onSubmit}
            type="button"
            variant={gate.isReady ? 'primary' : 'secondary'}
          >
            {footer.submitLabel}
          </Button>
        )}

        <p className="border-t border-border-default pt-3 text-body-sm text-text-secondary">{AI_LINE}</p>
      </div>
    </Section>
  );
}
