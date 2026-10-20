/**
 * Bản tĩnh của /welcome: giảm chuyển động, không có WebGL2 hay mất context.
 * Một "tờ bản vẽ" in ra: giấy tràn trang, đầu trang, mặt bằng vẽ từ cùng dữ liệu
 * căn nhà, sáu bước đánh số, ảnh căn nhà, thẻ kiểm tra, khối tên và nút bắt đầu.
 * Không ghim, không Lenis, không canvas.
 */

import { useEffect, useState } from 'react';

import type { LandingHouse } from '@/lib/landing/types';

import { ChecksCard, Eyebrow, ExportGrid, FooterStrip, Header, StartCta, Title } from './LandingParts';
import { eyebrow, FINAL, HERO, STEPS, stepNumber } from './landing.copy';

const STILL = '/landing/fallback/house.webp';
const top = (): void => window.scrollTo({ top: 0 });

export function StaticLanding() {
  const [house, setHouse] = useState<{ data: LandingHouse; plan: string } | null>(null);
  const [stillOk, setStillOk] = useState(true);

  useEffect(() => {
    let alive = true;
    void import('@/lib/landing/house').then(({ LANDING_HOUSE, planSvg }) => {
      if (alive) setHouse({ data: LANDING_HOUSE, plan: planSvg(LANDING_HOUSE) });
    });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="landing" data-mode="static">
      <Header />
      <div className="landing-static-inner">
        <section className="landing-static-hero">
          <div>
            <Eyebrow text={eyebrow('s01')} />
            <Title copy={HERO} level={1} />
            <p className="landing-sub">{HERO.sub}</p>
          </div>
          {house !== null && (
            <figure className="landing-plan">
              <div role="img" aria-label="Mặt bằng tầng trệt của ngôi nhà mẫu" dangerouslySetInnerHTML={{ __html: house.plan }} />
              <figcaption className="landing-caption">Tầng trệt · Dữ liệu minh hoạ</figcaption>
            </figure>
          )}
        </section>
        <ol className="landing-steps">
          {STEPS.map((s, i) => (
            <li key={s.name} id={`buoc-${stepNumber(i)}`} data-tone={s.tone}>
              <span className="landing-step-num">{stepNumber(i)}</span>
              <h2 className="landing-step-title">{s.name}</h2>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        {stillOk && (
          <figure className="landing-still">
            <img src={STILL} alt="Ngôi nhà đã dựng xong từ bản vẽ" onError={() => setStillOk(false)} />
            <figcaption className="landing-caption">Ngôi nhà mẫu dựng từ cùng bản vẽ</figcaption>
          </figure>
        )}
        {house !== null && <ChecksCard checks={house.data.checks} />}
        <section className="landing-final">
          <Eyebrow text={eyebrow('s09')} />
          <h2 className="landing-title">{FINAL.title}</h2>
          <p className="landing-sub">{FINAL.sub}</p>
          <ExportGrid animated={false} />
          <StartCta secondary={{ label: 'Xem lại từ đầu', onClick: top }} />
        </section>
        <footer className="landing-footer">
          <FooterStrip />
        </footer>
      </div>
    </main>
  );
}
