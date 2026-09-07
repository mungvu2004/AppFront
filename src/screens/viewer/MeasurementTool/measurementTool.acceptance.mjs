#!/usr/bin/env node

/**
 * Nghiệm thu định lượng cho màn `MeasurementTool`, chạy trên MÃ THẬT của
 * `src/domain/measure`, `src/domain/units` và `src/lib/format` — không mô
 * phỏng lại phép đo (điều cấm: "không tự tính số đo, không tự quy đổi đơn
 * vị"). Khuôn tham khảo: `scripts/acceptance-s34.mjs` (nạp module thật qua
 * `vite.ssrLoadModule`, in số thật, thoát khác 0 khi có ngưỡng hỏng — R-58/E.10:
 * không có bước nào ở đây được báo "đạt" nếu chưa thật sự chạy).
 *
 * Bốn phép đo, đúng thứ tự CONTRACT.md mục 5/9 và TASK mục 2:
 *
 *   A. Đo một tường đã biết dài 4250 mm bằng `measureDistance` thật — in
 *      "đo được | thật | lệch", ngưỡng đạt lệch <= 1 mm.
 *   B. Đổi đơn vị mm → m cho 5 phép đo bằng `formatLength` thật — in bảng
 *      TRƯỚC/SAU, ngưỡng đạt cả 5 nhãn phải đổi.
 *   C. Bật lần lượt 3 loại bắt điểm — in 3 nhãn từ `SNAP_KIND_LABELS` thật
 *      (`measurementToolTypes.ts`, hợp đồng đã chốt, không phụ thuộc view).
 *   D. In `MEASURE_MODE_LABELS` và `SNAP_KIND_LABELS` để đối chiếu tiếng Việt.
 *
 * Hai bài nghiệm thu còn lại của đặc tả gốc ("xoay camera 360 độ chụp bốn
 * góc") cần GPU thật và trình duyệt — KHÔNG thuộc script này, điều phối viên
 * chạy chúng riêng ở cổng nghiệm thu.
 */

import { createServer } from 'vite';

/* -------------------------------------------------------------------------- */
/* Nạp mã thật.                                                                */
/* -------------------------------------------------------------------------- */

const MEASURE_MODULE = '/src/domain/measure/measure.ts';
const UNITS_MODULE = '/src/domain/units/types.ts';
const FORMAT_MEASURE_MODULE = '/src/lib/format/measure.ts';
const TOOL_TYPES_MODULE = '/src/screens/viewer/MeasurementTool/measurementToolTypes.ts';

async function loadRealModules() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    return {
      measure: await server.ssrLoadModule(MEASURE_MODULE),
      units: await server.ssrLoadModule(UNITS_MODULE),
      formatMeasure: await server.ssrLoadModule(FORMAT_MEASURE_MODULE),
      toolTypes: await server.ssrLoadModule(TOOL_TYPES_MODULE),
    };
  } finally {
    await server.close();
  }
}

/* -------------------------------------------------------------------------- */
/* In ấn và ghi nhận kết quả.                                                  */
/* -------------------------------------------------------------------------- */

const RULE = '─'.repeat(78);

const checks = [];

function record(name, pass, detail) {
  checks.push({ name, pass, detail });
}

/** Ngưỡng đạt của phép A — nguyên văn task mục 2.A: "lệch <= 1 mm". */
const DEVIATION_THRESHOLD_MM = 1;

/** Tường mẫu đã biết dài — nguyên văn task mục 2.A. */
const KNOWN_WALL_LENGTH_MM = 4250;

/**
 * Năm giá trị mm cho phép B — không phải bộ mẫu chuẩn A14, chỉ là năm khoảng
 * cách rời rạc để chứng minh nhãn đổi khi chuyển đơn vị (không phải dữ liệu
 * nghiệp vụ nên không cần bám A14).
 */
const FIVE_LENGTHS_MM = [450, 1250, 2500, 4250, 12750];

