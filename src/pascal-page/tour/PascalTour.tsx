/**
 * Hướng dẫn thao tác trang 3D: 5 bước, hình thức theo EditorTour của AppFront (4 tấm nền mờ quanh
 * lỗ + viền accent, thẻ 320px). Không chặn thao tác 3D; Esc đóng mà không chặn sự kiện của editor.
 *
 * UX-R1 K47/K40: trong lúc chờ hiện một dòng chữ tiến độ dưới biểu tượng tải của Pascal. Lần đầu
 * (sau khung hình đầu) KHÔNG tự mở tour phủ tối: chỉ hiện một gợi ý nhỏ (xoay/phóng + "Xem hướng
 * dẫn"), đóng được và nhớ. Tour đầy đủ chỉ mở từ nút '?' hoặc nút của gợi ý.
 * UX-R2 K38: gợi ý đứng ngay trên thanh công cụ dưới, không còn dưới cụm trợ giúp đầu cảnh — ở đó
 * nó đè lên mô hình.
 */
import { X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  type Box,
  CARD_W,
  HINT_BOTTOM_PX,
  HINT_TEXT,
  isHuge,
  isSceneReady,
  markDone,
  placeCard,
  resolveAnchor,
  SCENE_WAIT_MAX_MS,
  shouldAutoOpen,
  TOUR_OPEN_EVENT,
  TOUR_STEPS,
} from './tourLogic';

const Z = 70;
const PAD = 4;

const CSS = `
.pascal-tour-btn{font:inherit;font-size:13px;font-weight:500;border-radius:var(--pa-radius,8px);height:32px;padding:0 12px;cursor:pointer;border:1px solid transparent;transition:background 120ms var(--pa-ease),color 120ms var(--pa-ease)}
.pascal-tour-btn:focus-visible{outline:2px solid transparent;outline-offset:2px;box-shadow:var(--pa-focus)}
.pascal-tour-primary{background:var(--pa-accent);color:var(--pa-surface)}
.pascal-tour-primary:hover{background:var(--pa-accent-hover)}
.pascal-tour-ghost{background:transparent;color:var(--pa-text-2)}
.pascal-tour-ghost:hover{background:var(--pa-sunken);color:var(--pa-text)}
.pascal-tour-kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;border:1px solid var(--pa-border);background:var(--pa-sunken);color:var(--pa-text-2);border-radius:4px;padding:1px 6px}
.pascal-tour-card{transition:transform 180ms var(--pa-ease)}
@media (prefers-reduced-motion: reduce){.pascal-tour-card,.pascal-tour-btn{transition:none}}
`;

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

/**
 * Theo dõi màn chờ của editor: `loading` cho tới khi `ready` = khung hình đầu đã có mô hình.
 * UX-R3 U10: người xem từng thấy nền trống 11-15 giây không chữ nào (màn chờ Pascal đã tắt nhưng
 * mô hình chưa có) — nay chữ hiện suốt từ lúc mở tới khi có mô hình, tối đa `SCENE_WAIT_MAX_MS`.
 */
function useSceneState(hasModel: () => boolean) {
  const [ready, setReady] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (ready) return;
    let raf = 0;
    const started = Date.now();
    const check = () => {
      if (Date.now() - started > SCENE_WAIT_MAX_MS) setGaveUp(true);
      if (!isSceneReady(document, hasModel) || raf !== 0) return;
      window.clearInterval(id);
      // Hai khung: khung đầu có mô hình đã thực sự vẽ ra.
      raf = window.requestAnimationFrame(() => {
        raf = window.requestAnimationFrame(() => setReady(true));
      });
    };
    // eslint-disable-next-line local/no-raw-duration -- chu kỳ dò màn chờ, không phải chuyển động
    const id = window.setInterval(check, 250);
    check();
    return () => {
      window.clearInterval(id);
      window.cancelAnimationFrame(raf);
    };
  }, [ready, hasModel]);
  return { loading: !ready && !gaveUp, ready };
}

