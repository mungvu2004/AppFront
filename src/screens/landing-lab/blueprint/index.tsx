/**
 * Mẫu thử C "blueprint": bản vẽ sống như một cuốn sách kiến trúc. Một canvas 2D vẽ mặt bằng bằng mực,
 * bút chì đỏ của AI, rồi trục đo tách tầng; chữ là trang sách chạy theo cuộn.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';

import './blueprint.css';
import { useBlueprint } from './useBlueprint';

const NOTES = [
  {
    win: '0.07,0.11,0.33,0.37',
    num: '01',
    title: 'Mặt bằng, từng nét một',
    body: 'Nét được dựng theo đúng thứ tự người vẽ: trục, tường, cửa, đồ đạc, rồi kích thước. Bản vẽ của bạn có thể là ảnh chụp, bản quét hay một tệp PDF.',
  },
  {
    win: '0.37,0.4,0.53,0.555',
    num: '02',
    title: 'AI chấm bài bằng bút chì đỏ',
    body: 'AI khoanh cửa, gạch chân tường, ghi tên và diện tích từng phòng. Chỗ nào chưa đúng, bạn sửa lại trước khi dựng hình.',
  },
  {
    win: '0.555,0.58,0.7,0.72',
    num: '03',
    title: 'Mặt bằng nghiêng thành trục đo',
    body: 'Tường dựng lên đúng độ dày, cửa giữ nguyên chỗ mở. Cùng một bộ dữ liệu cho cả bản vẽ 2D và mô hình 3D.',
  },
  {
    win: '0.72,0.75,0.88,0.91',
    num: '04',
    title: 'Ba tầng, tách ra để đọc',
    body: 'Mỗi tầng một mặt sàn, chồng đúng cao độ. Kiểm tra vài quy tắc tự động, rồi xuất .glb, .pdf, .png hoặc .json.',
  },
] as const;

const CAPTIONS = [
  { win: '0,0,0.36,0.38', text: 'Hình 1 — Mặt bằng tầng 1, tỉ lệ 1:100' },
  { win: '0.37,0.39,0.53,0.555', text: 'Hình 2 — Mặt bằng tầng 1, AI đánh dấu tường, cửa và phòng' },
  { win: '0.555,0.58,0.7,0.72', text: 'Hình 3 — Trục đo tầng 1, tường cắt ở cao độ 1,3 m' },
  { win: '0.72,0.75,2,2', text: 'Hình 4 — Trục đo tách tầng, tầng 1 đến tầng 3' },
] as const;

const FOLIOS = [
  { win: '0,0,0.06,0.08', n: '1' },
  { win: '0.07,0.09,0.36,0.38', n: '2' },
  { win: '0.37,0.39,0.53,0.555', n: '3' },
  { win: '0.555,0.58,0.7,0.72', n: '4' },
  { win: '0.72,0.75,0.9,0.92', n: '5' },
  { win: '0.91,0.93,2,2', n: '6' },
] as const;

export default function Blueprint() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useBlueprint(rootRef, trackRef, canvasRef);

  return (
    <div className="bp" ref={rootRef}>
      <div className="bp-track" ref={trackRef}>
        <div className="bp-stage">
          <canvas className="bp-canvas" ref={canvasRef} aria-hidden="true" />
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <span key={c} className="bp-crop" data-c={c} aria-hidden="true" />
          ))}

          <header className="bp-run">
            <span className="bp-brand">AppFront</span>
            <span>Bản vẽ thành nhà · một cuốn sách nhỏ về mặt bằng</span>
            <nav>
              <Link to="/login">Đăng nhập</Link>
            </nav>
          </header>

          <section className="bp-col bp-hero" data-win="0,0,0.05,0.1">
            <p className="bp-kicker">
              <b>Chương 1</b> Từ mặt bằng 2D đến mô hình 3D nhiều tầng
            </p>
            <h1 className="bp-h1">
              Bản vẽ của bạn,
              <br />
              đọc như một <em>cuốn sách</em>,
              <br />
              dựng như một ngôi nhà.
            </h1>
            <p className="bp-sub">Tải lên mặt bằng 2D, AI nhận ra tường, cửa và phòng; bạn chỉnh lại, rồi có mô hình 3D nhiều tầng để xem và xuất.</p>
            <div className="bp-actions">
              <Link className="bp-cta" to="/login">
                Bắt đầu dự án
              </Link>
              <Link className="bp-quiet" to="/login">
                Đăng nhập
              </Link>
            </div>
          </section>

          {NOTES.map((n) => (
            <section key={n.num} className="bp-col bp-note" data-win={n.win} aria-label={n.title}>
              <p className="bp-num">{n.num}</p>
              <h2>{n.title}</h2>
              <div className="bp-rule" />
              <p>{n.body}</p>
            </section>
          ))}

          <section className="bp-col bp-close" data-win="0.91,0.95,2,2">
            <h2 className="bp-h1">
              Từ một tờ giấy
              <br />
              đến <em>một ngôi nhà</em>.
            </h2>
            <p className="bp-sub">Mở dự án đầu tiên với chính bản vẽ của bạn.</p>
            <div className="bp-actions">
              <Link className="bp-cta" to="/login">
                Bắt đầu dự án
              </Link>
            </div>
          </section>

          <footer className="bp-foot">
            <div className="bp-caption" data-caption="">
              <span className="bp-caption-lines">
                {CAPTIONS.map((c) => (
                  <span key={c.text} className="bp-fig" data-win={c.win}>
                    {c.text}
                  </span>
                ))}
              </span>
              <span className="bp-demo">Dữ liệu minh hoạ</span>
            </div>
            <span className="bp-folio-box" aria-hidden="true">
              {FOLIOS.map((f) => (
                <span key={f.n} className="bp-folio" data-win={f.win}>
                  {f.n}
                </span>
              ))}
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}
