/**
 * Hai khối nói ra tiến độ CÒN LẠI sau khi một bước hỏng: dải tầng và khối "Kết
 * quả đã có".
 *
 * Cả hai đứng ngoài band, và chúng đứng nguyên tại chỗ qua cả bốn nhánh band —
 * người dùng bấm thử lại thì dải cảnh báo đổi thành stepper, nhưng bốn tầng và
 * những kết quả đã giữ không nhúc nhích. Đó là lời hứa "không xoá tiến độ đã có"
 * viết thành cấu trúc chứ không viết thành lời.
 *
 * ## Vì sao là `<ul>` chứ không phải `Table`
 *
 * `Table.Row` vẽ vòng tiêu điểm bằng prop `focused` chứ không bằng
 * `:focus-visible` (`Table.tsx:89`), nên `expectAccessible` báo lỗi một lần cho
 * mỗi `<tr>` — đã xác minh lại hai lần, gần nhất khi dựng `PipelineGraph`. Hai
 * khối ở đây là danh sách ĐỌC, không có hàng chọn được, nên chúng không cần ngữ
 * nghĩa bảng. Khuôn dùng lại là `ProcessingFloorObjectRows`
 * (`ProcessingScreen.tsx:157-177`).
 *
 * ## A5 — chấm ở "Kết quả đã có" là chấm TRUNG TÍNH
 *
 * Đặc tả gốc gọi mỗi dòng là "một chấm đã duyệt". Ở nhà này xanh "đã xác minh"
 * chỉ đánh dấu việc người duyệt, mà "Nhận diện cửa và nội thất — 21 đối tượng"
 * là đầu ra AI chưa ai duyệt. Nên chấm ở đây là `bg-text-muted`, và
 * {@link PipelineFailureKeptItem} cố ý không mang trường màu nào để view không có
 * gì mà tô sai.
 *
 * Dải tầng thì khác và được phép dùng ba màu trạng thái: nó nói một bước của
 * TIẾN TRÌNH đã chạy tới đâu, không nói chất lượng dữ liệu — cùng lý lẽ đã ghi ở
 * `processingStatusTokens.ts:22-30`, và bảng màu lấy thẳng từ đó thay vì chép
 * bản thứ hai sẽ trôi.
 */

import { clsx } from 'clsx';

import { STAGE_DOT_CLASS } from '@/screens/pipeline/ProcessingScreen/processingStatusTokens';

import type { PipelineFailureFloorViewModel, PipelineFailureKeptWork } from './types';

const FLOORS_ARIA_LABEL = 'Tiến độ theo tầng';
const KEPT_WORK_TITLE = 'Kết quả đã có';

/** Chấm trung tính của khối "Kết quả đã có" — không phải một trạng thái để tô. */
const NEUTRAL_DOT_CLASSES = 'h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted';

export interface PipelineFailureFloorStripProps {
  /** Luôn đủ bốn tầng: dải này tồn tại để thấy tầng 1, 2 và 4 vẫn ổn. */
  readonly floors: readonly PipelineFailureFloorViewModel[];
}

export function PipelineFailureFloorStrip({ floors }: PipelineFailureFloorStripProps) {
  return (
    <ul aria-label={FLOORS_ARIA_LABEL} className="flex flex-wrap items-center gap-2">
      {floors.map((floor) => (
        <li
          aria-current={floor.isFailedFloor ? 'true' : undefined}
          className={clsx(
            'flex items-center gap-2 rounded-[8px] border border-border-default px-3 py-1.5 text-[13px]',
            floor.isFailedFloor ? 'bg-bg-sunken' : 'bg-bg-surface',
          )}
          key={floor.id}
        >
          <span aria-hidden="true" className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', STAGE_DOT_CLASS[floor.status])} />
          <span className="font-medium text-text-primary">{floor.label}</span>
          <span className="text-text-secondary">{floor.statusLabel}</span>
        </li>
      ))}
    </ul>
  );
}

export interface PipelineFailureKeptWorkBlockProps {
  readonly keptWork: PipelineFailureKeptWork;
}

export function PipelineFailureKeptWorkBlock({ keptWork }: PipelineFailureKeptWorkBlockProps) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border-default bg-bg-surface p-5">
      <h2 className="text-[14px] font-semibold text-text-primary">{KEPT_WORK_TITLE}</h2>

      {keptWork.kind === 'line' ? (
        <p className="flex items-baseline gap-2 text-[13px] text-text-primary">
          <span aria-hidden="true" className={NEUTRAL_DOT_CLASSES} />
          {keptWork.line}
        </p>
      ) : (
        <>
          <ul aria-label={KEPT_WORK_TITLE} className="flex flex-col">
            {keptWork.items.map((item) => (
              <li
                className="flex items-baseline gap-2 border-b border-border-default py-2 text-[13px] text-text-primary last:border-b-0"
                key={item.id}
              >
                <span aria-hidden="true" className={NEUTRAL_DOT_CLASSES} />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-text-secondary">{keptWork.captionSentence}</p>
        </>
      )}
    </section>
  );
}
