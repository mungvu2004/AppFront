/**
 * Hướng dẫn thao tác trang 3D: 5 bước, hình thức theo EditorTour của AppFront (4 tấm nền mờ quanh
 * lỗ + viền accent, thẻ 320px). Không chặn thao tác 3D; Esc đóng mà không chặn sự kiện của editor.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  type Box,
  CARD_W,
  isHuge,
  markDone,
  placeCard,
  resolveAnchor,
  shouldAutoOpen,
  TOUR_OPEN_EVENT,
  TOUR_STEPS,
} from './tourLogic';

const Z = 70;
const PAD = 4;

const CSS = `
.pascal-tour-btn{font:inherit;font-size:13px;font-weight:500;border-radius:var(--pa-radius,8px);height:32px;padding:0 12px;cursor:pointer;border:1px solid transparent;transition:background 120ms var(--pa-ease),color 120ms var(--pa-ease)}
.pascal-tour-btn:focus-visible,.pascal-tour-link:focus-visible{outline:none;box-shadow:var(--pa-focus)}
.pascal-tour-primary{background:var(--pa-accent);color:var(--pa-surface)}
.pascal-tour-primary:hover{background:var(--pa-accent-hover)}
.pascal-tour-ghost{background:transparent;color:var(--pa-text-2)}
.pascal-tour-ghost:hover{background:var(--pa-sunken);color:var(--pa-text)}
.pascal-tour-link{font:inherit;font-size:12px;background:none;border:0;padding:4px 2px;color:var(--pa-text-2);cursor:pointer;text-decoration:underline;border-radius:4px}
.pascal-tour-link:hover{color:var(--pa-text)}
.pascal-tour-kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;border:1px solid var(--pa-border);background:var(--pa-sunken);color:var(--pa-text-2);border-radius:4px;padding:1px 6px}
.pascal-tour-card{transition:left 180ms var(--pa-ease),top 180ms var(--pa-ease)}
@media (prefers-reduced-motion: reduce){.pascal-tour-card,.pascal-tour-btn{transition:none}}
`;

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

export function PascalTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(220);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const openTour = useCallback(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    setIndex(0);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    markDone();
    setOpen(false);
    const el = returnTo.current;
    returnTo.current = null;
    if (el?.isConnected) el.focus?.();
  }, []);

  useEffect(() => {
    if (shouldAutoOpen()) setOpen(true);
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

  if (!open) return null;
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
          left: pos.left,
          top: pos.top,
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
        <div style={{ fontSize: 12, color: 'var(--pa-text-2)', marginBottom: 6 }}>
          {index + 1} / {TOUR_STEPS.length}
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
        <div style={{ marginTop: 14 }}>
          <button className="pascal-tour-link" onClick={close} type="button">
            Bỏ qua hướng dẫn
          </button>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.title}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 9999,
                  background: i === index ? 'var(--pa-accent)' : 'var(--pa-border)',
                }}
              />
            ))}
          </div>
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
      </div>
    </div>
  );
}
