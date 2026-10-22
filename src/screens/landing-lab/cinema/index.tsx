/**
 * Mẫu thử B "cinema": một cú máy điện ảnh. Chuỗi ảnh Cycles dựng sẵn được tua theo cuộn: mặt bằng nét trắng
 * trên nền xanh bản vẽ nhìn từ trên xuống, tan dần thành ngôi nhà thật lúc hoàng hôn trong khi máy hạ xuống,
 * rồi lướt tới lối vào ở tầm mắt.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';

import './cinema.css';
import { useCinema } from './useCinema';

export default function Cinema() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCinema(rootRef, trackRef, canvasRef);

  return (
    <div className="cn" ref={rootRef}>
      <div className="cn-track" ref={trackRef}>
        <div className="cn-stage">
          <canvas className="cn-canvas" ref={canvasRef} aria-hidden="true" />
          {/* Scrims only while their copy shows, so the render keeps its true colours in between. */}
          <div className="cn-scrim" data-win="-1,0,0.1,0.17" aria-hidden="true" />
          <div className="cn-scrim" data-win="0.42,0.48,0.62,0.68" aria-hidden="true" />
          <div className="cn-scrim" data-win="0.86,0.94,3,3" aria-hidden="true" />

          <header className="cn-top">
            <span className="cn-brand">AppFront</span>
            <Link className="cn-login" to="/login">
              Đăng nhập
            </Link>
          </header>

          <section className="cn-col cn-hero" data-win="-1,0,0.1,0.17">
            <h1 className="cn-h1">Từ bản vẽ, thành ngôi nhà bạn bước vào được.</h1>
            <p className="cn-sub">Tải mặt bằng 2D lên, AI nhận ra tường, cửa và phòng, rồi dựng thành mô hình 3D nhiều tầng.</p>
            <Link className="cn-cta" to="/login">
              Bắt đầu dự án
            </Link>
          </section>

          <section className="cn-col cn-step" data-win="0.42,0.48,0.62,0.68">
            <p className="cn-body">Bạn sửa chỗ AI đọc chưa đúng, rồi xem từng tầng đứng lên đúng cao độ, đúng chỗ từng ô cửa.</p>
          </section>

          <section className="cn-col cn-close" data-win="0.86,0.94,3,3">
            <h2 className="cn-h1 cn-h1--close">Một bản vẽ 2D, một ngôi nhà ba tầng để bước vào.</h2>
            <Link className="cn-cta" to="/login">
              Bắt đầu dự án
            </Link>
          </section>

          <p className="cn-demo">Dữ liệu minh hoạ</p>
        </div>
      </div>
    </div>
  );
}
