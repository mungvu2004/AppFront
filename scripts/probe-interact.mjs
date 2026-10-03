/*
 * Bộ dò TƯƠNG TÁC, bản 2 — bấm hết điều khiển của từng màn như một người dùng.
 *
 * Bản 1 cho 129 phát hiện và **127 là của chính nó**. Ba chỗ nó sai, cả ba đã sửa
 * ở bản này; ghi lại để không ai dựng lại chúng:
 *
 *   1. **Không bỏ qua tour trước khi bấm.** `EditorTour` mang một tấm tối `z-40`
 *      `pointer-events-auto`, nên sau cú bấm ĐẦU TIÊN mọi cú sau đều quá hạn.
 *      Ra 61 `THREW` giả. Bản này bỏ qua tour sau khi tải, và bỏ lại mỗi lần một
 *      cú bấm quá hạn.
 *   2. **Chữ ký đếm BAO NHIÊU chứ không ghi CÁI NÀO.** Chuyển một radio thì tổng
 *      `aria-checked="true"` không đổi, nên mọi nhóm radio/tab đọc thành "nút
 *      chết". Ra 35 `NO_CHANGE` giả. Bản này ghi **tên** của phần tử đang bật.
 *   3. **Coi `Tab` về `BODY` là lỗi.** Đó là hành vi bình thường của trình duyệt.
 *      Ra 30 báo động giả. Bản này chỉ báo hai thứ thật: màn **không có phần tử
 *      nào focus được**, và một hộp thoại đang mở mà `Tab` ra được khỏi nó.
 *
 * Nó vẫn KHÔNG làm được: đoán ra phải làm gì, đọc xem nhãn có dễ hiểu không, thấy
 * bố cục lệch. Ba việc ấy cần người.
 *
 * ## Ba chỗ BẢN 2 VẪN YẾU — đọc trước khi tin một phát hiện
 *
 * 1. **Không đọc `value` của `input`, không đọc thuộc tính `data-*`.** Một nút đổi
 *    giá trị trong một ô nhập, hoặc đổi `data-auth-state`, sẽ đọc thành `NO_CHANGE`.
 *    Đó là lý do `projectOverlay | tăng giá trị` và `login | Đăng nhập` còn nằm
 *    trong danh sách ấy — chưa ai xác minh chúng là nút chết.
 * 2. **Không đóng panel mà cú bấm trước mở ra.** Nên một panel chi tiết che danh
 *    sách làm mọi cú bấm sau quá hạn: `adminModels` bị chặn 19/21. Cách chữa: bấm
 *    `Escape` trước mỗi cú bấm, hoặc mở lại màn giữa hai cú bấm.
 * 3. **`dismissTour` không phân biệt được nút "bỏ qua" của tour với nút "Bỏ qua" của
 *    chính màn.** Trên `onboarding` nó bấm nhầm nút của màn, nên `ZERO_FOCUSABLE` ở
 *    đó là báo động giả.
 *
 * Hai lỗi THẬT nó đã tìm ra và cả hai đã sửa: màn 404 bấm "về danh sách dự án"
 * làm bảng điều khiển đổ (`e63300c`), và `Escape` ở `/thong-bao` đưa trình duyệt ra
 * `about:blank` (`a73007b`).
 *
 * Chạy: `PROBE_PORT=<cổng> node scripts/probe-interact.mjs <ra.json> [chỉ-một-màn]`.
 * Cần một dev server đang chạy với `VITE_USE_MOCK_API=true`.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import process from 'node:process';

const BASE = `http://127.0.0.1:${process.env.PROBE_PORT ?? '5200'}`;
const OUT = process.argv[2] ?? 'probe-tuong-tac.json';
const ONLY = process.argv[3] ?? null;
const P = 'project-1';
const F = 'L1';

const MAX_CONTROLS = 22;
/** 340 ms là quãng chuyển động chậm nhất của bảng token, cộng lề. */
const SETTLE_MS = 420;

