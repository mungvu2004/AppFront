import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { enableFlags } from './fixtures/flags';
import { ROUTE_PATTERNS } from './fixtures/routes';
import { EMAIL_BY_ROLE, submitSignInForm } from './fixtures/session';

/**
 * CPU luồng chính của viewer Pascal — cảnh đứng yên và cảnh đang xoay camera.
 *
 * ## Vì sao bài này tồn tại
 *
 * `docs/pascal/01-ho-so-cong-T4.1.md` §8d đo Pascal tốn **~1,6 lần** CPU luồng
 * chính mỗi giây so với màn 3D cũ cho cùng nhịp khung (bốn cặp tin được:
 * 1,202–1,628). Nguyên nhân nằm ở `FrameLimiter` của Pascal
 * (`vendor/pascal/packages/viewer/src/components/viewer/frame-limiter.tsx`): nó
 * lái R3F bằng tay (`frameloop: 'never'`) và **đẩy một khung mỗi nhịp, mãi mãi**
 * — cảnh đứng yên vẫn trả tiền cho ~50 khung/giây gồm toàn bộ system cộng một
 * lượt vẽ. Màn cũ thì "vẽ theo nhu cầu" (`src/lib/three/present/CLAUDE.md`).
 *
 * ## Cách đo
 *
 * `Performance.getMetrics` của CDP, chênh `TaskDuration`/`ScriptDuration` trên
 * một khoảng — cùng đại lượng `cpuGiay` của bộ đo cũ. Hai nhánh đo trên **một
 * bản dựng, một máy, một phiên**: `?frameloop=always` lái vòng khung theo lối
 * cũ (không cổng nhu cầu), không tham số thì theo lối mới. Nhờ vậy số "trước"
 * và "sau" không lệch vì hai lượt dựng khác nhau hay máy đang rảnh/bận khác
 * nhau.
 *
 * Bài này **không** có ngưỡng đỏ: nó in số. Chốt ngưỡng là quyết định của người
 * dùng, chưa có (cùng lý do với bảng §8d).
 */

const PROJECT_ID = 'P-01';
const PASCAL_VIEWER_PATH = ROUTE_PATTERNS.projectViewerPascal.replace(':projectId', PROJECT_ID);
const PASCAL_FLAG_KEY = 'scene.pascal-viewer';
const SCREEN_REGION_NAME = 'Mô hình 3D';
const SUCCESS_CAPTION = 'Đã dựng xong toàn bộ bản vẽ.';
const VIEWPORT = { width: 1440, height: 900 } as const;
/* Rộng hơn `pascal-viewer.spec.ts` (60 s): gói Pascal 14,7 MB và cảnh mẫu đầy
   đủ, trên một máy đang chạy nhiều lượt dựng khác thì "đã dựng xong" tới muộn. */
const PASCAL_RENDER_TIMEOUT_MS = 150_000;

/** Mỗi khoảng đo. 10 s theo đúng chữ của việc T3. */
const SAMPLE_MS = 10_000;

/** Đăng nhập + nạp gói Pascal + dựng cảnh + hai khoảng 10 s, cho cả hai nhánh. */
const TEST_TIMEOUT_MS = 900_000;

type CpuSample = {
  /** Mili giây CPU luồng chính mỗi giây đồng hồ — mọi task của trang. */
  readonly taskMsPerSecond: number;
  /** Phần của nó là JavaScript. */
  readonly scriptMsPerSecond: number;
};

/**
 * Chênh `TaskDuration`/`ScriptDuration` quanh `during()`, quy về mỗi giây.
 *
 * Hai đại lượng ấy là **tổng dồn** từ lúc trang mở, nên phải lấy chênh; và phải
 * chia cho thời gian đồng hồ thật (`Timestamp` của chính CDP) chứ không cho
 * `SAMPLE_MS`, vì một `waitForTimeout` không bao giờ dài đúng bằng con số đặt.
 */
async function measureCpu(page: Page, during: () => Promise<void>): Promise<CpuSample> {
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  const read = async () => {
    const { metrics } = await session.send('Performance.getMetrics');
    const value = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
    return {
      task: value('TaskDuration'),
      script: value('ScriptDuration'),
      at: value('Timestamp'),
    };
  };

  const before = await read();
  await during();
  const after = await read();
  await session.detach();

  const seconds = after.at - before.at;
  return {
    taskMsPerSecond: ((after.task - before.task) / seconds) * 1000,
    scriptMsPerSecond: ((after.script - before.script) / seconds) * 1000,
  };
}