/** Gợi ý lần đầu: một dòng, không phủ tối, giữa cạnh dưới ngay trên thanh công cụ dưới. */
function FirstHint({ onOpen, onClose }: { readonly onOpen: () => void; readonly onClose: () => void }) {
  return (
    <aside
      aria-label="Gợi ý thao tác 3D"
      data-pascal-tour-hint=""
      style={{
        position: 'fixed',
        left: '50%',
        bottom: HINT_BOTTOM_PX,
        transform: 'translateX(-50%)',
        zIndex: Z,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 6px 6px 14px',
        whiteSpace: 'nowrap',
        fontSize: 13,
        background: 'var(--pa-surface)',
        color: 'var(--pa-text)',
        border: '1px solid var(--pa-border)',
        borderRadius: 12,
        boxShadow: 'var(--pa-shadow-float)',
      }}
    >
      <style>{CSS}</style>
      <span>{HINT_TEXT}</span>
      <button className="pascal-tour-btn pascal-tour-primary" onClick={onOpen} type="button">
        Xem hướng dẫn
      </button>
      <button
        aria-label="Đóng gợi ý"
        className="pascal-tour-btn pascal-tour-ghost"
        onClick={onClose}
        style={{ width: 32, padding: 0, display: 'grid', placeItems: 'center' }}
        title="Đóng gợi ý"
        type="button"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </aside>
  );
}

const ALWAYS = () => true;

