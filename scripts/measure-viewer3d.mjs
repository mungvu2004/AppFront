/**
 * Bộ đo nghiệm thu Viewer3D (T7).
 *
 * Đo hai con số bản nghiệm thu đòi hỏi, thật chứ không phải ước lượng:
 *
 * 1) fps nhỏ nhất/trung bình khi quay liên tục 30 giây quanh một mô hình 4 tầng.
 * 2) số tài nguyên GPU còn sống (geometries/materials/textures, qua
 *    ResourceLedger) sau mỗi lần vào rồi rời màn, lặp 5 lần — chứng minh
 *    disposeFloor (R-05) thật sự chạy và không rò rỉ.
 *
 * KHÔNG cần màn Viewer3D tồn tại để chạy được. Script mở một trang bất kỳ trên
 * dev server Vite thật rồi tự dựng scene ngay trong trang đó bằng import động
 * tới đúng các hàm thật trong src/lib/three/build/** và src/lib/three/perf/**
 * (nhập theo từng file, đúng cách docs/notes/viewer3d/three-contract.md mô
 * tả) — Vite dev-serve mọi file .ts theo URL tuyệt đối nên
 * `import('/src/lib/...')` chạy được thẳng trong page, không cần build trước.
 * `three` được nhập qua `/@id/three` (không phải đường dẫn thô tới gói) để
 * chắc chắn cùng một bản ba.js với những gì src/lib/three nội bộ dùng — khác
 * bản ba.js thì `instanceof` giữa hai bản không khớp và disposeFloor/
 * ResourceLedger sẽ đếm sai lặng lẽ.
 *
 * GPU: mở Chrome cài sẵn trên máy (channel 'chrome') kèm cờ ANGLE d3d11 để
 * chạm GPU thật thay vì SwiftShader phần mềm mà Playwright/Chromium đóng gói
 * dùng mặc định khi headless. Renderer thật được xác nhận qua
 * WEBGL_debug_renderer_info; nếu máy không có Chrome hệ thống, hoặc chuỗi
 * renderer trả về vẫn là phần mềm (SwiftShader/llvmpipe/…), script IN RÕ điều
 * đó và không kết luận "đạt" cho fps — một con số phần mềm không nói được gì
 * về hiệu năng GPU thật mà R-04 nhắm tới.
 *
 * KHÔNG dùng LOD (buildFloorLod) hay gộp lưới (mergeByMaterial, R-02) ở đây:
 * gộp các rung LOD lại làm một batch là dùng sai hai module đó cùng lúc (mỗi
 * rung vốn để KHÔNG vẽ đồng thời) — xem mục CẠM BẪY #1 của three-contract.md.
 * Vì vậy phép đo 1 là ngân sách XẤU NHẤT có chủ đích: cả 4 tầng luôn ở rung
 * 'full', không gộp draw call. Một màn Viewer3D thật dùng buildFloorLod +
 * mergeByMaterial nên fps thật của màn sẽ bằng hoặc tốt hơn số này.
 *
 * Bộ mẫu hình học (48 tường / 14 phòng / 34 ô mở mỗi tầng) chép lại đúng bộ
 * mẫu chuẩn của gói dựng hình ba chiều (buildQueue.test.ts) — không phải bộ
 * mẫu "34 phòng, 248,60 m²" của A14 (bộ đó phục vụ tô màu/diện tích, khác
 * việc dựng hình ở đây).
 */

import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const useShell = process.platform === 'win32';
const packageRunner = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const DEFAULTS = {
  path: '/',
  baseUrl: 'http://127.0.0.1:5173',
  durationS: 30,
  cycles: 5,
  headed: false,
};