const PATHS = {
  dashboard: '/',
  login: '/login',
  onboarding: '/onboarding',
  accessDenied: '/khong-co-quyen',
  notifications: '/thong-bao',
  account: '/tai-khoan',
  billing: '/billing',
  adminModels: '/admin/models',
  adminUsers: '/admin/users',
  notFound: '/duong-khong-ton-tai-xyz',
  mobileViewer: `/m/du-an/${P}`,
  projectSettings: `/projects/${P}/settings`,
  projectUpload: `/projects/${P}/upload`,
  projectQuality: `/projects/${P}/quality`,
  projectPipeline: `/projects/${P}/pipeline`,
  projectPipelineGraph: `/projects/${P}/pipeline/graph`,
  projectScale: `/projects/${P}/floors/L2/scale`,
  projectCadConfirm: `/projects/${P}/floors/${F}/cad-confirm`,
  projectOverlay: `/projects/${P}/floors/${F}/overlay`,
  projectWalls: `/projects/${P}/floors/${F}/layers/walls`,
  projectObjects: `/projects/${P}/floors/${F}/layers/objects`,
  projectDimensions: `/projects/${P}/floors/${F}/layers/dimensions`,
  projectGrids: `/projects/${P}/floors/${F}/layers/grids`,
  projectRooms: `/projects/${P}/floors/${F}/layers/rooms`,
  projectFloors: `/projects/${P}/floors`,
  projectThickness: `/projects/${P}/floors/${F}/layers/thickness`,
  projectViewer: `/projects/${P}/3d`,
  projectExploded: `/projects/${P}/3d/exploded`,
  projectMeasure: `/projects/${P}/3d/measure`,
  projectViewerPascal: `/projects/${P}/3d/pascal`,
  projectRules: `/projects/${P}/rules`,
  projectRuleSettings: `/projects/${P}/rules/settings`,
  projectExport: `/projects/${P}/export`,
  projectData: `/projects/${P}/data`,
  projectVersions: `/projects/${P}/versions`,
};

/* Hàm chạy trong trang. Khai một lần, dùng lại — đừng chép. */
const IN_PAGE = `
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const nameOf = (el) => (el.getAttribute('aria-label') ?? el.innerText ?? el.value ?? '')
    .replace(/\\s+/g, ' ').trim().slice(0, 44);
  const namesOf = (sel) => [...document.querySelectorAll(sel)].filter(vis).map(nameOf).sort().join('|');
`;

/** Chữ ký trạng thái. Ghi CÁI NÀO đang bật, không phải bao nhiêu cái. */
const SIG = new Function(`${IN_PAGE}
  const txt = (document.body.innerText ?? '').replace(/\\s+/g, ' ').trim();
  let h = 0;
  for (let i = 0; i < txt.length; i += 1) h = (h * 31 + txt.charCodeAt(i)) | 0;
  const a = document.activeElement;
  return {
    url: location.pathname + location.search + location.hash,
    len: txt.length,
    hash: h,
    dialogs: namesOf('[role="dialog"],[role="alertdialog"]'),
    pressed: namesOf('[aria-pressed="true"]'),
    expanded: namesOf('[aria-expanded="true"]'),
    checked: namesOf('[aria-checked="true"]'),
    selected: namesOf('[aria-selected="true"]'),
    status: [...document.querySelectorAll('[role="status"],[role="alert"]')]
      .map((e) => (e.innerText ?? '').trim()).join('|').slice(0, 400),
    controls: document.querySelectorAll('button,[role="button"],[role="tab"],[role="radio"],[role="checkbox"],[role="switch"],input,select,textarea').length,
    focus: a === null ? 'none' : a.tagName + ':' + nameOf(a),
  };
`);

/** Điều khiển nhìn thấy được, mỗi tên truy cập một lần. */
const CONTROLS = new Function(`${IN_PAGE}
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('button,[role="button"],[role="tab"],[role="radio"],[role="switch"],[role="checkbox"]')) {
    if (!vis(el)) continue;
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') continue;
    const n = nameOf(el);
    if (n === '' || seen.has(n)) continue;
    seen.add(n);
    out.push({ name: n, role: el.getAttribute('role') ?? el.tagName.toLowerCase() });
  }
  return out;
`);

/** Đếm phần tử focus được, và hộp thoại đang mở. */
const FOCUSABLE = new Function(`${IN_PAGE}
  const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[role="button"],[role="tab"],[role="radio"]';
  const n = [...document.querySelectorAll(sel)].filter(vis)
    .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true').length;
  return { focusable: n, dialogOpen: [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(vis).length > 0 };
`);

/** Bỏ qua tour bằng nút của sản phẩm. Trả true nếu có bấm. */
const dismissTour = async (page) => {
  for (const label of ['bỏ qua', 'Bỏ qua']) {
    const b = page.getByRole('button', { name: label, exact: true }).first();
    try {
      if (await b.isVisible({ timeout: 500 })) {
        await b.click({ timeout: 2000 });
        await page.waitForTimeout(SETTLE_MS);
        return true;
      }
    } catch { /* không có tour, hoặc nó vừa biến mất — cả hai đều bình thường */ }
  }
  return false;
};

const browser = await chromium.launch({ channel: 'chrome' });
const results = {};
const entries = Object.entries(PATHS).filter(([k]) => ONLY === null || k === ONLY);

