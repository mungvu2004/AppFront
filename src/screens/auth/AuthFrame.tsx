/**
 * Khung chung của bốn màn tài khoản: đăng nhập, quên mật khẩu, đặt lại mật khẩu, nhận lời mời (A1 P1 + P2 #5).
 *
 * Bản Z S-01: cột trái là mặt bằng nét mực (`ValuePanel`, 45 %), cột phải là MỘT khung `Section`
 * (NGUYEN-TAC-BO-CUC §2) chứa ba câu theo thứ tự đọc: eyebrow + H1 (làm gì), `status` (trạng thái),
 * rồi biểu mẫu với nút chính ở cuối (bước tiếp). Màn ngoài app nên không có header khối A.
 * Biểu mẫu neo từ trên, không căn giữa dọc: dải lỗi chèn vào không đẩy ô nhập khỏi con trỏ (BUG-008).
 */

import '../landing/landing.css';

import { BrandMark } from '@/components/shell/BrandMark';
import { Section } from '@/components/shell/Section';

import { ValuePanel } from './AuthScreen/ValuePanel';

/** Eyebrow vị trí chung của cả bốn màn tài khoản (demo Z/S-01). */
const ACCOUNT_EYEBROW = 'Tài khoản AppFront';

export interface AuthFrameProps {
  /** Trạng thái trong bảy, dưới dạng thuộc tính `data-` — đọc được bởi bài kiểm, im với người dùng. */
  readonly state: string;
  readonly title: string;
  readonly subtitle?: string | undefined;
  /** Câu 2 của màn: chip trạng thái + một câu, ngay dưới H1. */
  readonly status?: React.ReactNode;
  /** Dòng chân khung, ngăn bằng một đường kẻ (ví dụ cách có tài khoản). */
  readonly footer?: React.ReactNode;
  readonly children: React.ReactNode;
}

export function AuthFrame({ state, title, subtitle, status, footer, children }: AuthFrameProps) {
  return (
    <main className="landing flex min-h-screen w-full flex-col lg:flex-row" data-auth-state={state}>
      <ValuePanel />
      <div className="flex w-full flex-1 flex-col items-center px-6 pb-6 pt-[max(2.5rem,calc(40vh-18rem))] sm:px-12 lg:px-8">
        <Section
          flush
          className="w-[440px] max-w-full p-8 animate-panel-rise motion-reduce:animate-none xl:p-10"
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              {/* Dưới `lg` cột trái thu thành dải không có tên sản phẩm: tên đứng đầu khung. */}
              <span className="mb-3 flex items-center gap-2 text-text-primary lg:hidden">
                <BrandMark size={24} />
                <span className="text-[16px] font-medium tracking-[-0.01em]">AppFront</span>
              </span>
              <p className="text-caption font-medium uppercase tracking-[0.06em] text-text-muted">{ACCOUNT_EYEBROW}</p>
              <h1 className="text-title text-text-primary">{title}</h1>
              {status !== undefined && (
                <div className="mt-2 flex flex-col items-start gap-2 text-[14px] leading-5 text-text-secondary">
                  {status}
                </div>
              )}
              {subtitle !== undefined && (
                // `text-balance`: phụ đề một–hai dòng ngắn, không để "bạn." một mình ở dòng cuối (BUG-052).
                <p className="mt-1 text-balance text-[14px] leading-5 text-text-secondary">{subtitle}</p>
              )}
            </div>
            {children}
            {footer !== undefined && (
              <p className="border-t border-border-default pt-4 text-[13px] leading-5 text-text-secondary">{footer}</p>
            )}
          </div>
        </Section>
      </div>
    </main>
  );
}