const HELP_TEXT = `
Bộ đo nghiệm thu Viewer3D (T7)

Dùng:
  node scripts/measure-viewer3d.mjs [tuỳ chọn]

Tuỳ chọn:
  --path <đường-dẫn>   Route mở trong trình duyệt để có một trang Vite dev
                        thật (script tự dựng scene bằng import động ngay
                        trong trang, KHÔNG phụ thuộc route này hiển thị gì).
                        CHƯA CÓ route /viewer3d thật tại thời điểm viết script
                        này — mặc định "/" vì đó là route duy nhất đang tồn
                        tại (src/App.tsx, bảng chọn 9 màn demo). Khi màn
                        Viewer3D thật lên route riêng, truyền
                        --path=/duong-dan-that để mở đúng route đó.
  --base-url <url>      Gốc dev server. Mặc định http://127.0.0.1:5173. Nếu
                        server đã chạy sẵn ở đó thì dùng lại; nếu chưa, script
                        tự mở "vite --host 127.0.0.1" rồi tắt khi đo xong.
  --duration-s <số>     Độ dài phép đo 1 (quay liên tục quanh mô hình), tính
                        bằng giây. Mặc định 30.
  --cycles <số>         Số lần vào/rời màn ở phép đo 2. Mặc định 5.
  --headed              Mở cửa sổ Chrome thật thay vì chạy ẩn (để gỡ lỗi).
  --help                In hướng dẫn này rồi thoát.

Thoát mã 0 khi cả hai phép đo đạt ngưỡng. Thoát mã 1 khi có phép đo không đạt,
hoặc khi không kết luận được vì môi trường không cho chạm GPU thật (renderer
là phần mềm) — im lặng coi "không kết luận được" là "đạt" sẽ che mất đúng thứ
R-04 cần biết.
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
      case '--cycles':
        args.cycles = Number(takeValue());
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
  if (!Number.isInteger(args.cycles) || args.cycles <= 0) {
    throw new Error('--cycles phải là một số nguyên dương.');
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
      launchNote: 'Chromium đóng gói của Playwright (không mở được Chrome hệ thống) — khả năng cao là renderer phần mềm.',
    };
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
/* Phép đo 1 — quay liên tục quanh mô hình 4 tầng.                            */
/* -------------------------------------------------------------------------- */

async function measureRotation(page, durationS) {
  return page.evaluate(async ({ durationMs }) => {
    const THREE = await import('/@id/three');
    const { millimetres } = await import('/src/domain/units/types.ts');
    const { buildFloorMesh, SLAB_THICKNESS_MM } = await import('/src/lib/three/build/floor.ts');
    const { MaterialCache, paintByPartKind } = await import('/src/lib/three/perf/materialCache.ts');
    const { PerfMonitor } = await import('/src/lib/three/perf/monitor.ts');
    const { SCENE_BUDGET, measureScene, readRenderInfo } = await import('/src/lib/three/perf/budget.ts');

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

    const width = 1024;
    const height = 640;
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);

    const graphicsMemoryMb = measureScene(scene).graphicsMemoryMb;

    const samples = [];
    const monitor = new PerfMonitor({
      read: () => readRenderInfo(renderer.info, graphicsMemoryMb),
      profile: 'desktop',
      onSample: (sample) => samples.push(sample),
    });

    const REVOLUTION_MS = 12_000;
    const startedAtMs = performance.now();

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

    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();

    return {
      sampleCount: samples.length,
      minFps: frameRates.length > 0 ? Math.min(...frameRates) : 0,
      avgFps: frameRates.length > 0 ? frameRates.reduce((sum, value) => sum + value, 0) / frameRates.length : 0,
      thresholdDesktopFps: SCENE_BUDGET.minFrameRate.desktop,
      drawCallsBudget: SCENE_BUDGET.maxDrawCalls,
      trianglesBudget: SCENE_BUDGET.maxTriangles,
      lastDrawCalls: lastSample ? lastSample.drawCalls : null,
      lastTriangles: lastSample ? lastSample.triangles : null,
      graphicsMemoryMb,
    };
  }, { durationMs: durationS * 1000 });
}

/* -------------------------------------------------------------------------- */
/* Phép đo 2 — vào rồi rời màn 5 lần.                                          */
/* -------------------------------------------------------------------------- */

async function measureDisposal(page, cycles) {
  return page.evaluate(async ({ cycles }) => {
    const THREE = await import('/@id/three');
    const { millimetres } = await import('/src/domain/units/types.ts');
    const { buildFloorMesh, SLAB_THICKNESS_MM } = await import('/src/lib/three/build/floor.ts');
    const { MaterialCache, paintByPartKind } = await import('/src/lib/three/perf/materialCache.ts');
    const { disposeFloor, ResourceLedger } = await import('/src/lib/three/perf/dispose.ts');

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
    const cache = new MaterialCache();
    const ledger = new ResourceLedger();
    const rows = [];

    for (let cycle = 0; cycle < cycles; cycle += 1) {
      // ---- vào màn: dựng và tô màu cả 4 tầng, đăng ký vào ledger ----
      const floorGroups = [];
      for (let floorIndex = 0; floorIndex < FLOOR_COUNT; floorIndex += 1) {
        const floorGroup = buildFloorMesh(buildLevelInput(floorIndex));
        paintByPartKind(
          floorGroup,
          cache,
          (kind) => new THREE.MeshStandardMaterial({ color: PAINT_COLOR_BY_KIND[kind] ?? 0x999999 }),
        );
        ledger.track(floorGroup);
        scene.add(floorGroup);
        floorGroups.push(floorGroup);
      }
      const afterEnter = ledger.counts;

      // ---- rời màn: đóng từng tầng qua disposeFloor (R-05), đúng một lần
      // đóng cho đúng một lần paint mỗi tầng (paintByPartKind lấy một tham
      // chiếu cho mỗi tầng, không phải mỗi mesh — xem docstring MaterialCache). ----
      for (const floorGroup of floorGroups) {
        disposeFloor(floorGroup, { materials: cache });
      }
      const afterLeave = ledger.counts;

      rows.push({ cycle: cycle + 1, afterEnter, afterLeave });
    }

    return { rows };
  }, { cycles });
}

function evaluateDisposal(rows) {
  const resources = ['geometries', 'materials', 'textures'];
  const buildVerified = rows.every((row) => resources.some((resource) => row.afterEnter[resource] > 0));

  const escalations = [];
  for (const resource of resources) {
    const values = rows.map((row) => row.afterLeave[resource]);
    const baseline = values[0];
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] > baseline) {
        escalations.push(
          `${resource} sau khi rời tăng từ ${baseline} (vòng 1) lên ${values[index]} (vòng ${index + 1})`,
        );
      }
    }
  }

  return { buildVerified, escalations, passed: buildVerified && escalations.length === 0 };
}

/* -------------------------------------------------------------------------- */
/* In báo cáo.                                                                 */
/* -------------------------------------------------------------------------- */

const formatFixed = (value, decimals) => value.toFixed(decimals).replace('.', ',');

function printRotationReport(rotation, gpuInfo) {
  console.log('\nPhép đo 1 — quay liên tục quanh mô hình 4 tầng (không LOD, không gộp lưới)\n');
  console.log(`  Renderer GPU : ${gpuInfo.renderer ?? '(không lấy được)'}`);
  console.log(
    `  Nguồn số đo  : ${gpuInfo.isSoftware ? 'PHẦN MỀM (SwiftShader/llvmpipe hoặc tương đương) — số dưới đây KHÔNG kết luận được về hiệu năng GPU thật' : 'GPU thật của máy'}`,
  );
  console.log(`  Số mẫu 500ms : ${rotation.sampleCount}`);
  console.log(
    `  fps nhỏ nhất : ${formatFixed(rotation.minFps, 1).padStart(8)}   (ngưỡng ≥ ${rotation.thresholdDesktopFps} — SCENE_BUDGET.minFrameRate.desktop)`,
  );
  console.log(`  fps trung bình: ${formatFixed(rotation.avgFps, 1).padStart(7)}   (tham khảo, không phải ngưỡng đạt/hỏng)`);
  console.log(
    `  draw call/tam giác mẫu cuối: ${rotation.lastDrawCalls} / ${rotation.lastTriangles}` +
      ` (ngân sách gộp lưới thật: ≤ ${rotation.drawCallsBudget} draw, ≤ ${rotation.trianglesBudget} tam giác —` +
      ' KHÔNG áp dụng ở đây vì phép đo này cố tình không gộp lưới, xem ghi chú)',
  );
  console.log(`  Bộ nhớ đồ hoạ ước lượng: ${formatFixed(rotation.graphicsMemoryMb, 2)} MB`);
}

function printDisposalReport(cycles, verdict) {
  console.log(`\nPhép đo 2 — vào rồi rời màn, lặp ${cycles.length} lần (ResourceLedger, R-05)\n`);
  console.log('  Vòng  Sau khi vào (hình học/vật liệu/kết cấu)   Sau khi rời (hình học/vật liệu/kết cấu)');
  for (const row of cycles) {
    const enter = row.afterEnter;
    const leave = row.afterLeave;
    console.log(
      `  ${String(row.cycle).padStart(4)}  ${String(enter.geometries).padStart(6)} / ${String(enter.materials).padStart(3)} / ${String(enter.textures).padStart(3)}` +
        `                        ${String(leave.geometries).padStart(6)} / ${String(leave.materials).padStart(3)} / ${String(leave.textures).padStart(3)}`,
    );
  }
  console.log('');
  console.log(`  Đã thật sự dựng hình mỗi vòng (sau-khi-vào > 0): ${verdict.buildVerified ? 'có' : 'KHÔNG — số vô nghĩa'}`);
  if (verdict.escalations.length > 0) {
    console.log('  Rò rỉ phát hiện được:');
    for (const line of verdict.escalations) {
      console.log(`    - ${line}`);
    }
  } else {
    console.log('  Không có loại tài nguyên nào leo thang qua 5 vòng.');
  }
}

/* -------------------------------------------------------------------------- */
/* main                                                                        */
/* -------------------------------------------------------------------------- */

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
    console.log(`\nTrình duyệt: ${launch.launchNote}`);

    const page = await browser.newPage();
    await page.goto(new URL(args.path, args.baseUrl).toString());

    const gpuInfo = await probeGpu(page);

    console.log(`\nĐộ dài phép đo 1: ${args.durationS} giây. Số vòng phép đo 2: ${args.cycles}.`);

    const rotation = await measureRotation(page, args.durationS);
    printRotationReport(rotation, gpuInfo);

    const disposal = await measureDisposal(page, args.cycles);
    const disposalVerdict = evaluateDisposal(disposal.rows);
    printDisposalReport(disposal.rows, disposalVerdict);

    const rotationPassed = !gpuInfo.isSoftware && rotation.minFps >= rotation.thresholdDesktopFps;

    console.log('\nKết luận\n');
    if (gpuInfo.isSoftware) {
      console.log('  Phép đo 1: KHÔNG KẾT LUẬN ĐƯỢC — renderer là phần mềm, không phải GPU thật.');
    } else {
      console.log(`  Phép đo 1 (fps ≥ ${rotation.thresholdDesktopFps}): ${rotationPassed ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
    }
    console.log(`  Phép đo 2 (không rò rỉ tài nguyên GPU): ${disposalVerdict.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
    console.log('');

    exitCode = rotationPassed && disposalVerdict.passed ? 0 : 1;
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