for (const [key, path] of entries) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon/i.test(t) || /Failed to load resource/.test(t)) return;
    errors.push(t.slice(0, 220));
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message.slice(0, 220)}`));

  const open = async () => {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
    await page.waitForTimeout(1100);
    return dismissTour(page);
  };

  const findings = [];
  let controls = [];
  let tourSeen = false;
  try {
    tourSeen = await open();
    controls = await page.evaluate(CONTROLS);

    for (const c of controls.slice(0, MAX_CONTROLS)) {
      const before = await page.evaluate(SIG);
      const errBefore = errors.length;
      const role = ['button', 'tab', 'radio', 'switch', 'checkbox'].includes(c.role) ? c.role : 'button';
      const click = async () => {
        await page.getByRole(role, { name: c.name, exact: true }).first().click({ timeout: 3500 });
      };
      let threw = null;
      try {
        await click();
      } catch {
        /* Cú bấm bị chặn: bỏ qua tour rồi thử LẠI một lần. Chỉ khi lần hai cũng
           hỏng thì mới là chuyện của sản phẩm. */
        if (await dismissTour(page)) tourSeen = true;
        try {
          await click();
        } catch (e2) {
          threw = String(e2).split('\n')[0].slice(0, 150);
        }
      }
      await page.waitForTimeout(SETTLE_MS);
      let after = null;
      try { after = await page.evaluate(SIG); } catch { /* trang không đọc được */ }

      if (threw !== null) {
        findings.push({ kind: 'BLOCKED', control: c.name, detail: threw });
      } else if (after === null) {
        findings.push({ kind: 'THREW', control: c.name, detail: 'trang không đọc được sau cú bấm' });
      } else if (errors.length > errBefore) {
        findings.push({ kind: 'THREW', control: c.name, detail: errors.slice(errBefore).join(' ; ').slice(0, 200) });
      } else {
        const fields = ['url', 'len', 'hash', 'dialogs', 'pressed', 'expanded', 'checked', 'selected', 'status', 'controls'];
        if (fields.every((f) => before[f] === after[f])) {
          findings.push({ kind: 'NO_CHANGE', control: c.name, detail: `focus ${before.focus} -> ${after.focus}` });
        }
        if (after.url !== before.url) {
          findings.push({ kind: 'NAV', control: c.name, detail: `${before.url} -> ${after.url}` });
          await open();
        }
      }
    }

    /* A12 — hai thứ thật, không phải "Tab về BODY". */
    await open();
    const f = await page.evaluate(FOCUSABLE);
    if (f.focusable === 0) {
      findings.push({ kind: 'ZERO_FOCUSABLE', control: '(cả màn)', detail: 'không phần tử nào focus được: người dùng bàn phím không có đường nào đi' });
    }
    if (f.dialogOpen) {
      let escaped = false;
      for (let i = 0; i < 20; i += 1) {
        await page.keyboard.press('Tab');
        const inside = await page.evaluate(() => {
          const a = document.activeElement;
          return a !== null && a.closest('[role="dialog"],[role="alertdialog"]') !== null;
        });
        if (!inside) { escaped = true; break; }
      }
      if (escaped) findings.push({ kind: 'NO_FOCUS_TRAP', control: '(hộp thoại đang mở)', detail: 'Tab ra được khỏi hộp thoại' });
    }

    /* A12 — Escape không được rời ứng dụng. */
    await open();
    const beforeEsc = await page.evaluate(SIG);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    const href = await page.evaluate(() => location.href).catch(() => 'about:blank');
    if (!href.startsWith(BASE)) {
      findings.push({ kind: 'ESC_NAV', control: 'Escape', detail: `rời ứng dụng: ${href.slice(0, 60)}` });
    } else if (href.replace(BASE, '') !== beforeEsc.url) {
      findings.push({ kind: 'ESC_NAV', control: 'Escape', detail: `${beforeEsc.url} -> ${href.replace(BASE, '')}` });
    }
  } catch (error) {
    findings.push({ kind: 'THREW', control: '(mở màn)', detail: String(error).split('\n')[0].slice(0, 200) });
  }

  const count = (k) => findings.filter((x) => x.kind === k).length;
  results[key] = { path, tourSeen, controlCount: controls.length, probed: Math.min(controls.length, MAX_CONTROLS), findings, errors: [...new Set(errors)].slice(0, 6) };
  console.log(
    `${key.padEnd(22)} đk=${String(controls.length).padStart(3)} tour=${tourSeen ? 'C' : '-'}`
    + ` nổ=${count('THREW')} chặn=${count('BLOCKED')} chết=${count('NO_CHANGE')}`
    + ` a12=${count('ZERO_FOCUSABLE') + count('NO_FOCUS_TRAP') + count('ESC_NAV')} lỗi=${errors.length}`,
  );
  await ctx.close();
}

await browser.close();
fs.writeFileSync(OUT, JSON.stringify(results, null, 2), 'utf8');
console.log(`\nĐã ghi ${OUT}`);
