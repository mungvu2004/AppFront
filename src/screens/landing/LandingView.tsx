/**
 * Bản cuộn của /welcome: vùng cuộn cao, canvas dính toàn màn, khung trang
 * (đầu trang, thanh sáu bước), lớp chữ và nhãn.
 * Chỉ markup — mọi chuyển động do `overlay.ts` ghi vào style theo `p`.
 */

import type { LandingHouse } from '@/lib/landing/types';

import { ChecksCard, Eyebrow, ExportGrid, FooterStrip, Header, StartCta, StepRail, Title } from './LandingParts';
import { eyebrow, FINAL, labelsFor, SCENE_COPY } from './landing.copy';

export interface LandingViewProps {
  readonly trackVh: number;
  /** id các cảnh theo thứ tự SCENES; chữ gắn vào cảnh theo id. */
  readonly sceneIds: readonly string[];
  /** null khi dữ liệu căn nhà chưa tải: chưa có nhãn, chưa có thẻ kiểm tra. */
  readonly house: LandingHouse | null;
  readonly onSkip: () => void;
  /** Bấm một bước trên thanh: nhảy tới đầu cảnh đầu tiên của bước đó. */
  readonly onStep: (step: number) => void;
}

export interface LandingViewRefs {
  readonly track: React.RefObject<HTMLDivElement | null>;
  readonly sticky: React.RefObject<HTMLDivElement | null>;
  readonly canvas: React.RefObject<HTMLCanvasElement | null>;
}

const HIDDEN = { visibility: 'hidden' } as const;

export function LandingView({ trackVh, sceneIds, house, onSkip, onStep, refs }: LandingViewProps & { refs: LandingViewRefs }) {
  const last = sceneIds.length - 1;
  return (
    <main className="landing" data-mode="pinned">
      <div ref={refs.track} className="landing-track" style={{ ['--landing-total' as string]: trackVh }}>
        <div ref={refs.sticky} className="landing-sticky">
          <canvas ref={refs.canvas} className="landing-canvas" aria-hidden="true" />
          <div className="landing-scrim" aria-hidden="true" />
          <Header onSkip={onSkip} />
          <StepRail onStep={onStep} />
          {house === null && (
            <p className="landing-loading" role="status">
              Đang dựng bản vẽ
            </p>
          )}
          <div className="landing-copy">
            {SCENE_COPY.map((c) => {
              const index = sceneIds.indexOf(c.id);
              if (index < 0) return null;
              return (
                <section key={c.id} data-scene={index} className="landing-phase landing-scene" style={HIDDEN}>
                  <Eyebrow text={eyebrow(c.id)} delay="0" />
                  {c.title !== undefined && <Title copy={c} level={index === 0 ? 1 : 2} delay="0.06" />}
                  {c.sub !== undefined && (
                    <p className="landing-sub" data-delay="0.14">
                      {c.sub}
                    </p>
                  )}
                  {c.id === 's08' && house !== null && <ChecksCard checks={house.checks} delay="0.22" />}
                  {c.note !== undefined && (
                    <p className="landing-note" data-delay="0.3">
                      {c.note}
                    </p>
                  )}
                </section>
              );
            })}
            <section data-scene={last} className="landing-phase landing-scene landing-final" style={HIDDEN}>
              <Eyebrow text={eyebrow(sceneIds[last] ?? '')} delay="0" />
              <h2 className="landing-title" data-delay="0.06">
                {FINAL.title}
              </h2>
              <p className="landing-sub" data-delay="0.12">
                {FINAL.sub}
              </p>
              <ExportGrid animated />
              <div data-delay="0.35">
                <StartCta secondary={{ label: 'Xem lại từ đầu', onClick: () => onStep(0) }} />
              </div>
            </section>
            <footer data-scene={last} className="landing-phase landing-footer" style={HIDDEN}>
              <div data-delay="0.45">
                <FooterStrip />
              </div>
            </footer>
          </div>
          <div className="landing-labels">
            {house !== null &&
              labelsFor(house).map((l) => (
                <span
                  key={l.id}
                  className="landing-label"
                  data-label={l.id}
                  data-tone={l.tone}
                  data-kind={l.kind}
                  data-minor={l.minor === true ? '' : undefined}
                  style={HIDDEN}
                >
                  <span className="landing-label-name">{l.name}</span>
                  {l.meta !== undefined && <span className="landing-label-meta">{l.meta}</span>}
                  {l.rule !== undefined && <span className="landing-label-rule">{l.rule}</span>}
                </span>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