async function run() {
  const { measure, units, formatMeasure, toolTypes } = await loadRealModules();
  const { measureDistance } = measure;
  const { millimetres } = units;
  const { formatLength } = formatMeasure;
  const { MEASURE_MODE_LABELS, SNAP_KIND_LABELS, SNAP_KINDS } = toolTypes;

  console.log('=== NGHIỆM THU MeasurementTool — trên mã thật của src/domain, src/lib/format ===\n');

  /* -------------------------------------------------------------------- */
  /* A. Đo một tường đã biết dài 4250 mm.                                  */
  /* -------------------------------------------------------------------- */

  console.log(`A. Đo một tường đã biết dài ${String(KNOWN_WALL_LENGTH_MM)} mm — measureDistance() thật\n`);

  const from = { x: millimetres(0), y: millimetres(0) };
  const to = { x: millimetres(KNOWN_WALL_LENGTH_MM), y: millimetres(0) };
  const distanceResult = measureDistance(from, to);
  const deviationMm = Math.abs(distanceResult.lengthMm - KNOWN_WALL_LENGTH_MM);

  console.log(
    `  đo được: ${String(distanceResult.lengthMm)} mm | thật: ${String(KNOWN_WALL_LENGTH_MM)} mm | ` +
      `lệch: ${String(deviationMm)} mm`,
  );
  console.log('');

  record(
    `A. lệch <= ${String(DEVIATION_THRESHOLD_MM)} mm`,
    deviationMm <= DEVIATION_THRESHOLD_MM,
    `lệch đo được = ${String(deviationMm)} mm`,
  );

  /* -------------------------------------------------------------------- */
  /* B. Đổi đơn vị mm → m với 5 phép đo.                                   */
  /* -------------------------------------------------------------------- */

  console.log('B. Đổi đơn vị mm → m với 5 phép đo — formatLength() thật\n');

  const beforeLabels = FIVE_LENGTHS_MM.map((valueMm) => formatLength(valueMm, { unit: 'mm' }));
  const afterLabels = FIVE_LENGTHS_MM.map((valueMm) => formatLength(valueMm, { unit: 'm' }));

  console.log(`  ${'TRƯỚC (mm)'.padEnd(18)} SAU (m)`);
  for (let index = 0; index < FIVE_LENGTHS_MM.length; index += 1) {
    console.log(`  ${beforeLabels[index].padEnd(18)} ${afterLabels[index]}`);
  }
  console.log('');

  const changedCount = beforeLabels.filter((label, index) => label !== afterLabels[index]).length;

  record(
    'B. cả 5 nhãn đổi khi chuyển mm → m',
    changedCount === FIVE_LENGTHS_MM.length,
    `${String(changedCount)}/${String(FIVE_LENGTHS_MM.length)} nhãn đổi`,
  );

  /* -------------------------------------------------------------------- */
  /* C. Bật lần lượt 3 loại bắt điểm.                                      */
  /* -------------------------------------------------------------------- */

  console.log('C. Bật lần lượt 3 loại bắt điểm — nhãn hiện trên chip (SNAP_KIND_LABELS thật)\n');

  for (const kind of SNAP_KINDS) {
    console.log(`  ${kind.padEnd(18)} → chip hiện: "${SNAP_KIND_LABELS[kind]}"`);
  }
  console.log('');

  const snapLabelsOk =
    SNAP_KINDS.length === 3 && SNAP_KINDS.every((kind) => typeof SNAP_KIND_LABELS[kind] === 'string' && SNAP_KIND_LABELS[kind].length > 0);

  record(
    'C. cả 3 loại bắt điểm có nhãn không rỗng',
    snapLabelsOk,
    SNAP_KINDS.map((kind) => `${kind}="${SNAP_KIND_LABELS[kind]}"`).join(' · '),
  );

  /* -------------------------------------------------------------------- */
  /* D. In MEASURE_MODE_LABELS và SNAP_KIND_LABELS để đối chiếu.           */
  /* -------------------------------------------------------------------- */

  console.log('D. Đối chiếu nhãn tiếng Việt\n');

  console.log('  MEASURE_MODE_LABELS:');
  for (const [key, label] of Object.entries(MEASURE_MODE_LABELS)) {
    console.log(`    ${key.padEnd(16)} → "${label}"`);
  }

  console.log('  SNAP_KIND_LABELS:');
  for (const [key, label] of Object.entries(SNAP_KIND_LABELS)) {
    console.log(`    ${key.padEnd(16)} → "${label}"`);
  }
  console.log('');

  /* -------------------------------------------------------------------- */
  /* Tổng kết — E.10: trạng thái THẬT lấy từ kết quả, không báo "đạt" cho   */
  /* bước chưa chạy.                                                       */
  /* -------------------------------------------------------------------- */

  console.log(RULE);
  console.log('');

  for (const check of checks) {
    const verdict = check.pass ? 'ĐẠT' : 'KHÔNG ĐẠT';

    console.log(`  ${check.name}: ${verdict} — ${check.detail}`);
  }

  const passed = checks.filter((check) => check.pass).length;

  console.log('');
  console.log(`Kết quả: ${String(passed)}/${String(checks.length)} phép kiểm đạt`);
  console.log('');
  console.log(
    'Ghi chú: "xoay camera 360 độ chụp bốn góc" cần GPU thật và trình duyệt — KHÔNG chạy trong script này ' +
      '(chưa chạy, không báo đạt — E.10). Điều phối viên chạy nó riêng ở cổng nghiệm thu.',
  );
  console.log('');

  return passed === checks.length ? 0 : 1;
}

process.exit(await run());
