/**
 * Bộ đo nghiệm thu màn xem trên di động (T4).
 *
 * Chép đúng khuôn `scripts/measure-viewer3d.mjs` — dev server Vite thật, Chrome
 * cài sẵn trên máy kèm cờ ANGLE d3d11 để chạm GPU THẬT (SwiftShader phần mềm
 * mà Chromium đóng gói dùng mặc định cho ra số vô nghĩa), xác nhận renderer qua
 * `WEBGL_debug_renderer_info`, nhập động tới `src/lib/three/**` bằng đường dẫn
 * tuyệt đối và nhập `three` qua `/@id/three` để chắc chắn cùng một bản ba.js.
 * Khác bản ba.js thì `instanceof` không khớp và số đếm sai LẶNG LẼ.
 *
 * Hai điểm khác bản máy tính, và chỉ hai điểm đó:
 *
 * 1. Ngưỡng là `SCENE_BUDGET.minFrameRate.mobile` (30), không phải `.desktop`
 *    (45). Đọc từ file, không gõ cứng.
 * 2. Máy được giả lập là một điện thoại tầm trung: khung nhìn 390x844,
 *    `deviceScaleFactor` 3, `isMobile`/`hasTouch`, user agent Android, và CPU
 *    bị bóp {@link CPU_THROTTLE_RATE}x qua CDP `Emulation.setCPUThrottlingRate`.
 *    Hệ số 4x là máy tầm trung — không phải máy đầu bảng (1x–2x), cũng không
 *    phải máy rẻ tiền (6x+). Hệ số đã dùng được IN RA cùng số đo, vì một con
 *    số fps không nói được gì nếu không biết nó đo trên cái máy nào.
 *
 * Bản nghiệm thu đòi HAI con số ở phép đo 1, không phải một: fps, VÀ mức chi
 * tiết (`DetailLevel`) mà `PerfMonitor` chọn ở cuối lần đo — vì R-04 không nói
 * "fps phải trên 30", nó nói "fps dưới 30 thì phải hạ mức chi tiết". Một lần đo
 * tụt xuống 22 fps rồi hạ xuống `reduced` là ĐÚNG luật; tụt xuống 22 fps mà vẫn
 * ở `full` là hỏng. Nên cả hai con số cùng được in, và cả việc CÓ hạ mức giữa
 * chừng hay không.
 *
 * Phép đo 2 (vùng bấm ≥ 44px) cần màn thật tồn tại. Lúc viết script này màn
 * CHƯA có: `src/routes/paths.ts` không khai route nào dưới `/m/`, nên
 * `/m/du-an/<id>` rơi vào route bắt tất `*` và dựng màn NotFound. Script phát
 * hiện việc đó bằng HAI dấu hiệu độc lập (khai báo route trong nguồn, và nội
 * dung thật trong DOM) rồi in "CHƯA CHẠY" — mục E.10: cấm báo "đạt" cho bước
 * chưa chạy. Khi màn thật lên route đó, không phải sửa gì trong file này: cùng
 * một lệnh sẽ tự chạy phép đo thật.
 *
 * Về `import('/src/...')` và `import/no-absolute-path`: cổng lint của dự án là
 * `eslint . --ext ts,tsx`, không mở file `.mjs` nào. Ép `--ext mjs` thì rule đó
 * báo lỗi ở đây (7 chỗ) đúng như nó báo ở `measure-viewer3d.mjs` (11 chỗ) —
 * đây là đường dẫn Vite dev-serve, cố ý, không phải import Node. Đừng "sửa"
 * nó thành đường dẫn tương đối: Vite sẽ không phục vụ được và phép đo chết.
 *
 * Bộ mẫu hình học (48 tường / 14 phòng / 34 ô mở mỗi tầng, 4 tầng) chép lại
 * đúng bộ mẫu chuẩn của gói dựng hình ba chiều (`buildQueue.test.ts`) — không
 * phải bộ mẫu "34 phòng, 248,60 m²" của A14 (bộ đó phục vụ tô màu/diện tích).
 * Như bản máy tính, phép đo 1 KHÔNG dùng LOD hay gộp lưới: đây là ngân sách
 * XẤU NHẤT có chủ đích, cả 4 tầng luôn ở rung 'full'.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const useShell = process.platform === 'win32';
const packageRunner = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

/* -------------------------------------------------------------------------- */
/* Hằng số giả lập điện thoại tầm trung.                                       */
/* -------------------------------------------------------------------------- */

/**
 * Hệ số bóp CPU. 4x = điện thoại tầm trung so với máy để bàn chạy phép đo.
 * Con số này được IN RA trong báo cáo — một fps không kèm hệ số bóp là một fps
 * không so sánh được với bất cứ lần đo nào khác.
 */
const CPU_THROTTLE_RATE = 4;

/** Khung nhìn chính: cỡ một điện thoại 6,1 inch hiện đại. */
const VIEWPORT_PRIMARY = { width: 390, height: 844 };

/** Khung nhìn hẹp nhất còn phải phục vụ được. */
const VIEWPORT_NARROW = { width: 320, height: 568 };