/** Mở màn ở một nhánh vòng khung và chờ cảnh dựng xong thật. */
async function openViewer(page: Page, search: string): Promise<void> {
  await enableFlags(page, [PASCAL_FLAG_KEY]);
  await page.setViewportSize(VIEWPORT);
  /* Route nằm sau `SessionBootstrap`: `goto` thẳng rơi về `/login`, nên đi qua
     biểu mẫu thật và để `?next=` đưa sang màn — cùng đường
     `signInThenOpenPascalViewer` của `e2e/pascal-viewer.spec.ts`. */
  if (!page.url().includes(PASCAL_VIEWER_PATH)) {
    await page.goto(`${ROUTE_PATTERNS.login}?next=${encodeURIComponent(PASCAL_VIEWER_PATH)}`);
    await submitSignInForm(page, EMAIL_BY_ROLE.engineer);
    await expect(page.getByRole('region', { name: SCREEN_REGION_NAME })).toBeVisible({
      timeout: PASCAL_RENDER_TIMEOUT_MS,
    });
  }
  /* Nhánh vòng khung đi bằng query, nên lượt điều hướng thật xảy ra SAU khi đã
     có phiên: `?next=` mang theo query bị trả về đường không query. */
  await page.goto(`${PASCAL_VIEWER_PATH}${search}`);
  await expect(page.getByRole('region', { name: SCREEN_REGION_NAME })).toBeVisible({
    timeout: PASCAL_RENDER_TIMEOUT_MS,
  });
  await expect(page.getByTestId('pascal-canvas').locator('canvas')).toHaveCount(1, {
    timeout: PASCAL_RENDER_TIMEOUT_MS,
  });
  await expect(page.getByText(SUCCESS_CAPTION)).toBeVisible({
    timeout: PASCAL_RENDER_TIMEOUT_MS,
  });
  /* Cảnh vừa báo xong vẫn còn đuôi việc (vật liệu KTX2, lượt dựng tường cuối).
     Đo ngay lúc ấy là đo lượt dựng, không phải đo cảnh đứng yên. */
  await page.waitForTimeout(3_000);
}

/** Kéo chuột qua canvas suốt khoảng đo — đường xoay camera của người dùng thật. */
async function dragAcrossCanvas(page: Page, durationMs: number): Promise<void> {
  const box = await page.getByTestId('pascal-canvas').boundingBox();
  if (!box) throw new Error('không thấy hộp canvas');
  const midY = box.y + box.height / 2;
  const fromX = box.x + box.width * 0.35;
  const toX = box.x + box.width * 0.65;

  await page.mouse.move(fromX, midY);
  await page.mouse.down();
  const until = Date.now() + durationMs;
  let forward = true;
  while (Date.now() < until) {
    await page.mouse.move(forward ? toX : fromX, midY, { steps: 20 });
    forward = !forward;
  }
  await page.mouse.up();
}

async function reportArm(page: Page, label: string, search: string) {
  await openViewer(page, search);
  const idle = await measureCpu(page, () => page.waitForTimeout(SAMPLE_MS));
  const dragging = await measureCpu(page, () => dragAcrossCanvas(page, SAMPLE_MS));
  const line = (name: string, s: CpuSample) =>
    `${label} · ${name}: task ${s.taskMsPerSecond.toFixed(1)} ms/s · script ${s.scriptMsPerSecond.toFixed(1)} ms/s`;
  console.log(line('cảnh đứng yên 10 s', idle));
  console.log(line('xoay camera 10 s  ', dragging));
  return { idle, dragging };
}

test.describe('CPU luồng chính của viewer Pascal', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT_MS });

  test('vẽ theo nhu cầu tốn ít CPU hơn vẽ mỗi nhịp, khi cảnh đứng yên', async ({ page }) => {
    const always = await reportArm(page, 'mỗi nhịp (?frameloop=always)', '?frameloop=always');
    const demand = await reportArm(page, 'theo nhu cầu (mặc định)    ', '');

    console.log(
      `tỉ số cảnh đứng yên: ${(demand.idle.taskMsPerSecond / always.idle.taskMsPerSecond).toFixed(3)} · ` +
        `tỉ số xoay camera: ${(demand.dragging.taskMsPerSecond / always.dragging.taskMsPerSecond).toFixed(3)}`,
    );

    /* Hàng rào duy nhất, và nó đo `ScriptDuration` chứ không `TaskDuration`:
       đo 2026-10-13 trên máy này, cảnh đứng yên 10 s cho script 49,8 -> 10,0
       ms/s (-80 %) nhưng task chỉ 82,7 -> 48,5 (-41 %), vì `TaskDuration` còn
       gồm cả phần không phải vòng khung (rAF rỗng, GC, công việc React của
       chính màn). Phần việc T3 cắt được là phần script. Cổng đặt ở 50 % để một
       máy đang bận không làm bài đỏ oan; số thật in ở trên. */
    expect(demand.idle.scriptMsPerSecond).toBeLessThan(always.idle.scriptMsPerSecond * 0.5);
  });
});
