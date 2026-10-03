/*
 * Bộ dò khảo sát — không phải bài kiểm, không nằm trong `e2e/`.
 *
 * Nó mở từng màn có route một lượt và GHI LẠI những gì thật sự vẽ ra: lỗi
 * console, chữ nhìn thấy được, các mốc neo có role, lớp chắn đang phủ. Thứ này
 * thay cho việc bắt 12 worker LLM click tay rồi chép lại nhãn — nhãn chép tay là
 * nhãn bịa được, còn `getByRole` đếm được thì không.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import process from 'node:process';

const BASE = `http://127.0.0.1:${process.env.E2E_PORT ?? '5199'}`;
const OUT = process.argv[2] ?? 'probe.json';
const PROJECT = 'project-1';
const FLOOR = 'L1';

const PATHS = {
  accessDenied: '/khong-co-quyen',
  account: '/tai-khoan',
  adminModels: '/admin/models',
  adminUsers: '/admin/users',
  billing: '/billing',
  dashboard: '/',
  login: '/login',
  mobileViewer: `/m/du-an/${PROJECT}`,
  notFound: '/duong-khong-ton-tai-xyz',
  notifications: '/thong-bao',
  onboarding: '/onboarding',
  projectCadConfirm: `/projects/${PROJECT}/floors/${FLOOR}/cad-confirm`,
  projectData: `/projects/${PROJECT}/data`,
  projectDimensions: `/projects/${PROJECT}/floors/${FLOOR}/layers/dimensions`,
  projectExploded: `/projects/${PROJECT}/3d/exploded`,
  projectExport: `/projects/${PROJECT}/export`,
  projectFloors: `/projects/${PROJECT}/floors`,
  projectGrids: `/projects/${PROJECT}/floors/${FLOOR}/layers/grids`,
  projectMeasure: `/projects/${PROJECT}/3d/measure`,
  projectObjects: `/projects/${PROJECT}/floors/${FLOOR}/layers/objects`,
  projectOverlay: `/projects/${PROJECT}/floors/${FLOOR}/overlay`,
  projectPipeline: `/projects/${PROJECT}/pipeline`,
  projectPipelineGraph: `/projects/${PROJECT}/pipeline/graph`,
  projectQuality: `/projects/${PROJECT}/quality`,
  projectRooms: `/projects/${PROJECT}/floors/${FLOOR}/layers/rooms`,
  projectRules: `/projects/${PROJECT}/rules`,
  projectRuleSettings: `/projects/${PROJECT}/rules/settings`,
  projectScale: `/projects/${PROJECT}/floors/${FLOOR}/scale`,
  projectSettings: `/projects/${PROJECT}/settings`,
  projectThickness: `/projects/${PROJECT}/floors/${FLOOR}/layers/thickness`,
  projectUpload: `/projects/${PROJECT}/upload`,
  projectVersions: `/projects/${PROJECT}/versions`,
  projectViewer: `/projects/${PROJECT}/3d`,
  projectViewerPascal: `/projects/${PROJECT}/3d/pascal`,
  projectWalls: `/projects/${PROJECT}/floors/${FLOOR}/layers/walls`,
};

/** Đọc cây đã render, chỉ bằng những gì một bài Playwright cũng đọc được. */
const SNAPSHOT = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const txt = (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const named = (sel) =>
    [...document.querySelectorAll(sel)]
      .filter(vis)
      .map((el) => txt(el) || el.getAttribute('aria-label') || '')
      .filter(Boolean)
      .slice(0, 40);

  const bodyText = txt(document.body);
  return {
    title: document.title,
    bodyLen: bodyText.length,
    bodySample: bodyText.slice(0, 400),
    h1: named('h1'),
    h2: named('h2').slice(0, 15),
    buttons: [...document.querySelectorAll('button,[role="button"]')]
      .filter(vis)
      .map((el) => txt(el) || el.getAttribute('aria-label') || '')
      .filter(Boolean)
      .slice(0, 40),
    labels: [...document.querySelectorAll('label,[aria-label]')]
      .filter(vis)
      .map((el) => el.getAttribute('aria-label') || txt(el))
      .filter(Boolean)
      .slice(0, 40),
    status: [...document.querySelectorAll('[role="status"],[aria-live]')].map(txt).filter(Boolean).slice(0, 10),
    dialogs: [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].map(
      (el) => el.getAttribute('aria-label') || txt(el).slice(0, 120),
    ),
    tablist: [...document.querySelectorAll('[role="tab"]')].filter(vis).map(txt).slice(0, 20),
    canvases: [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`),
    testids: [...document.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid')).slice(0, 25),
    skeletons: document.querySelectorAll('[aria-busy="true"],.animate-pulse').length,
    // Số nút mang chữ "lưu" — A7 nói phải là 0.
    saveButtons: [...document.querySelectorAll('button')]
      .filter(vis)
      .filter((el) => /lưu/i.test(txt(el)))
      .map(txt),
    // Dấu vết dấu chấm thập phân — A15 nói phải là dấu phẩy.
    dotDecimals: (bodyText.match(/\d+\.\d+\s*(m²|m|mm|%)/g) ?? []).slice(0, 10),
  };
};

const browser = await chromium.launch({ channel: 'chrome' });
const results = {};

for (const [key, path] of Object.entries(PATHS)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message.slice(0, 200)}`));

  let snap = null;
  let failure = null;
  try {
    const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500); // để Suspense + lượt gia hạn phiên kịp xong
    snap = await page.evaluate(SNAPSHOT);
    snap.httpStatus = res?.status() ?? null;
    snap.finalUrl = page.url().replace(BASE, '');
  } catch (error) {
    failure = String(error).slice(0, 300);
  }

  results[key] = { path, errors: [...new Set(errors)].slice(0, 8), failure, ...snap };
  console.log(
    `${key.padEnd(22)} len=${String(snap?.bodyLen ?? 'X').padStart(6)} url=${snap?.finalUrl ?? '?'} err=${errors.length}`,
  );
  await ctx.close();
}

await browser.close();
fs.writeFileSync(OUT, JSON.stringify(results, null, 2), 'utf8');
console.log(`\nĐã ghi ${OUT}`);
