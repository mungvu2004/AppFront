/**
 * Một mảnh nội dung **mở chiều cao và mờ dần** khi nó vừa được gắn vào cây.
 *
 * Cả hai chuyển động của màn S-11 là cùng một chuyển động: dải cảnh báo vào chỗ
 * phần đầu cột trái, và khối gấp "Chi tiết kỹ thuật" mở ra. Viết một lần ở đây
 * thay vì hai lần ở hai file — hai bản sao sẽ trôi khỏi nhau, và bản trôi chậm
 * hơn sẽ là bản không ai nhớ đã sửa.
 *
 * ## Vì sao là `grid-template-rows` chứ không phải `height`
 *
 * `height: auto` không nội suy được, nên cách duy nhất để mở đúng chiều cao thật
 * của nội dung mà không đo bằng JavaScript là cho hàng lưới chạy `0fr → 1fr`.
 * Không có `framer-motion` ở đây: R-39 khoá thư viện đó trong
 * `src/components/motion`, và màn hình không được nhập nó.
 *
 * ## Không rung, không nháy
 *
 * Đúng hai thuộc tính đổi giá trị — chiều cao hàng và độ mờ. Không `transform`,
 * không đổi màu, không lặp. Đặc tả cấm rung và nháy ở một dải báo lỗi, và cách
 * chắc chắn nhất để không rung là không có thuộc tính nào rung được.
 *
 * ## Thời lượng đến từ token
 *
 * `durationName` là {@link MotionDurationName} — điều phối viên chốt `'standard'`
 * (260ms). `cssDurationMs` đổi nó thành chuỗi CSS, và trả `0ms` khi người dùng
 * xin ít chuyển động, nên nhánh "cắt thẳng tới đích" không cần viết riêng.
 *
 * `useEffect` chứ không phải `useLayoutEffect`: hiệu ứng bố cục chạy TRƯỚC lượt
 * vẽ đầu tiên, nên trình duyệt sẽ không bao giờ thấy khung hình đóng và chuyển
 * động sẽ không chạy. `useEffect` chạy sau lượt vẽ đó — đó là điều kiện để một
 * transition có chỗ bắt đầu.
 */

import { clsx } from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';

import { cssDurationMs, type MotionDurationName } from '@/lib/motion';

export interface PipelineFailureRevealProps {
  /** Slot thời lượng, không phải mili-giây (R-71). */
  readonly durationName: MotionDurationName;
  readonly prefersReducedMotion: boolean;
  readonly children: ReactNode;
}

export function PipelineFailureReveal({
  durationName,
  prefersReducedMotion,
  children,
}: PipelineFailureRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsRevealed(true);
  }, []);

  return (
    <div
      className={clsx(
        'grid ease-enter transition-[grid-template-rows,opacity]',
        isRevealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
      style={{ transitionDuration: cssDurationMs(durationName, { reducedMotion: prefersReducedMotion }) }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
