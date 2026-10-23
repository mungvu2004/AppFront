/**
 * Khung chung của bốn màn tài khoản: đăng nhập, quên mật khẩu, đặt lại mật khẩu, nhận lời mời (A1 P1 + P2 #5).
 *
 * Cùng giấy, mực và chữ Be Vietnam Pro với `/welcome` (lớp `.landing`, token `--l-*` ở `landing.css`), để bấm
 * "Bắt đầu dự án" không rơi sang một app khác. Cột minh hoạ (`ValuePanel`) từ `lg`, dải gọn dưới `lg`.
 * Biểu mẫu neo từ trên, không căn giữa dọc: dải lỗi chèn vào không đẩy ô nhập khỏi con trỏ (BUG-008).
 * Lề 24 px dưới 640, 48 px từ đó (BUG-052).
 */

import '../landing/landing.css';

import { BrandMark } from '@/components/shell/BrandMark';

import { ValuePanel } from './AuthScreen/ValuePanel';

export interface AuthFrameProps {
  /** Trạng thái trong bảy, dưới dạng thuộc tính `data-` — đọc được bởi bài kiểm, im với người dùng. */
  readonly state: string;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly children: React.ReactNode;
}

export function AuthFrame({ state, title, subtitle, children }: AuthFrameProps) {
  return (
    <main className="landing flex min-h-screen w-full flex-col lg:flex-row" data-auth-state={state}>
      <ValuePanel />
      <div className="flex w-full flex-1 flex-col items-center px-6 pb-6 pt-[max(2.5rem,calc(40vh-16rem))] sm:px-12 lg:w-[55%]">
        <div className="flex w-[360px] max-w-full flex-col gap-6 animate-panel-rise motion-reduce:animate-none">
          <div className="flex flex-col gap-3">
            <BrandMark size={32} />
            <div className="flex flex-col gap-1">
              <h1 className="text-[30px] font-semibold leading-10 text-text-primary">{title}</h1>
              {subtitle !== undefined && (
                // `text-balance`: phụ đề một–hai dòng ngắn, không để "bạn." một mình ở dòng cuối (BUG-052).
                <p className="text-balance text-[15px] leading-6 text-text-secondary">{subtitle}</p>
              )}
            </div>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