/** Màn hình 3x — đúng mật độ điểm ảnh thật của máy tầm trung trở lên. */
const DEVICE_SCALE_FACTOR = 3;

/** User agent một máy Android tầm trung. */
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Mobile Safari/537.36';

/** Cạnh nhỏ nhất một vùng bấm được phép có, tính bằng điểm ảnh CSS. */
const MIN_TAP_TARGET_PX = 44;

/** Bộ chọn "bấm được" mà phép đo 2 quét. */
const TAPPABLE_SELECTOR = 'button, a, [role="button"], [tabindex]';

/** Bộ chọn "nhập liệu được" — màn này chỉ đọc, phải tìm ra 0 cái. */
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]';

/**
 * Dấu vết màn NotFound trong DOM — bằng chứng route rơi vào route bắt tất `*`.
 *
 * Hai dấu, khớp KHÔNG phân biệt hoa thường: nhãn giao diện là chữ thường kiểu
 * câu (A6) nên "Không tìm thấy trang này" trong `notFoundScenarios.ts` dựng ra
 * "không tìm thấy trang này" trên màn thật. Mã lỗi `mã lỗi: 404` là dấu thứ
 * hai và là dấu chắc hơn: nó do `NOT_FOUND_ERROR_CODE` sinh ra, không đổi theo
 * cách viết hoa hay theo lý do (`missing` / `forbidden`).
 */
const NOT_FOUND_MARKERS = ['không tìm thấy trang này', 'mã lỗi: 404'];

const DEFAULTS = {
  path: '/m/du-an/da-01',
  baseUrl: 'http://127.0.0.1:5173',
  durationS: 30,
  cpuThrottle: CPU_THROTTLE_RATE,
  headed: false,
};

const HELP_TEXT = `
Bộ đo nghiệm thu màn xem trên di động (T4)

Dùng:
  node scripts/measure-mobile-viewer.mjs [tuỳ chọn]

Tuỳ chọn:
  --path <đường-dẫn>   Route màn di động mà PHÉP ĐO 2 mở. Mặc định
                        "/m/du-an/da-01". Phép đo 1 KHÔNG phụ thuộc route này:
                        nó tự dựng scene bằng import động ngay trong trang, nên
                        chạy được kể cả khi màn chưa tồn tại.
  --base-url <url>      Gốc dev server. Mặc định http://127.0.0.1:5173. Server
                        đang chạy sẵn ở đó thì dùng lại; chưa thì script tự mở
                        "vite --host 127.0.0.1" rồi tắt khi đo xong.
  --duration-s <số>     Độ dài phép đo 1 (quay liên tục), tính bằng giây.
                        Mặc định 30.
  --cpu-throttle <số>   Hệ số bóp CPU của phép đo 1. Mặc định ${CPU_THROTTLE_RATE}
                        (điện thoại tầm trung). Hệ số thật dùng được in ra.
  --headed              Mở cửa sổ Chrome thật thay vì chạy ẩn (để gỡ lỗi).
  --help                In hướng dẫn này rồi thoát.

Mã thoát:
  0  cả hai phép đo ĐẠT, hoặc phép đo 1 ĐẠT còn phép đo 2 CHƯA CHẠY được vì
     màn chưa tồn tại (bảng tổng kết ghi rõ "CHƯA CHẠY", không ghi "đạt").
  1  bất kỳ phép đo nào KHÔNG ĐẠT, hoặc phép đo 1 không kết luận được vì môi
     trường không cho chạm GPU thật (renderer là phần mềm) — im lặng coi
     "không kết luận được" là "đạt" sẽ che mất đúng thứ R-04 cần biết.
`;

function parseArgs(argv) {
  const args = { ...DEFAULTS, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }

    const [flag, inlineValue] = raw.split('=');
    const takeValue = () => {
      if (inlineValue !== undefined) {
        return inlineValue;
      }
      index += 1;
      return argv[index];
    };

    switch (flag) {
      case '--path':
        args.path = takeValue();
        break;
      case '--base-url':
        args.baseUrl = takeValue();
        break;
      case '--duration-s':
        args.durationS = Number(takeValue());
        break;
      case '--cpu-throttle':
        args.cpuThrottle = Number(takeValue());
        break;
      case '--headed':
        args.headed = true;
        break;
      default:
        throw new Error(`Tham số không nhận diện được: "${raw}". Xem --help.`);
    }
  }

  if (!Number.isFinite(args.durationS) || args.durationS <= 0) {
    throw new Error('--duration-s phải là một số dương.');
  }
  if (!Number.isFinite(args.cpuThrottle) || args.cpuThrottle < 1) {
    throw new Error('--cpu-throttle phải là một số ≥ 1.');
  }

  return args;
}

/* -------------------------------------------------------------------------- */
/* Vòng đời dev server — chép lại đúng cách scripts/run-playwright.mjs làm.    */
/* -------------------------------------------------------------------------- */

