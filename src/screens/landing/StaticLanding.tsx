/**
 * Bản tĩnh của /welcome: giảm chuyển động, không có WebGL2 hay mất context.
 * Đủ sáu bước, mặt bằng vẽ từ cùng dữ liệu căn nhà, ảnh căn nhà hoàn chỉnh,
 * nút bắt đầu và "Bỏ qua". Không ghim, không Lenis, không canvas.
 */

import { useEffect, useState } from 'react';

import { ExportRow, StartCta } from './LandingParts';
import { FINAL, STEPS, SUMMARY } from './landing.copy';

const STILL = '/landing/fallback/house.webp';

export function StaticLanding() {
  const [plan, setPlan] = useState('');
  const [stillOk, setStillOk] = useState(true);

  useEffect(() => {
    let alive = true;
    void import('@/lib/landing/house').then(({ LANDING_HOUSE, planSvg }) => {
      if (alive) setPlan(planSvg(LANDING_HOUSE));
    });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="landing" data-mode="static">
      <a className="landing-skip" href="#bat-dau">
        Bỏ qua
      </a>
      <header className="landing-static-hero">
        <h1 className="landing-title">Bản vẽ biết trở thành ngôi nhà.</h1>
        <p className="landing-sub">Từ mặt bằng 2D đến mô hình 3D có thể kiểm tra.</p>
        {plan !== '' && (
          <div
            className="landing-plan"
            role="img"
            aria-label="Mặt bằng tầng trệt của ngôi nhà mẫu"
            dangerouslySetInnerHTML={{ __html: plan }}
          />
        )}
      </header>
      <ol className="landing-steps">
        {STEPS.map((s) => (
          <li key={s.title}>
            <h2 className="landing-step-title">{s.title}</h2>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      {stillOk && (
        <img
          className="landing-still"
          src={STILL}
          alt="Ngôi nhà hai tầng đã dựng xong từ bản vẽ"
          onError={() => setStillOk(false)}
        />
      )}
      <p className="landing-note">Dữ liệu minh hoạ · {SUMMARY}</p>
      <section className="landing-final">
        <h2 className="landing-title">{FINAL.title}</h2>
        <p className="landing-sub">{FINAL.sub}</p>
        <ExportRow animated={false} />
        <StartCta secondary={{ label: 'Xem lại từ đầu', onClick: () => window.scrollTo({ top: 0 }) }} />
      </section>
    </main>
  );
}
