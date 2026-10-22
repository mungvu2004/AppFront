/**
 * Bản kết hợp A + B + C: trang sách (C) → AI chấm bút chì đỏ (C) → tờ bản vẽ trên bàn (A) → tường dựng lên (A)
 * → mô hình trắng thành nhà thật (B) → bước tới cửa và vào nhà (B). Sau chương AI có cảnh trục đo tách tầng (C). Kịch bản: F:/App-review/homepage-v6/COMBO.md.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';

import '../blueprint/blueprint.css';
import './combo.css';
import { useCombo } from './useCombo';

/** Masked lines: each line slides up out of its own clip. */
function Lines({ lines, as: Tag = 'p', className }: { lines: readonly string[]; as?: 'h1' | 'h2' | 'p'; className?: string }) {
  return (
    <Tag className={className}>
      {lines.map((l) => (
        <span key={l} className="cb-line">
          <span>{l}</span>
        </span>
      ))}
    </Tag>
  );
}

const NOTES = [
  { win: '0.055,0.07,0.09,0.1', num: '01', title: ['Mặt bằng,', 'từng nét một'], body: 'Trục, tường, cửa, đồ đạc, rồi kích thước: bản vẽ được đọc theo đúng thứ tự người vẽ.' },
  { win: '0.1,0.115,0.185,0.2', num: '02', title: ['AI chấm bài', 'bằng bút chì đỏ'], body: 'AI khoanh cửa, gạch chân tường, ghi tên và diện tích từng phòng. Chỗ nào chưa đúng, bạn sửa lại.' },
  { win: '0.2,0.215,0.3,0.315', num: '03', title: ['Ba tầng,', 'tách ra để đọc'], body: 'Mặt bằng nghiêng thành trục đo, các tầng nhấc ra theo đúng cao độ, rồi ghép lại thành một mô hình.' },
  { win: '0.32,0.335,0.355,0.37', num: '04', title: ['Từ trang sách', 'lên bàn làm việc'], body: 'Cùng tờ bản vẽ ấy, in ra và đặt trên bàn.' },
  { win: '0.37,0.385,0.41,0.425', num: '', title: ['Trên bàn,', 'bản vẽ đã sẵn sàng.'], body: 'Tờ giấy nằm trên tấm kê cắt, cạnh thước và nắng chiều. Mỗi nét in sắp thành một bức tường.' },
  { win: '0.425,0.44,0.485,0.5', num: '05', title: ['Tường dựng lên', 'từ nét in'], body: 'Mô hình 3D nhiều tầng dựng từ đúng mặt bằng đó: tường, cửa, sàn, mái.' },
  { win: '0.5,0.515,0.555,0.57', num: '06', title: ['Mô hình', 'thành nhà thật'], body: 'Cùng một mô hình, phối cảnh minh hoạ lúc hoàng hôn: vật liệu, ánh sáng, cảnh quan.' },
  { win: '0.58,0.595,0.665,0.68', num: '07', title: ['Đi quanh', 'ngôi nhà'], body: 'Nhìn ngôi nhà như khi đứng ngoài sân, trước khi đặt viên gạch đầu tiên.' },
  { win: '0.685,0.7,0.765,0.78', num: '08', title: ['Đến trước cửa'], body: 'Lối đi, hiên, cửa chính: đúng vị trí đã khoanh đỏ trên bản vẽ.' },
  { win: '0.79,0.805,0.865,0.88', num: '09', title: ['Bước vào trong'], body: 'Phòng khách, sofa, đèn, cầu thang: đúng chỗ như trên mặt bằng.' },
] as const;

const CAPTIONS = [
  { win: '0,0,0.095,0.105', text: 'Hình 1 — Mặt bằng tầng 1, tỉ lệ 1:100' },
  { win: '0.1,0.11,0.195,0.205', text: 'Hình 2 — Mặt bằng tầng 1, AI đánh dấu tường, cửa và phòng' },
  { win: '0.2,0.21,2,2', text: 'Hình 3 — Trục đo tách tầng, tầng 1 đến tầng 3' },
] as const;

