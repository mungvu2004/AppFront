import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixtureF1 } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';

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
 * bản dựng, một máy, một phiên** trên trang `editor3d.html`: `&disable=idle` tắt
 * realism-idle (vẽ mỗi nhịp, không cổng nhu cầu), không tham số thì theo lối mới. Nhờ vậy số "trước"
 * và "sau" không lệch vì hai lượt dựng khác nhau hay máy đang rảnh/bận khác
 * nhau.
 *
 * Bài này **không** có ngưỡng đỏ: nó in số. Chốt ngưỡng là quyết định của người
 * dùng, chưa có (cùng lý do với bảng §8d).
 */

const PROJECT_ID = 'P-FIXTURE0001';
const VIEWPORT = { width: 1440, height: 900 } as const;
/* Rộng hơn `pascal-viewer.spec.ts` (60 s): gói Pascal 14,7 MB và cảnh mẫu đầy
   đủ, trên một máy đang chạy nhiều lượt dựng khác thì "đã dựng xong" tới muộn. */
const PASCAL_RENDER_TIMEOUT_MS = 150_000;

/** Mỗi khoảng đo. 10 s theo đúng chữ của việc T3. */
const SAMPLE_MS = 10_000;

/** Đăng nhập + nạp gói Pascal + dựng cảnh + hai khoảng 10 s, cho cả hai nhánh. */
const TEST_TIMEOUT_MS = 900_000;

interface CpuSample {
  /** Mili giây CPU luồng chính mỗi giây đồng hồ — mọi task của trang. */
  readonly taskMsPerSecond: number;
  /** Phần của nó là JavaScript. */
  readonly scriptMsPerSecond: number;
}

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
/**
 * Trang 3D Pascal riêng (`editor3d.html`, từ 29eba219) với bộ F1 qua máy chủ giả. Nhánh
 * "vẽ mỗi nhịp" là `disable=idle` (tắt realism-idle, cùng cờ `pascal-realism-bench.spec.ts`).
 */
async function openViewer(page: Page, search: string): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  if (!fakeApiInstalled.has(page)) {
    await installFakeApi(page, { projectId: PROJECT_ID, graphDoc: fixtureF1({ ext: false }).doc as unknown as WireGraphDocument });
    fakeApiInstalled.add(page);
  }
  await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1${search}`);
  await page.waitForFunction(
    () => {
      const probe = (window as unknown as { __pascalProbe?: { ready(): boolean; counts(): Record<string, number> } }).__pascalProbe;
      return probe?.ready() === true && (probe.counts()['wall'] ?? 0) > 0;
    },
    null,
    { timeout: PASCAL_RENDER_TIMEOUT_MS },
  );
  /* Cảnh vừa báo xong vẫn còn đuôi việc (vật liệu KTX2, lượt dựng tường cuối).
     Đo ngay lúc ấy là đo lượt dựng, không phải đo cảnh đứng yên. */
  await page.waitForTimeout(3_000);
}

const fakeApiInstalled = new WeakSet<Page>();

async function dragAcrossCanvas(page: Page, durationMs: number): Promise<void> {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('không thấy canvas');
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
    const always = await reportArm(page, 'mỗi nhịp (disable=idle)      ', '&disable=idle');
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
