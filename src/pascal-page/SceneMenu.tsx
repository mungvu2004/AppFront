/**
 * HIG (04/11): một nút "Cảnh" trên thanh trên thay cho bốn nút Phong cách / Ánh sáng / Chất lượng / Nướng ánh
 * sáng. Bấm mở popover; mỗi thẻ con (vẫn là `<details>` của chính nó) thành một dòng có icon + chữ, danh sách
 * của nó mở ngay dưới dòng (xếp chồng, không bay đè dòng khác). Esc hoặc bấm ra ngoài thì đóng.
 * Thẻ theo vật chọn (Đổi mẫu, Nguồn mẫu, Độ tin cậy…) KHÔNG nằm ở đây — chúng chỉ hiện khi có vật hợp lệ.
 */
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

/** Thẻ con trong popover: dòng phẳng rộng hết, luôn có chữ, danh sách con nằm trong luồng (accordion). */
const PANEL_CLASS = [
  'absolute top-full left-0 z-50 mt-1 flex w-72 max-w-[calc(100vw-24px)] flex-col gap-0.5 rounded-xl border border-[var(--pa-border)]',
  'bg-[var(--pa-surface)] p-1 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-overlay)]',
  '[&_summary]:w-full! [&_summary]:border-0! [&_summary]:shadow-none! [&_summary]:rounded-lg!',
  '[&_summary>span]:inline! [&_summary>svg:first-child]:block! [&_summary>svg:last-child]:ml-auto [&_summary>svg:last-child]:block!',
  '[&_details>ul]:static! [&_details>div]:static! [&_details>ul]:w-full [&_details>div]:w-full',
  '[&_details>ul]:shadow-none! [&_details>div]:shadow-none! [&_details>ul]:bg-[var(--pa-sunken)] [&_details>div]:bg-[var(--pa-sunken)]',
].join(' ');

export function SceneMenu({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = () => ref.current?.removeAttribute('open');
    const onPointer = (event: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !ref.current?.open) return;
      close();
      ref.current.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <details className="relative" data-appfront-menu="" data-appfront-scene-menu="" ref={ref}>
      <summary
        aria-label="Cảnh — phong cách, ánh sáng, chất lượng, nướng ánh sáng"
        className="flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)] [&::-webkit-details-marker]:hidden"
        title="Cảnh: phong cách, ánh sáng, chất lượng, nướng ánh sáng"
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>Cảnh</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)]" />
      </summary>
      <div aria-label="Tuỳ chỉnh cảnh" className={PANEL_CLASS} role="group">
        {children}
      </div>
    </details>
  );
}
