/**
 * Bản cuộn của /welcome: vùng cuộn cao, canvas dính toàn màn, lớp chữ và nhãn.
 * Chỉ markup — mọi chuyển động do `overlay.ts` ghi vào style theo `p`.
 */

import { ExportRow, StartCta } from './LandingParts';
import { DEFAULT_SUGGESTIONS, FINAL, LABELS, SCENE_COPY, SUMMARY } from './landing.copy';

export interface LandingViewProps {
  readonly trackVh: number;
  readonly lastScene: number;
  readonly loading: boolean;
  readonly suggestions?: readonly string[] | undefined;
  readonly onSkip: () => void;
}

export interface LandingViewRefs {
  readonly track: React.RefObject<HTMLDivElement | null>;
  readonly sticky: React.RefObject<HTMLDivElement | null>;
  readonly canvas: React.RefObject<HTMLCanvasElement | null>;
}

export function LandingView({
  trackVh,
  lastScene,
  loading,
  suggestions = DEFAULT_SUGGESTIONS,
  onSkip,
  refs,
}: LandingViewProps & { refs: LandingViewRefs }) {
  return (
    <main className="landing" data-mode="pinned">
      <a
        className="landing-skip"
        href="#bat-dau"
        onClick={(e) => {
          e.preventDefault();
          onSkip();
        }}
      >
        Bỏ qua
      </a>
      <div
        ref={refs.track}
        className="landing-track"
        style={{ ['--landing-total' as string]: trackVh }}
      >
        <div ref={refs.sticky} className="landing-sticky">
          <canvas ref={refs.canvas} className="landing-canvas" aria-hidden="true" />
          <div className="landing-scrim" aria-hidden="true" />
          {loading && (
            <p className="landing-loading" role="status">
              Đang dựng bản vẽ
            </p>
          )}
          <div className="landing-copy">
            {SCENE_COPY.map((c) => {
              const Heading = c.scene === 0 ? 'h1' : 'h2';
              return (
                <section
                  key={c.scene}
                  data-scene={c.scene}
                  className="landing-scene"
                  style={{ visibility: 'hidden' }}
                >
                  <Heading className="landing-title" data-delay="0">
                    {c.title}
                  </Heading>
                  {c.sub !== undefined && (
                    <p className="landing-sub" data-delay="0.12">
                      {c.sub}
                    </p>
                  )}
                  {c.scene === 7 && (
                    <div data-delay="0.25">
                      <p className="landing-summary">{SUMMARY}</p>
                      <ul className="landing-suggestions">
                        {suggestions.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.note !== undefined && (
                    <p className="landing-note" data-delay="0.3">
                      {c.note}
                    </p>
                  )}
                </section>
              );
            })}
            <section
              data-scene={lastScene}
              className="landing-scene landing-final"
              style={{ visibility: 'hidden' }}
            >
              <h2 className="landing-title" data-delay="0">
                {FINAL.title}
              </h2>
              <p className="landing-sub" data-delay="0.1">
                {FINAL.sub}
              </p>
              <ExportRow animated />
              <div data-delay="0.35">
                <StartCta
                  secondary={{
                    label: 'Xem lại từ đầu',
                    onClick: () => window.scrollTo({ top: 0 }),
                  }}
                />
              </div>
            </section>
          </div>
          <div className="landing-labels">
            {LABELS.map((l) => (
              <span
                key={l.id}
                className="landing-label"
                data-label={l.id}
                data-tone={l.tone}
                style={{ visibility: 'hidden' }}
              >
                {l.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
