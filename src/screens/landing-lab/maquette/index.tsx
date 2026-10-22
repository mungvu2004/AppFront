/**
 * Mẫu thử A "maquette": mô hình trắng trên bàn kiến trúc sư. Chuỗi ảnh dựng sẵn (Cycles) được tua theo cuộn:
 * tờ mặt bằng in trên thảm cắt, tường dựng lên từ nét vẽ, các tầng đặt xuống, máy hạ thấp về lối vào.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';

import './maquette.css';
import { useMaquette } from './useMaquette';

export default function Maquette() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useMaquette(rootRef, trackRef, canvasRef);

  return (
    <div className="mq" ref={rootRef}>
      <div className="mq-track" ref={trackRef}>
        <div className="mq-stage">
          <canvas className="mq-canvas" ref={canvasRef} aria-hidden="true" />
          <div className="mq-scrim" aria-hidden="true" />

          <header className="mq-top">
            <span className="mq-brand">AppFront</span>
            <Link className="mq-login" to="/login">
              Đăng nhập
            </Link>
          </header>

          <section className="mq-col mq-hero" data-win="-1,0,0.1,0.17">
            <h1 className="mq-h1">Bản vẽ của bạn, dựng thành nhà.</h1>
            <p className="mq-sub">Tải lên mặt bằng 2D, nhận về mô hình 3D nhiều tầng để xem, chỉnh và xuất.</p>
            <Link className="mq-cta" to="/login">
              Bắt đầu dự án
            </Link>
          </section>

          <section className="mq-col mq-step" data-win="0.2,0.26,0.44,0.5">
            <p className="mq-num">01</p>
            <h2 className="mq-h2">Tường dựng lên từ chính nét vẽ.</h2>
            <p className="mq-body">AI nhận ra tường, cửa và phòng trên mặt bằng; bạn sửa chỗ chưa đúng trước khi dựng hình.</p>
          </section>

          <section className="mq-col mq-step" data-win="0.54,0.6,0.76,0.82">
            <p className="mq-num">02</p>
            <h2 className="mq-h2">Từng tầng đặt xuống đúng cao độ.</h2>
            <p className="mq-body">Mỗi tầng một mặt sàn, mái đặt sau cùng. Xuất .glb, .pdf, .png hoặc .json khi xong.</p>
          </section>

          <section className="mq-col mq-close" data-win="0.88,0.95,3,3">
            <h2 className="mq-h1 mq-h1--close">Từ một tờ giấy đến một ngôi nhà ba tầng.</h2>
            <Link className="mq-cta" to="/login">
              Bắt đầu dự án
            </Link>
          </section>

          <p className="mq-demo">Dữ liệu minh hoạ</p>
        </div>
      </div>
    </div>
  );
}