export default function Combo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCombo(rootRef, trackRef, canvasRef);

  return (
    <div className="bp cb" ref={rootRef} data-tone="paper">
      <div className="cb-track" ref={trackRef}>
        <div className="bp-stage cb-stage">
          <canvas className="bp-canvas" ref={canvasRef} aria-hidden="true" />
          <div className="cb-scrim" data-win="0.37,0.39,0.49,0.51" aria-hidden="true">
            <div className="cb-scrim-desk" data-rest="" />
          </div>
          <div className="cb-scrim" data-win="0.5,0.53,2,2" aria-hidden="true">
            <div className="cb-scrim-photo" data-rest="" />
          </div>

          <header className="bp-run" data-slide="up">
            <span className="bp-brand">AppFront</span>
            <span>Bản vẽ thành nhà · một cuốn sách nhỏ về mặt bằng</span>
            <nav>
              <Link to="/login">Đăng nhập</Link>
            </nav>
          </header>
          <div className="cb-top" data-win="0.35,0.37,2,2">
            <span className="bp-brand" data-rest="">
              AppFront
            </span>
            <Link to="/login" data-rest="">
              Đăng nhập
            </Link>
          </div>

          <section className="bp-col bp-hero cb-hero" data-win="load,1,0.035,0.06">
            <p className="bp-kicker" data-rest="">
              <b>Chương 1</b> Từ mặt bằng 2D đến mô hình 3D nhiều tầng
            </p>
            <Lines as="h1" className="bp-h1" lines={['Bản vẽ của bạn,', 'đọc như một cuốn sách,', 'dựng như một ngôi nhà.']} />
            <p className="bp-sub" data-rest="">
              Tải lên mặt bằng 2D, AI nhận ra tường, cửa và phòng; bạn chỉnh lại, rồi có mô hình 3D nhiều tầng để xem và xuất.
            </p>
            <div className="bp-actions" data-rest="">
              <Link className="bp-cta" to="/login">
                Bắt đầu dự án
              </Link>
              <Link className="bp-quiet" to="/login">
                Đăng nhập
              </Link>
            </div>
          </section>

          {NOTES.map((n) => (
            <section key={n.win} className="bp-col bp-note cb-note" data-win={n.win} aria-label={n.title.join(' ')}>
              {n.num !== '' && <Lines className="bp-num" lines={[n.num]} />}
              <Lines as="h2" lines={n.title} />
              <div className="bp-rule" data-rest="" />
              <p data-rest="">{n.body}</p>
              {n.num === '02' && (
                <p className="cb-tally" data-rest="">
                  <b data-count="17,0.12,0.175">0</b> tường · <b data-count="8,0.13,0.18">0</b> cửa · <b data-count="12,0.14,0.19">0</b> phòng
                </p>
              )}
            </section>
          ))}

          <section className="bp-col bp-close cb-close" data-win="0.9,0.93,2,2">
            <Lines as="h2" className="bp-h1" lines={['Từ một tờ giấy', 'đến một ngôi nhà.']} />
            <p className="bp-sub" data-rest="">
              Mở dự án đầu tiên với chính bản vẽ của bạn.
            </p>
            <div className="bp-actions" data-rest="">
              <Link className="bp-cta" to="/login">
                Bắt đầu dự án
              </Link>
              <Link className="bp-quiet" to="/login">
                Đăng nhập
              </Link>
            </div>
            <ul className="cb-chips" data-rest="" aria-label="Định dạng xuất">
              {['.glb', '.pdf', '.png', '.json'].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>

          <footer className="bp-foot" data-slide="down">
            <div className="bp-caption">
              <span className="bp-caption-lines">
                {CAPTIONS.map((c) => (
                  <span key={c.text} className="bp-fig cb-cap" data-win={c.win}>
                    <span data-rest="">{c.text}</span>
                  </span>
                ))}
              </span>
            </div>
            <span className="bp-folio">1</span>
          </footer>
          <p className="cb-demo">Dữ liệu minh hoạ</p>
        </div>
      </div>
    </div>
  );
}