function requestUrl(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await requestUrl(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Hết thời gian chờ dev server ở ${url}.`);
}

function stopProcessTree(childProcess) {
  if (childProcess.pid === undefined) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(childProcess.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }

  try {
    process.kill(-childProcess.pid, 'SIGTERM');
  } catch {
    childProcess.kill('SIGTERM');
  }
}

/* -------------------------------------------------------------------------- */
/* Trình duyệt — Chrome hệ thống + cờ ANGLE để chạm GPU thật.                  */
/* -------------------------------------------------------------------------- */

const GPU_ANGLE_ARGS = [
  '--use-gl=angle',
  '--use-angle=d3d11',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--enable-webgl2',
];

async function launchBrowser(headed) {
  try {
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: !headed,
      args: GPU_ANGLE_ARGS,
    });
    return { browser, launchNote: 'Chrome hệ thống (channel "chrome") + cờ ANGLE d3d11.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`\nKhông mở được Chrome hệ thống (channel "chrome"): ${message}`);
    console.warn('Dùng Chromium đóng gói sẵn của Playwright thay thế — nhiều khả năng renderer sẽ là phần mềm.\n');
    const browser = await chromium.launch({ headless: !headed });
    return {
      browser,
      launchNote:
        'Chromium đóng gói của Playwright (không mở được Chrome hệ thống) — khả năng cao là renderer phần mềm.',
    };
  }
}

/** Một ngữ cảnh điện thoại: khung nhìn, mật độ điểm ảnh, cảm ứng, user agent. */
async function openMobileContext(browser, viewport) {
  return browser.newContext({
    viewport,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true,
    userAgent: MOBILE_USER_AGENT,
  });
}

/**
 * Bóp CPU qua CDP. Trả về hệ số THẬT đã đặt được, hoặc `null` khi không đặt
 * được — báo cáo in ra con số này chứ không in con số đã YÊU CẦU, vì hai thứ
 * đó khác nhau khi CDP không sẵn sàng.
 */
async function throttleCpu(context, page, rate) {
  try {
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate });
    return rate;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`\nKhông bóp được CPU qua CDP (${message}) — số đo sẽ là của máy chạy, không phải của điện thoại.\n`);
    return null;
  }
}

async function probeGpu(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl === null) {
      return { renderer: null, vendor: null, isSoftware: true };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    const vendor = String(
      debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    );
    const lowered = renderer.toLowerCase();
    const isSoftware =
      lowered.includes('swiftshader') ||
      lowered.includes('llvmpipe') ||
      lowered.includes('software') ||
      lowered.includes('microsoft basic render');

    return { renderer, vendor, isSoftware };
  });
}

/* -------------------------------------------------------------------------- */
/* Phép đo 1 — fps + mức chi tiết trên thiết bị giả lập tầm trung.             */
/* -------------------------------------------------------------------------- */

async function measureMobileFrameRate(page, durationS, viewport) {
  return page.evaluate(
    async ({ durationMs, width, height }) => {
      const THREE = await import('/@id/three');
      const { millimetres } = await import('/src/domain/units/types.ts');
      const { buildFloorMesh, SLAB_THICKNESS_MM } = await import('/src/lib/three/build/floor.ts');
      const { MaterialCache, paintByPartKind } = await import('/src/lib/three/perf/materialCache.ts');
      const { PerfMonitor, DEGRADE_FRAME_RATE, DEGRADE_WINDOW_MS } = await import('/src/lib/three/perf/monitor.ts');
      const { SCENE_BUDGET, measureScene, readRenderInfo } = await import('/src/lib/three/perf/budget.ts');
      const { DETAIL_LEVELS } = await import('/src/lib/three/build/lod.ts');

      /* ---- Bộ mẫu: 4 tầng, mỗi tầng 48 tường / 14 phòng / 34 ô mở (đúng bộ
       * mẫu buildQueue.test.ts) — walls dịch lên theo cao độ từng tầng, rooms
       * và openings dùng chung vì chỉ mô tả hình dạng mặt bằng/vị trí trên
       * tường, không mang cao độ tuyệt đối. ---- */
      const WALL_COUNT = 48;
      const OPENING_COUNT = 34;
      const ROOM_COUNT = 14;
      const FLOOR_COUNT = 4;
      const FLOOR_HEIGHT_MM = 3000;
      const FLOOR_PITCH_MM = FLOOR_HEIGHT_MM + SLAB_THICKNESS_MM;

      function pointAt(x, y) {
        return { x: millimetres(x), y: millimetres(y) };
      }
      function twoDigits(value) {
        return value < 10 ? `0${value}` : `${value}`;
      }
      function makeWalls(elevationMm) {
        return Array.from({ length: WALL_COUNT }, (_unused, index) => {
          const alongMm = Math.floor(index / 6) * 5000;
          const acrossMm = (index % 6) * 6000;
          return {
            id: `W-${twoDigits(index + 1)}`,
            kind: 'partition',
            centreline: { start: pointAt(alongMm, acrossMm), end: pointAt(alongMm + 4000, acrossMm) },
            thicknessMm: millimetres(200),
            baseElevationMm: millimetres(elevationMm),
            topElevationMm: millimetres(elevationMm + FLOOR_HEIGHT_MM),
          };
        });
      }
      const OPENINGS = Array.from({ length: OPENING_COUNT }, (_unused, index) => ({
        id: `D-${twoDigits(index + 1)}`,
        kind: 'door',
        widthMm: millimetres(900),
        heightMm: millimetres(2100),
        sillHeightMm: millimetres(0),
        swing: 'left',
        wallId: `W-${twoDigits(index + 1)}`,
        relativePosition: 0.5,
      }));
      const ROOMS = Array.from({ length: ROOM_COUNT }, (_unused, index) => {
        const offsetMm = index * 6000;
        return {
          id: `R-${twoDigits(index + 1)}`,
          outline: [
            pointAt(offsetMm, 0),
            pointAt(offsetMm + 5000, 0),
            pointAt(offsetMm + 5000, 4000),
            pointAt(offsetMm, 4000),
          ],
        };
      });

      function buildLevelInput(floorIndex) {
        const elevationMm = floorIndex * FLOOR_PITCH_MM;
        return {
          level: {
            id: `L-${twoDigits(floorIndex + 1)}`,
            elevationMm: millimetres(elevationMm),
            heightMm: millimetres(FLOOR_HEIGHT_MM),
          },
          walls: makeWalls(elevationMm),
          rooms: ROOMS,
          openings: OPENINGS,
        };
      }

      const PAINT_COLOR_BY_KIND = {
        wall: 0x9aa0a6,
        floorSlab: 0xc9c9c9,
        ceiling: 0xe8e8e8,
        opening: 0x6f9bd1,
        level: 0xaaaaaa,
        furniture: 0xaaaaaa,
      };

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xdfe3e6);

      const cache = new MaterialCache();
      for (let floorIndex = 0; floorIndex < FLOOR_COUNT; floorIndex += 1) {
        const floorGroup = buildFloorMesh(buildLevelInput(floorIndex));
        paintByPartKind(
          floorGroup,
          cache,
          (kind) => new THREE.MeshStandardMaterial({ color: PAINT_COLOR_BY_KIND[kind] ?? 0x999999, roughness: 0.9 }),
        );
        scene.add(floorGroup);
      }

      scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.0);
      sun.position.set(40, 80, 40);
      scene.add(sun);

      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(size.x, size.z) * 0.9 + 8;
      const cameraHeight = center.y + size.y * 0.35;

      /* Kích thước vẽ là kích thước THẬT của khung nhìn điện thoại nhân mật độ
       * điểm ảnh thật — một điện thoại 3x phải đẩy gấp chín lần số điểm ảnh của
       * cùng khung nhìn ở 1x, và đó chính là phần việc phép đo này nhắm tới. */
      const pixelRatio = window.devicePixelRatio;
      const canvas = document.createElement('canvas');
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      document.body.appendChild(canvas);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);

      const graphicsMemoryMb = measureScene(scene).graphicsMemoryMb;

      const REVOLUTION_MS = 12_000;
      /* Khai TRƯỚC monitor: `onDegrade` đóng gói biến này để ghi lại mốc thời
       * gian của lần hạ mức, và một `const` khai sau sẽ nằm trong vùng chết. */
      const startedAtMs = performance.now();

      const samples = [];
      const degrades = [];
      const monitor = new PerfMonitor({
        read: () => readRenderInfo(renderer.info, graphicsMemoryMb),
        profile: 'mobile',
        onSample: (sample) => samples.push(sample),
        onDegrade: (action) =>
          degrades.push({
            detail: action.detail,
            shadows: action.shadows,
            frameRate: action.frameRate,
            belowMs: action.belowMs,
            message: action.message,
            atMs: performance.now() - startedAtMs,
          }),
      });

      await new Promise((resolve) => {
        function frame(nowMs) {
          const elapsedMs = nowMs - startedAtMs;
          const angle = (elapsedMs / REVOLUTION_MS) * Math.PI * 2;
          camera.position.set(
            center.x + radius * Math.cos(angle),
            cameraHeight,
            center.z + radius * Math.sin(angle),
          );
          camera.lookAt(center);
          renderer.render(scene, camera);
          monitor.frame();

          if (elapsedMs < durationMs) {
            requestAnimationFrame(frame);
          } else {
            resolve(undefined);
          }
        }
        requestAnimationFrame(frame);
      });

      const frameRates = samples.map((sample) => sample.frameRate);
      const lastSample = samples[samples.length - 1] ?? null;
      const belowThresholdSamples = frameRates.filter((rate) => rate < SCENE_BUDGET.minFrameRate.mobile).length;

      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();

      return {
        sampleCount: samples.length,
        minFps: frameRates.length > 0 ? Math.min(...frameRates) : 0,
        avgFps:
          frameRates.length > 0 ? frameRates.reduce((sum, value) => sum + value, 0) / frameRates.length : 0,
        belowThresholdSamples,
        /* Ngưỡng ĐỌC TỪ FILE, không gõ cứng. */
        thresholdMobileFps: SCENE_BUDGET.minFrameRate.mobile,
        degradeFrameRate: DEGRADE_FRAME_RATE,
        degradeWindowMs: DEGRADE_WINDOW_MS,
        detailLevels: [...DETAIL_LEVELS],
        /* Hai con số bản nghiệm thu đòi: fps ở trên, mức chi tiết ở đây. */
        finalDetail: monitor.detail,
        isDegraded: monitor.isDegraded,
        shadows: monitor.shadows,
        degrades,
        drawCallsBudget: SCENE_BUDGET.maxDrawCalls,
        trianglesBudget: SCENE_BUDGET.maxTriangles,
        lastDrawCalls: lastSample ? lastSample.drawCalls : null,
        lastTriangles: lastSample ? lastSample.triangles : null,
        graphicsMemoryMb,
        pixelRatio,
        drawWidth: Math.round(width * pixelRatio),
        drawHeight: Math.round(height * pixelRatio),
      };
    },
    { durationMs: durationS * 1000, width: viewport.width, height: viewport.height },
  );
}

/* -------------------------------------------------------------------------- */
/* Phép đo 2 — vùng bấm ≥ 44px, và không có ô nhập liệu nào.                   */
/* -------------------------------------------------------------------------- */

/**
 * Dấu hiệu THỨ NHẤT rằng màn chưa tồn tại: bảng route trong nguồn không khai
 * đường dẫn nào khớp. Đọc `src/routes/paths.ts` thay vì đoán, vì đó là nơi duy
 * nhất route được khai (`src/routes/router.tsx` chỉ đọc lại từ đó).
 */
function findDeclaredMobileRoutes() {
  const source = fs.readFileSync(path.join(projectRoot, 'src/routes/paths.ts'), 'utf8');
  const matches = source.match(/['"`](\/m\/[^'"`]*)['"`]/g) ?? [];
  return matches.map((raw) => raw.slice(1, -1));
}

/**
 * Dấu hiệu THỨ HAI: cái gì thật sự dựng ra trong DOM. Route bắt tất `*` dựng
 * màn NotFound, nên tiêu đề của nó là bằng chứng route không tồn tại — mạnh
 * hơn "không tìm thấy nút nào", vì một màn thật đang hỏng cũng cho ra 0 nút.
 */
async function probeRoutePresence(page) {
  return page.evaluate(
    ({ notFoundMarkers, tappableSelector }) => {
      /* `innerText`, không `textContent`: `textContent` gộp cả nội dung thẻ
       * <style> mà NotFound.tsx nhúng vào, nên mẫu in ra là CSS chứ không phải
       * chữ người đọc thấy. */
      const bodyText = document.body.innerText ?? '';
      const lowered = bodyText.toLowerCase();
      const matched = notFoundMarkers.filter((marker) => lowered.includes(marker));
      return {
        notFoundRendered: matched.length > 0,
        matchedMarkers: matched,
        tappableCount: document.querySelectorAll(tappableSelector).length,
        hasCanvas: document.querySelector('canvas') !== null,
        bodyTextSample: bodyText.trim().replace(/\s+/g, ' ').slice(0, 160),
      };
    },
    { notFoundMarkers: NOT_FOUND_MARKERS, tappableSelector: TAPPABLE_SELECTOR },
  );
}

async function measureTapTargets(page) {
  return page.evaluate(
    ({ tappableSelector, editableSelector, minPx }) => {
      function describe(element) {
        const label =
          element.getAttribute('aria-label') ??
          element.getAttribute('title') ??
          (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const tag = element.tagName.toLowerCase();
        const role = element.getAttribute('role');
        return label.length > 0 ? `${tag}${role ? `[${role}]` : ''} "${label}"` : `${tag}${role ? `[${role}]` : ''}`;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const rows = [];

      for (const element of document.querySelectorAll(tappableSelector)) {
        const rect = element.getBoundingClientRect();
        /* Chỉ tính cái đang nằm TRONG khung nhìn và thật sự nhìn thấy được:
         * một nút bị ẩn (0x0) hay đã cuộn ra ngoài không phải vùng bấm. */
        if (rect.width === 0 || rect.height === 0) {
          continue;
        }
        const inViewport =
          rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
        if (!inViewport) {
          continue;
        }
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') {
          continue;
        }

        rows.push({
          label: describe(element),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          passed: rect.width >= minPx && rect.height >= minPx,
        });
      }

      const editableElements = Array.from(document.querySelectorAll(editableSelector)).map((element) => ({
        label: describe(element),
        type: element.getAttribute('type'),
      }));

      return { rows, editableElements, viewportWidth, viewportHeight };
    },
    { tappableSelector: TAPPABLE_SELECTOR, editableSelector: EDITABLE_SELECTOR, minPx: MIN_TAP_TARGET_PX },
  );
}

/* -------------------------------------------------------------------------- */
/* In báo cáo.                                                                 */
/* -------------------------------------------------------------------------- */

const formatFixed = (value, decimals) => value.toFixed(decimals).replace('.', ',');

function printEnvironmentReport(launchNote, gpuInfo, appliedThrottle, requestedThrottle) {
  console.log('\nMôi trường đo — điện thoại tầm trung giả lập\n');
  console.log(`  Trình duyệt     : ${launchNote}`);
  console.log(`  Renderer GPU    : ${gpuInfo.renderer ?? '(không lấy được)'}`);
  console.log(`  Nhà cung cấp    : ${gpuInfo.vendor ?? '(không lấy được)'}`);
  console.log(
    `  Nguồn số đo     : ${
      gpuInfo.isSoftware
        ? 'PHẦN MỀM (SwiftShader/llvmpipe hoặc tương đương) — số dưới đây KHÔNG kết luận được về hiệu năng GPU thật'
        : 'GPU thật của máy'
    }`,
  );
  console.log(`  Khung nhìn      : ${VIEWPORT_PRIMARY.width}x${VIEWPORT_PRIMARY.height} CSS px`);
  console.log(`  deviceScaleFactor: ${DEVICE_SCALE_FACTOR}   ·   isMobile: true   ·   hasTouch: true`);
  console.log(`  User agent      : ${MOBILE_USER_AGENT}`);
  console.log(
    `  Bóp CPU         : ${
      appliedThrottle === null
        ? `KHÔNG ĐẶT ĐƯỢC (đã yêu cầu ${requestedThrottle}x) — số đo là của máy chạy, không phải của điện thoại`
        : `${appliedThrottle}x qua CDP Emulation.setCPUThrottlingRate`
    }`,
  );
}

function printFrameRateReport(measurement) {
  console.log('\nPhép đo 1 — fps và mức chi tiết, quay liên tục quanh mô hình 4 tầng (không LOD, không gộp lưới)\n');
  console.log(
    `  Vẽ ở            : ${measurement.drawWidth}x${measurement.drawHeight} điểm ảnh thật (pixelRatio ${measurement.pixelRatio})`,
  );
  console.log(`  Số mẫu 500ms    : ${measurement.sampleCount}`);
  console.log('');
  console.log('  --- Con số thứ nhất: fps ---');
  console.log(
    `  fps nhỏ nhất    : ${formatFixed(measurement.minFps, 1).padStart(8)}   (ngưỡng ≥ ${measurement.thresholdMobileFps} — SCENE_BUDGET.minFrameRate.mobile, đọc từ file)`,
  );
  console.log(
    `  fps trung bình  : ${formatFixed(measurement.avgFps, 1).padStart(8)}   (tham khảo, không phải ngưỡng đạt/hỏng)`,
  );
  console.log(
    `  Số mẫu dưới ngưỡng: ${measurement.belowThresholdSamples} / ${measurement.sampleCount}`,
  );
  console.log('');
  console.log('  --- Con số thứ hai: mức chi tiết PerfMonitor chọn ---');
  console.log(`  Thang mức chi tiết: ${measurement.detailLevels.join(' → ')}`);
  console.log(`  Mức ở CUỐI lần đo : ${measurement.finalDetail}`);
  console.log(`  Bóng đổ ở cuối    : ${measurement.shadows}`);
  console.log(
    `  Có hạ mức giữa chừng: ${measurement.isDegraded ? 'CÓ' : 'KHÔNG'}   (ngưỡng hạ mức ${measurement.degradeFrameRate} fps liên tục ${measurement.degradeWindowMs} ms — R-04)`,
  );
  if (measurement.degrades.length > 0) {
    for (const action of measurement.degrades) {
      console.log(
        `    - tại giây ${formatFixed(action.atMs / 1000, 1)}: xuống "${action.detail}", bóng "${action.shadows}", fps lúc đó ${formatFixed(action.frameRate, 1)}, đã dưới ngưỡng ${formatFixed(action.belowMs / 1000, 1)} giây`,
      );
      console.log(`      ${action.message}`);
    }
  } else {
    console.log('    - không có lần hạ mức nào: fps chưa bao giờ ở dưới ngưỡng đủ lâu để R-04 phải can thiệp.');
  }
  console.log('');
  console.log(
    `  draw call/tam giác mẫu cuối: ${measurement.lastDrawCalls} / ${measurement.lastTriangles}` +
      ` (ngân sách gộp lưới thật: ≤ ${measurement.drawCallsBudget} draw, ≤ ${measurement.trianglesBudget} tam giác —` +
      ' KHÔNG áp dụng ở đây vì phép đo này cố tình không gộp lưới, xem ghi chú đầu file)',
  );
  console.log(`  Bộ nhớ đồ hoạ ước lượng: ${formatFixed(measurement.graphicsMemoryMb, 2)} MB`);
}

/**
 * Chấm phép đo 1. Ba kết quả, không phải hai:
 *
 * - `inconclusive` khi renderer là phần mềm — không kết luận được, KHÔNG "đạt".
 * - `passed` khi fps nhỏ nhất ở trên ngưỡng, HOẶC khi nó tụt xuống dưới và
 *   PerfMonitor đã hạ mức chi tiết. Vế thứ hai là đúng chữ R-04: luật cấm
 *   "fps dưới 30 mà không hạ mức chi tiết", chứ không cấm fps dưới 30.
 * - `failed` khi fps tụt xuống dưới ngưỡng mà mức chi tiết vẫn nguyên.
 */
function judgeFrameRate(measurement, gpuInfo) {
  if (gpuInfo.isSoftware) {
    return { verdict: 'inconclusive', reason: 'renderer là phần mềm, không phải GPU thật' };
  }
  if (measurement.sampleCount === 0) {
    return { verdict: 'failed', reason: 'không lấy được mẫu nào' };
  }
  if (measurement.minFps >= measurement.thresholdMobileFps) {
    return { verdict: 'passed', reason: `fps nhỏ nhất ${formatFixed(measurement.minFps, 1)} ≥ ${measurement.thresholdMobileFps}` };
  }
  if (measurement.isDegraded) {
    return {
      verdict: 'passed',
      reason: `fps nhỏ nhất ${formatFixed(measurement.minFps, 1)} dưới ${measurement.thresholdMobileFps}, nhưng đã hạ mức chi tiết xuống "${measurement.finalDetail}" đúng R-04`,
    };
  }
  return {
    verdict: 'failed',
    reason: `fps nhỏ nhất ${formatFixed(measurement.minFps, 1)} dưới ${measurement.thresholdMobileFps} mà mức chi tiết vẫn ở "${measurement.finalDetail}" — đúng thứ R-04 cấm`,
  };
}

function printTapTargetReport(viewportResults) {
  console.log('\nPhép đo 2 — vùng bấm ≥ 44px và màn chỉ đọc\n');

  for (const result of viewportResults) {
    console.log(`  Khung nhìn ${result.viewport.width}x${result.viewport.height}`);

    if (result.rows.length === 0) {
      console.log('    (không tìm thấy phần tử bấm được nào trong khung nhìn)');
    } else {
      console.log('    Trạng thái  Rộng x Cao        Phần tử');
      for (const row of result.rows) {
        const size = `${formatFixed(row.width, 1)} x ${formatFixed(row.height, 1)}`;
        console.log(
          `    ${(row.passed ? 'ĐẠT' : 'KHÔNG ĐẠT').padEnd(11)} ${size.padEnd(17)} ${row.label}`,
        );
      }
    }

    const passedCount = result.rows.filter((row) => row.passed).length;
    console.log(
      `    Tổng: ${passedCount} / ${result.rows.length} vùng bấm đạt ngưỡng ≥ ${MIN_TAP_TARGET_PX}px.`,
    );
    console.log(
      `    Phần tử nhập liệu tìm thấy: ${result.editableElements.length} (phải là 0 — màn chỉ đọc, không cho sửa dữ liệu).`,
    );
    for (const editable of result.editableElements) {
      console.log(`      - ${editable.label}${editable.type ? ` (type="${editable.type}")` : ''}`);
    }
    console.log('');
  }
}

/* -------------------------------------------------------------------------- */
/* main                                                                        */
/* -------------------------------------------------------------------------- */

async function runTapTargetMeasurement(browser, args) {
  const declaredMobileRoutes = findDeclaredMobileRoutes();
  const viewportResults = [];
  let presence = null;

  for (const viewport of [VIEWPORT_PRIMARY, VIEWPORT_NARROW]) {
    const context = await openMobileContext(browser, viewport);
    try {
      const page = await context.newPage();
      const response = await page.goto(new URL(args.path, args.baseUrl).toString(), {
        waitUntil: 'networkidle',
      });
      const currentPresence = await probeRoutePresence(page);

      if (presence === null) {
        presence = { ...currentPresence, httpStatus: response ? response.status() : null };
      }
      if (currentPresence.notFoundRendered) {
        continue;
      }

      const measured = await measureTapTargets(page);
      viewportResults.push({ viewport, ...measured });
    } finally {
      await context.close();
    }
  }

  const screenMissing =
    declaredMobileRoutes.length === 0 || (presence !== null && presence.notFoundRendered);

  return { declaredMobileRoutes, presence, screenMissing, viewportResults };
}

function printTapTargetMissingReport(tapResult, requestedPath) {
  console.log('\nPhép đo 2 — vùng bấm ≥ 44px và màn chỉ đọc\n');
  console.log('  *** CHƯA CHẠY — MÀN CHƯA TỒN TẠI ***\n');
  console.log(`  Route đã mở            : ${requestedPath}`);
  console.log(
    `  Route "/m/**" khai trong src/routes/paths.ts: ${
      tapResult.declaredMobileRoutes.length === 0 ? 'KHÔNG CÓ CÁI NÀO' : tapResult.declaredMobileRoutes.join(', ')
    }`,
  );
  if (tapResult.presence !== null) {
    console.log(
      `  Màn NotFound dựng ra   : ${
        tapResult.presence.notFoundRendered
          ? `CÓ (route rơi vào "*") — dấu khớp: ${tapResult.presence.matchedMarkers.join(' · ')}`
          : 'không'
      }`,
    );
    console.log(`  HTTP của lần mở        : ${tapResult.presence.httpStatus ?? '(không có)'}`);
    console.log(`  Nội dung thật thấy được: "${tapResult.presence.bodyTextSample}"`);
  }
  console.log('');
  console.log('  Không có số liệu vùng bấm nào để báo cáo. KHÔNG kết luận "đạt", KHÔNG báo "0 vi phạm" —');
  console.log('  một phép đo chưa chạy thì không chứng minh được gì (mục E.10 của CLAUDE.md).');
  console.log('  Khi màn thật lên route đó, chạy lại đúng lệnh này: phép đo sẽ tự chạy, không phải sửa script.');
}

function judgeTapTargets(viewportResults) {
  const failures = [];
  for (const result of viewportResults) {
    for (const row of result.rows) {
      if (!row.passed) {
        failures.push(`${result.viewport.width}x${result.viewport.height}: ${row.label} — ${formatFixed(row.width, 1)} x ${formatFixed(row.height, 1)}`);
      }
    }
    if (result.editableElements.length > 0) {
      failures.push(
        `${result.viewport.width}x${result.viewport.height}: ${result.editableElements.length} phần tử nhập liệu trong màn chỉ đọc`,
      );
    }
    if (result.rows.length === 0) {
      failures.push(`${result.viewport.width}x${result.viewport.height}: không tìm thấy vùng bấm nào — màn dựng hỏng?`);
    }
  }
  return { passed: failures.length === 0, failures };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    return 0;
  }

  const serverWasRunning = await requestUrl(args.baseUrl);
  const serverUrl = new URL(args.baseUrl);
  const serverProcess = serverWasRunning
    ? undefined
    : spawn(packageRunner, ['exec', 'vite', '--host', serverUrl.hostname, '--port', serverUrl.port || '5173'], {
        cwd: projectRoot,
        detached: process.platform !== 'win32',
        shell: useShell,
        stdio: 'ignore',
      });
  serverProcess?.unref();

  let browser;
  let exitCode = 1;

  try {
    await waitForServer(args.baseUrl, 120_000);

    const launch = await launchBrowser(args.headed);
    browser = launch.browser;

    /* ---- Phép đo 1: ngữ cảnh điện thoại riêng, CPU bị bóp. ---- */
    const perfContext = await openMobileContext(browser, VIEWPORT_PRIMARY);
    const perfPage = await perfContext.newPage();
    /* Trang chỉ cần là một trang Vite dev thật để `import('/src/...')` chạy
     * được; scene do script tự dựng, nên route nào cũng được. */
    await perfPage.goto(new URL('/', args.baseUrl).toString());

    const gpuInfo = await probeGpu(perfPage);
    const appliedThrottle = await throttleCpu(perfContext, perfPage, args.cpuThrottle);

    printEnvironmentReport(launch.launchNote, gpuInfo, appliedThrottle, args.cpuThrottle);
    console.log(`\nĐộ dài phép đo 1: ${args.durationS} giây.`);

    const frameRate = await measureMobileFrameRate(perfPage, args.durationS, VIEWPORT_PRIMARY);
    await perfContext.close();

    printFrameRateReport(frameRate);
    const frameRateVerdict = judgeFrameRate(frameRate, gpuInfo);

    /* ---- Phép đo 2: ngữ cảnh riêng cho mỗi khung nhìn, KHÔNG bóp CPU (đo
     * hình học bố cục, không đo tốc độ). ---- */
    const tapResult = await runTapTargetMeasurement(browser, args);

    let tapVerdict;
    if (tapResult.screenMissing) {
      printTapTargetMissingReport(tapResult, args.path);
      tapVerdict = { state: 'not-run', passed: false, failures: [] };
    } else {
      printTapTargetReport(tapResult.viewportResults);
      const judged = judgeTapTargets(tapResult.viewportResults);
      tapVerdict = { state: 'ran', ...judged };
    }

    /* ---- Bảng tổng kết. Bước chưa chạy ghi "CHƯA CHẠY", không ghi "đạt"
     * (mục E.10). ---- */
    console.log('\nBảng tổng kết\n');
    const frameRateLine = {
      passed: 'ĐẠT',
      failed: 'KHÔNG ĐẠT',
      inconclusive: 'KHÔNG KẾT LUẬN ĐƯỢC',
    }[frameRateVerdict.verdict];
    console.log(
      `  Phép đo 1 — fps ≥ ${frameRate.thresholdMobileFps} hoặc đã hạ mức chi tiết : ${frameRateLine}`,
    );
    console.log(`               ${frameRateVerdict.reason}`);
    console.log(
      `               fps nhỏ nhất ${formatFixed(frameRate.minFps, 1)} · trung bình ${formatFixed(frameRate.avgFps, 1)} · mức chi tiết cuối "${frameRate.finalDetail}" · hạ mức: ${frameRate.isDegraded ? 'CÓ' : 'KHÔNG'}`,
    );
    if (tapVerdict.state === 'not-run') {
      console.log('  Phép đo 2 — vùng bấm ≥ 44px                               : CHƯA CHẠY (màn chưa tồn tại)');
    } else {
      console.log(
        `  Phép đo 2 — vùng bấm ≥ 44px                               : ${tapVerdict.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}`,
      );
      for (const failure of tapVerdict.failures) {
        console.log(`               - ${failure}`);
      }
    }
    console.log('');

    const frameRatePassed = frameRateVerdict.verdict === 'passed';
    const tapBlocks = tapVerdict.state === 'ran' && !tapVerdict.passed;
    exitCode = frameRatePassed && !tapBlocks ? 0 : 1;
  } finally {
    await browser?.close();
    if (serverProcess !== undefined) {
      stopProcessTree(serverProcess);
    }
  }

  return exitCode;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