/** `hasModel`: cảnh đã có mô hình chưa (giữ cùng một hàm giữa các lượt vẽ). */
export function PascalTour({ hasModel = ALWAYS }: { readonly hasModel?: () => boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(220);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const scene = useSceneState(hasModel);

  const openTour = useCallback(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    setHint(false);
    setIndex(0);
    setOpen(true);
  }, []);
  const dismissHint = useCallback(() => {
    markDone();
    setHint(false);
  }, []);
  const close = useCallback(() => {
    markDone();
    setOpen(false);
    const el = returnTo.current;
    returnTo.current = null;
    if (el?.isConnected) el.focus?.();
  }, []);

  // Báo cho viên "Điều khiển chuột" (canvas-help) gập lại khi tour đang hiện.
  useEffect(() => {
    document.documentElement.dataset.pascalTour = open ? 'open' : 'closed';
    window.dispatchEvent(new Event('pascal-tour:state'));
  }, [open]);

  useEffect(() => {
    if (scene.ready && shouldAutoOpen()) setHint(true);
  }, [scene.ready]);

  useEffect(() => {
    window.addEventListener(TOUR_OPEN_EVENT, openTour);
    return () => window.removeEventListener(TOUR_OPEN_EVENT, openTour);
  }, [openTour]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(); // không stopPropagation: Esc của editor vẫn chạy
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Theo dõi phần tử neo (có thể mount muộn hoặc đổi chỗ khi đổi cỡ cửa sổ).
  useEffect(() => {
    if (!open) return;
    const step = TOUR_STEPS[index];
    if (!step) return;
    const measure = () => {
      const el = resolveAnchor(step);
      setAnchor(el ? toBox(el.getBoundingClientRect()) : null);
      setVp({ w: window.innerWidth, h: window.innerHeight });
      if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    };
    measure();
    // eslint-disable-next-line local/no-raw-duration -- chu kỳ đo lại vị trí neo, không phải chuyển động
    const id = window.setInterval(measure, 400);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [open, index]);

  useLayoutEffect(() => {
    if (open) primaryRef.current?.focus({ preventScroll: true });
  }, [open, index]);

  if (!open) {
    if (hint) return <FirstHint onClose={dismissHint} onOpen={openTour} />;
    return scene.loading ? (
      <p
        aria-live="polite"
        role="status"
        style={{
          position: 'fixed',
          left: '50%',
          top: 'calc(50% + 48px)',
          transform: 'translateX(-50%)',
          zIndex: Z,
          margin: 0,
          fontSize: 14,
          color: 'var(--pa-text-2)',
          pointerEvents: 'none',
        }}
      >
        Đang dựng mô hình 3D…
      </p>
    ) : null;
  }
  const step = TOUR_STEPS[index];
  if (!step) return null;
  const last = index === TOUR_STEPS.length - 1;
  const pos = placeCard(anchor, cardH, vp.w, vp.h);
  const hole = anchor && anchor.width > 0 && !isHuge(anchor, vp.w, vp.h) ? anchor : null;
  const dim = { position: 'fixed', background: 'var(--pa-overlay)' } as const;
  const h = hole && {
    l: Math.max(0, hole.left - PAD),
    t: Math.max(0, hole.top - PAD),
    r: Math.min(vp.w, hole.left + hole.width + PAD),
    b: Math.min(vp.h, hole.top + hole.height + PAD),
  };

  return (
    <div data-pascal-tour="" style={{ position: 'fixed', inset: 0, zIndex: Z, pointerEvents: 'none' }}>
      <style>{CSS}</style>
      {h ? (
        <>
          <div style={{ ...dim, left: 0, top: 0, width: '100%', height: h.t }} />
          <div style={{ ...dim, left: 0, top: h.b, width: '100%', height: vp.h - h.b }} />
          <div style={{ ...dim, left: 0, top: h.t, width: h.l, height: h.b - h.t }} />
          <div style={{ ...dim, left: h.r, top: h.t, width: vp.w - h.r, height: h.b - h.t }} />
          <div
            style={{
              position: 'fixed',
              left: h.l,
              top: h.t,
              width: h.r - h.l,
              height: h.b - h.t,
              border: '2px solid var(--pa-accent)',
              borderRadius: 6,
            }}
          />
        </>
      ) : (
        <div style={{ ...dim, inset: 0 }} />
      )}
      <div
        aria-labelledby="pascal-tour-title"
        aria-modal="false"
        className="pascal-tour-card"
        ref={cardRef}
        role="dialog"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          transform: `translate(${Math.round(pos.left)}px, ${Math.round(pos.top)}px)`,
          width: CARD_W,
          pointerEvents: 'auto',
          boxSizing: 'border-box',
          padding: 20,
          background: 'var(--pa-surface)',
          color: 'var(--pa-text)',
          border: '1px solid var(--pa-border)',
          borderRadius: 12,
          boxShadow: 'var(--pa-shadow-float)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--pa-text-2)', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
          {index + 1}&nbsp;/&nbsp;{TOUR_STEPS.length}
        </div>
        <h2 id="pascal-tour-title" style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>
          {step.title}
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--pa-text-2)' }}>{step.body}</p>
        {step.keys ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {step.keys.map((k) => (
              <kbd className="pascal-tour-kbd" key={k}>
                {k}
              </kbd>
            ))}
          </div>
        ) : null}
        {/* T-11: cùng hình thức thẻ QC (EditorTour) — gợi ý Esc, hàng nút "Bỏ qua hướng dẫn" | "Tiếp theo", chấm ở giữa dưới.
            Bước cuối không còn "Bỏ qua": "Xong" đã đóng hướng dẫn, hai nút cùng việc chỉ làm phân vân. */}
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--pa-text-2)' }}>Bấm Esc để đóng hướng dẫn.</p>
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {last ? (
            <span />
          ) : (
            <button className="pascal-tour-btn pascal-tour-ghost" onClick={close} type="button">
              Bỏ qua hướng dẫn
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {index > 0 ? (
              <button className="pascal-tour-btn pascal-tour-ghost" onClick={() => setIndex(index - 1)} type="button">
                Quay lại
              </button>
            ) : null}
            <button
              className="pascal-tour-btn pascal-tour-primary"
              onClick={() => (last ? close() : setIndex(index + 1))}
              ref={primaryRef}
              type="button"
            >
              {last ? 'Xong' : 'Tiếp theo'}
            </button>
          </div>
        </div>
        <div aria-hidden="true" style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {TOUR_STEPS.map((s, i) => (
            <span
              data-current={i === index ? 'true' : undefined}
              key={s.title}
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                borderRadius: 9999,
                background: i === index ? 'var(--pa-accent)' : 'var(--pa-border)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
