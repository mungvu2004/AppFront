/**
 * Khối gấp "Chi tiết kỹ thuật" — chỗ DUY NHẤT vết lỗi kỹ thuật dài được phép
 * hiện ra.
 *
 * Đóng mặc định. Mục [CẤM TUYỆT ĐỐI] cấm đưa vết lỗi dài ra ngoài khối này, nên
 * cách dựng đúng là nhật ký chỉ tồn tại trong cây khi `isOpen` — đóng lại thì
 * không còn dòng nào để mà lọt ra, thay vì còn đó và bị giấu bằng một lớp CSS.
 *
 * ## A12 — mở và đóng được bằng bàn phím
 *
 * Nút gấp là một `<button>` thật, mang `aria-expanded` và `aria-controls`. Không
 * `addEventListener('keydown')`, không phím tắt riêng: `Enter` và `Space` đã là
 * đường đi sẵn có của một nút, và thêm một phím tắt cho một khối gấp là lấy mất
 * một phím của cả ứng dụng để đổi lấy thứ bàn phím vốn đã làm được.
 * `aria-controls` trỏ vào một `<div>` luôn có mặt, nên nó không bao giờ trỏ vào
 * hư không lúc khối đang đóng.
 *
 * ## Vì sao vết lỗi nằm trong `<code>`
 *
 * Một dòng nhật ký là chữ của máy — `segmentation.fail code=SEG-2041` — chứ
 * không phải câu cho người đọc, nên nó không phải và không thể là tiếng Việt.
 * `expectVietnamese` bỏ qua nguyên `<code>`, `<pre>` và `<kbd>` đúng vì lẽ đó
 * (`expectVietnamese.ts:155-163`), nên thẻ đúng ở đây vừa là thẻ đúng về ngữ
 * nghĩa vừa là thứ giữ cho phép kiểm ngôn ngữ nói thật thay vì bị tắt đi.
 *
 * ## Chuyển động
 *
 * Mở là một lượt chuyển chiều cao 260ms, đi qua {@link PipelineFailureReveal} —
 * cùng một chuyển động với dải cảnh báo, lấy từ cùng một token.
 *
 * ## `forbidden`
 *
 * Cả khối này không được gắn: `PipelineFailureProps.technicalDetails` là `null`
 * và màn không dựng {@link PipelineFailureDetails} lần nào. Người không có quyền
 * không thấy nhật ký, và cách đúng để nói điều đó là khối biến mất chứ không
 * phải một nút khoá mờ.
 */

import { clsx } from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';

import { PipelineFailureCopyButton } from './PipelineFailureCopyButton';
import { PipelineFailureReveal } from './PipelineFailureReveal';
import type { PipelineFailureProps, PipelineFailureTechnicalDetails } from './types';

const PANEL_ID = 'pipeline-failure-technical-details';

const LOG_ARIA_LABEL = 'Nhật ký kỹ thuật';

/** Chữ đều trên nền chìm — đúng `--bg-sunken`, không phải một nền mới. */
const LOG_CLASSES = 'max-h-[240px] overflow-auto rounded-[8px] bg-bg-sunken p-3 font-mono text-[12px]';

export interface PipelineFailureDetailsProps {
  readonly details: PipelineFailureTechnicalDetails;
  readonly motionDurationName: PipelineFailureProps['motionDurationName'];
  readonly prefersReducedMotion: boolean;
}

export function PipelineFailureDetails({
  details,
  motionDurationName,
  prefersReducedMotion,
}: PipelineFailureDetailsProps) {
  return (
    <section className="flex flex-col gap-2 border-t border-border-default pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          aria-controls={PANEL_ID}
          aria-expanded={details.isOpen}
          iconBefore={
            details.isOpen ? (
              <ChevronDown aria-hidden="true" size={14} />
            ) : (
              <ChevronRight aria-hidden="true" size={14} />
            )
          }
          onClick={details.onToggle}
          size="sm"
          variant="ghost"
        >
          {details.toggleLabel}
        </Button>

        {details.isOpen ? <PipelineFailureCopyButton action={details.copyLog} /> : null}
      </div>

      <div id={PANEL_ID}>
        {details.isOpen ? (
          <PipelineFailureReveal durationName={motionDurationName} prefersReducedMotion={prefersReducedMotion}>
            <ul aria-label={LOG_ARIA_LABEL} className={clsx(LOG_CLASSES, 'flex flex-col gap-1')} tabIndex={0}>
              {details.logLines.map((line) => (
                <li className="flex gap-3" key={line.id}>
                  <span className="shrink-0 text-text-muted">{line.timeLabel}</span>
                  <code className="text-text-secondary">{line.text}</code>
                </li>
              ))}
            </ul>
          </PipelineFailureReveal>
        ) : null}
      </div>
    </section>
  );
}
