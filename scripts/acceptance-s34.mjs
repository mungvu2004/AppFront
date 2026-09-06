#!/usr/bin/env node

/**
 * Nghiệm thu S-34 "HistoryPanel", chạy trên NGĂN XẾP THẬT của S-06.
 *
 * Bản đầu tiên của tệp này mô phỏng lại `HistoryStack` bằng hai mảng viết tay.
 * Một bản mô phỏng chỉ chứng minh được rằng người viết nó hiểu đúng luật, chứ
 * không chứng minh được rằng mã trong `src/` giữ luật ấy — và nếu `history.ts`
 * đổi ngày mai thì bản mô phỏng vẫn xanh. Nên tệp này nạp thẳng
 * `src/lib/commands/history.ts` và `useHistoryPanel.model.ts` qua `vite`
 * (`ssrLoadModule` hiểu TypeScript và bí danh `@/`), rồi đo trên đúng những
 * hàm mà màn chạy.
 *
 * Kịch bản, đúng mục nghiệm thu của đặc tả:
 *
 * 1. Đẩy 12 thao tác thật vào ngăn xếp.
 * 2. Nhảy về bước 5 = gọi `undo()` lặp 7 lần (S-06 không có `jumpTo`).
 * 3. Làm thêm 1 thao tác nữa.
 * 4. In TOÀN BỘ danh sách mục mà màn sinh ra, kèm vị trí của từng mục.
 * 5. Lùi thêm 3 bước và đếm lại số mục còn nhìn thấy.
 * 6. In 10 câu mô tả để đọc bằng mắt.
 *
 * ## Kết quả ở bước 4 là SÁU mục, không phải mười ba
 *
 * `history.ts` đặt `redoRecords = []` ngay đầu `push()`: một lệnh mới XOÁ nhánh
 * redo. Nên sau bảy lượt lùi rồi một lượt làm mới, bảy bước 6..12 không còn tồn
 * tại ở bất cứ đâu — chúng không bị màn lọc đi, chúng bị tầng lệnh bỏ. Màn in ra
 * đúng những gì S-06 còn giữ: năm bước 1..5 cộng bước mới.
 *
 * Đây là GIỚI HẠN CỦA S-06, không phải lỗi của màn, và cũng không phải chỗ để
 * màn "sửa": giữ lại bảy bước đã bị bỏ đồng nghĩa với việc màn tự nuôi một ngăn
 * xếp hoàn tác của riêng nó, đúng thứ đặc tả cấm.
 *
 * Luật cốt lõi vẫn được đo, ở bước 5: khi CHỈ lùi mà không làm gì mới, mục đã
 * hoàn tác **vẫn còn nhìn thấy** ở độ mờ thấp và tổng số mục không đổi.
 */

import { createServer } from 'vite';

/* -------------------------------------------------------------------------- */
/* Nạp mã thật.                                                                */
/* -------------------------------------------------------------------------- */

const HISTORY_MODULE = '/src/lib/commands/history.ts';
const MODEL_MODULE = '/src/screens/viewer/HistoryPanel/useHistoryPanel.model.ts';

async function loadRealModules() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    return {
      history: await server.ssrLoadModule(HISTORY_MODULE),
      model: await server.ssrLoadModule(MODEL_MODULE),
    };
  } finally {
    await server.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Dựng 12 thao tác thật.                                                      */
/* -------------------------------------------------------------------------- */

/** Mốc "bây giờ" cố định, để nhãn thời gian tương đối in ra lần nào cũng như nhau. */
const NOW_MS = Date.parse('2026-09-07T10:00:00+07:00');

/** Ai đang xem. Mọi `actorId` khác chuỗi này là "người dùng khác". */
const VIEWER_ACTOR_ID = 'u-toi';
const OTHER_ACTOR_ONE = 'u-cong-su';
const OTHER_ACTOR_TWO = 'u-ky-su';

/** Năm phút giữa hai thao tác — xa hơn cửa sổ gộp, nên không bước nào bị gộp. */
const STEP_GAP_MS = 5 * 60 * 1000;

/** Thao tác đầu tiên xảy ra trước "bây giờ" chừng này. */
const FIRST_STEP_OFFSET_MS = 90 * 60 * 1000;

const timestampAt = (index) =>
  new Date(NOW_MS - FIRST_STEP_OFFSET_MS + index * STEP_GAP_MS).toISOString();

/** Ảnh chụp một bức tường, đủ trường cho bảng "cũ → mới" của màn đọc. */
const wall = (id, overrides = {}) => ({
  id,
  kind: 'wall',
  thicknessMm: 110,
  heightMm: 2800,
  reviewed: false,
  source: 'human',
  ...overrides,
});

const room = (id, overrides = {}) => ({
  id,
  kind: 'room',
  name: 'Phòng khách',
  areaM2: 24.5,
  usage: 'living',
  reviewed: false,
  source: 'human',
  ...overrides,
});

const opening = (id, overrides = {}) => ({
  id,
  kind: 'opening',
  widthMm: 900,
  heightMm: 2200,
  sillHeightMm: 0,
  reviewed: false,
  source: 'human',
  ...overrides,
});

const furniture = (id, overrides = {}) => ({
  id,
  kind: 'furniture',
  rotationDeg: 0,
  reviewed: false,
  source: 'human',
  ...overrides,
});

/** Một lệnh thật: kiểu, phạm vi, và hai ảnh chụp đầy đủ hai bên. */
function command({ index, type, actorId, kind, changes, description }) {
  const entityIds = changes.map((change) => change.id);

  return {
    id: `cmd-${String(index).padStart(3, '0')}`,
    type,
    timestamp: timestampAt(index),
    actorId,
    description,
    changes,
    scope: { entityIds, levelIds: ['L-01'], kinds: [kind] },
  };
}

/** Một `UndoEntry` thật: lô lệnh cộng những patch lùi mà đường ống đã tính sẵn. */
function entry({ index, label, commands, invertCommand, commandToPatches }) {
  return {
    id: `U-${String(index).padStart(3, '0')}`,
    label,
    commands,
    timestamp: timestampAt(index),
    undoPatches: commands.flatMap((one) => [...commandToPatches(invertCommand(one))]),
  };
}

/**
 * Mười hai thao tác, đủ mọi hình dạng mà màn phải vẽ được.
 *
 * Có bước đổi giá trị (ra dòng "cũ → mới"), bước duyệt (ra chip `duyệt`), bước
 * do máy dò sinh (`source: 'ai'`, ra chip `AI`), một bước GỘP ba lệnh (ra mục
 * theo lô, mở ra được), và ba người thực hiện khác nhau để bộ lọc theo người có
 * việc thật để làm.
 */
function buildEntries({ invertCommand, commandToPatches }) {
  const make = (index, label, commands) =>
    entry({ index, label, commands, invertCommand, commandToPatches });

  return [
    make(1, 'Thêm tường', [
      command({
        index: 1,
        type: 'wall.add',
        actorId: VIEWER_ACTOR_ID,
        kind: 'wall',
        description: 'Vẽ đoạn tường ngoài phía bắc',
        changes: [{ kind: 'wall', id: 'W-011', before: null, after: wall('W-011') }],
      }),
    ]),
    make(2, 'Kéo tường', [
      command({
        index: 2,
        type: 'wall.move',
        actorId: VIEWER_ACTOR_ID,
        kind: 'wall',
        description: 'Kéo đoạn tường ngoài sang phải',
        changes: [
          { kind: 'wall', id: 'W-012', before: wall('W-012'), after: wall('W-012', { heightMm: 3000 }) },
        ],
      }),
    ]),
    make(3, 'Sửa tường', [
      command({
        index: 3,
        type: 'wall.update',
        actorId: VIEWER_ACTOR_ID,
        kind: 'wall',
        description: 'Đổi độ dày đoạn tường chịu lực',
        changes: [
          {
            kind: 'wall',
            id: 'W-014',
            before: wall('W-014', { thicknessMm: 110 }),
            after: wall('W-014', { thicknessMm: 220 }),
          },
        ],
      }),
    ]),
    make(4, 'Duyệt tường', [
      command({
        index: 4,
        type: 'wall.review',
        actorId: OTHER_ACTOR_ONE,
        kind: 'wall',
        description: 'Duyệt đoạn tường ngoài phía bắc',
        changes: [
          {
            kind: 'wall',
            id: 'W-011',
            before: wall('W-011', { reviewed: false }),
            after: wall('W-011', { reviewed: true }),
          },
        ],
      }),
    ]),
    make(5, 'Thêm lỗ mở', [
      command({
        index: 5,
        type: 'opening.add',
        actorId: VIEWER_ACTOR_ID,
        kind: 'opening',
        description: 'Đặt ô cửa sổ lên tường phía nam',
        changes: [{ kind: 'opening', id: 'O-021', before: null, after: opening('O-021') }],
      }),
    ]),
    make(6, 'Đổi tên phòng', [
      command({
        index: 6,
        type: 'room.rename',
        actorId: VIEWER_ACTOR_ID,
        kind: 'room',
        description: 'Đổi tên phòng khách thành phòng sinh hoạt chung',
        changes: [
          {
            kind: 'room',
            id: 'R-002',
            before: room('R-002', { name: 'Phòng khách' }),
            after: room('R-002', { name: 'Phòng sinh hoạt chung' }),
          },
        ],
      }),
    ]),
    make(7, 'Xoá tường', [
      command({
        index: 7,
        type: 'wall.remove',
        actorId: VIEWER_ACTOR_ID,
        kind: 'wall',
        description: 'Bỏ đoạn tường ngăn thừa giữa hai phòng ngủ',
        changes: [{ kind: 'wall', id: 'W-018', before: wall('W-018'), after: null }],
      }),
    ]),
    make(8, 'Xoay đồ đạc', [
      command({
        index: 8,
        type: 'furniture.rotate',
        actorId: OTHER_ACTOR_TWO,
        kind: 'furniture',
        description: 'Xoay bộ bàn ăn cho thẳng trục phòng',
        changes: [
          {
            kind: 'furniture',
            id: 'F-004',
            before: furniture('F-004', { rotationDeg: 0 }),
            after: furniture('F-004', { rotationDeg: 90 }),
          },
        ],
      }),
    ]),
    /* Ba lệnh trong MỘT bước — đây là mục theo lô, thu gọn sẵn, mở ra được. */
    make(9, 'Duyệt 3 đoạn tường', [
      command({
        index: 9,
        type: 'wall.review',
        actorId: OTHER_ACTOR_ONE,
        kind: 'wall',
        description: 'Duyệt đoạn tường phía đông',
        changes: [
          {
            kind: 'wall',
            id: 'W-030',
            before: wall('W-030', { reviewed: false }),
            after: wall('W-030', { reviewed: true }),
          },
        ],
      }),
      command({
        index: 9,
        type: 'wall.review',
        actorId: OTHER_ACTOR_ONE,
        kind: 'wall',
        description: 'Duyệt đoạn tường phía tây',
        changes: [
          {
            kind: 'wall',
            id: 'W-031',
            before: wall('W-031', { reviewed: false }),
            after: wall('W-031', { reviewed: true }),
          },
        ],
      }),
      command({
        index: 9,
        type: 'wall.review',
        actorId: OTHER_ACTOR_ONE,
        kind: 'wall',
        description: 'Duyệt đoạn tường phía nam',
        changes: [
          {
            kind: 'wall',
            id: 'W-032',
            before: wall('W-032', { reviewed: false }),
            after: wall('W-032', { reviewed: true }),
          },
        ],
      }),
    ]),
    make(10, 'Thêm phòng', [
      command({
        index: 10,
        type: 'room.add',
        actorId: VIEWER_ACTOR_ID,
        kind: 'room',
        description: 'Khép vòng phòng ngủ nhỏ ở góc đông bắc',
        changes: [{ kind: 'room', id: 'R-007', before: null, after: room('R-007') }],
      }),
    ]),
    /* Máy dò sinh ra bước này — chip `AI`, không phải chip `chỉnh sửa`. */
    make(11, 'Sửa phòng', [
      command({
        index: 11,
        type: 'room.update',
        actorId: OTHER_ACTOR_TWO,
        kind: 'room',
        description: 'Máy dò đoán lại công năng phòng góc',
        changes: [
          {
            kind: 'room',
            id: 'R-009',
            before: room('R-009', { areaM2: 12.4, source: 'ai' }),
            after: room('R-009', { areaM2: 13.8, source: 'ai' }),
          },
        ],
      }),
    ]),
    make(12, 'Sửa lỗ mở', [
      command({
        index: 12,
        type: 'opening.update',
        actorId: VIEWER_ACTOR_ID,
        kind: 'opening',
        description: 'Nới chiều rộng cửa đi ra ban công',
        changes: [
          {
            kind: 'opening',
            id: 'O-025',
            before: opening('O-025', { widthMm: 900 }),
            after: opening('O-025', { widthMm: 1200 }),
          },
        ],
      }),
    ]),
  ];
}

/** Thao tác thứ mười ba, làm SAU khi đã lùi bảy bước. */
function buildThirteenthEntry({ invertCommand, commandToPatches }) {
  return entry({
    index: 13,
    label: 'Kéo tường',
    invertCommand,
    commandToPatches,
    commands: [
      command({
        index: 13,
        type: 'wall.move',
        actorId: VIEWER_ACTOR_ID,
        kind: 'wall',
        description: 'Kéo đoạn tường bếp lùi vào ba mươi phân',
        changes: [
          {
            kind: 'wall',
            id: 'W-040',
            before: wall('W-040', { heightMm: 2800 }),
            after: wall('W-040', { heightMm: 2700 }),
          },
        ],
      }),
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* In ấn.                                                                      */
/* -------------------------------------------------------------------------- */

const NO_SELECTION = { selectedIds: [] };
const RULE = '─'.repeat(78);

const POSITION_LABELS = {
  past: 'quá khứ',
  current: 'HIỆN TẠI',
  undone: 'đã hoàn tác',
};

/** Toàn bộ dòng thời gian của màn, phẳng ra theo đúng thứ tự người đọc nhìn thấy. */
function flatten(groups) {
  const rows = [];

  for (const day of groups) {
    for (const session of day.sessions) {
      for (const item of session.items) {
        rows.push({ day: day.label, session: session.label, item });
      }
    }
  }

  return rows;
}

function printTimeline(rows) {
  console.log(RULE);

  let lastDay = null;
  let lastSession = null;

  for (const row of rows) {
    if (row.day !== lastDay) {
      console.log(`  ${row.day}`);
      lastDay = row.day;
      lastSession = null;
    }

    if (row.session !== lastSession) {
      console.log(`    ${row.session}`);
      lastSession = row.session;
    }

    const item = row.item;
    const position = POSITION_LABELS[item.position];
    const opacity = item.position === 'undone' ? ' · mờ 0,4' : '';
    const batch = item.kind === 'batch' ? ` · lô ${String(item.children.length)} mục con` : '';
    const diff =
      item.kind === 'single' && item.diff !== null
        ? ` · ${item.diff.fieldLabel}: ${item.diff.beforeText} → ${item.diff.afterText}`
        : '';

    console.log(
      `      ${item.label.padEnd(26)} │ ${position.padEnd(11)}${opacity.padEnd(9)} │ ` +
        `${item.actor.label.padEnd(16)} │ ${item.relativeLabel}${batch}${diff}`,
    );
  }

  console.log(RULE);
}

/* -------------------------------------------------------------------------- */
/* Bài nghiệm thu.                                                             */
/* -------------------------------------------------------------------------- */

async function run() {
  const { history: historyModule, model } = await loadRealModules();
  const { createHistoryStack } = historyModule;
  const { buildTimelineItems, groupTimeline, visibleCountOf, peopleOf } = model;

  /* `invert.ts` là nơi `history.ts` lấy patch; nghiệm thu dùng đúng nó. */
  const invert = await (async () => {
    const server = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });

    try {
      return await server.ssrLoadModule('/src/lib/commands/invert.ts');
    } finally {
      await server.close();
    }
  })();

  const { invertCommand, commandToPatches } = invert;
  const stack = createHistoryStack();

  const timeline = () => {
    const items = buildTimelineItems({
      undoSteps: stack.undoSteps(),
      redoSteps: stack.redoSteps(),
      currentActorId: VIEWER_ACTOR_ID,
      nowMs: NOW_MS,
      expandedIds: new Set(),
    });

    return { items, groups: groupTimeline(items, NOW_MS) };
  };

  const checks = [];
  const record = (name, expected, actual) => {
    checks.push({ name, expected, actual, pass: expected === actual });
  };

  console.log('=== NGHIỆM THU S-34 · HistoryPanel · trên ngăn xếp thật của S-06 ===\n');

  /* ---- 1. Mười hai thao tác ---------------------------------------------- */

  console.log('Bước 1 — đẩy vào 12 thao tác');

  for (const one of buildEntries({ invertCommand, commandToPatches })) {
    const step = stack.push({
      entry: one,
      selectionBefore: NO_SELECTION,
      selectionAfter: NO_SELECTION,
    });

    console.log(`  đã đẩy: ${step.label}`);
  }

  console.log(`  ngăn xếp giữ ${String(stack.undoSteps().length)} bước\n`);
  record('Số bước sau 12 lượt đẩy', 12, stack.undoSteps().length);

  /* Chụp lại dòng thời gian ĐẦY ĐỦ ngay đây: sau Bước 3 thì bảy bước giữa đã bị
     tầng lệnh bỏ, và câu mô tả của chúng không còn ở đâu để đọc nữa. */
  const twelveSteps = timeline();

  /* ---- 2. Nhảy về bước 5 = undo() bảy lần --------------------------------- */

  console.log('Bước 2 — nhảy về bước 5, tức gọi undo() lặp 7 lần (S-06 không có jumpTo)');

  for (let lap = 1; lap <= 7; lap += 1) {
    const transition = stack.undo();

    console.log(`  lùi ${String(lap)}/7: ${transition.step.label}`);
  }

  console.log('');
  record('Số bước còn ở nhánh quá khứ', 5, stack.undoSteps().length);
  record('Số bước ở nhánh redo trước khi làm mới', 7, stack.redoSteps().length);

  /* ---- 3. Một thao tác nữa ------------------------------------------------ */

  console.log('Bước 3 — làm thêm 1 thao tác nữa');

  const thirteenth = stack.push({
    entry: buildThirteenthEntry({ invertCommand, commandToPatches }),
    selectionBefore: NO_SELECTION,
    selectionAfter: NO_SELECTION,
  });

  console.log(`  đã đẩy: ${thirteenth.label}`);
  console.log(
    '  history.ts đặt redoRecords = [] ở đầu push(): bảy bước 6..12 vừa bị tầng lệnh bỏ,\n' +
      '  KHÔNG phải bị màn lọc đi. Đây là giới hạn của S-06, và giữ chúng lại đồng nghĩa\n' +
      '  với việc màn tự nuôi một ngăn xếp hoàn tác của riêng nó — điều đặc tả cấm.\n',
  );

  record('Nhánh redo sau khi làm mới', 0, stack.redoSteps().length);

  /* ---- 4. Toàn bộ danh sách ----------------------------------------------- */

  console.log('Bước 4 — toàn bộ danh sách mục mà màn sinh ra\n');

  const afterPush = timeline();
  const rows = flatten(afterPush.groups);

  printTimeline(rows);

  const countOf = (position) => rows.filter((row) => row.item.position === position).length;

  console.log('');
  record('Mục quá khứ', 5, countOf('past'));
  record('Mục hiện tại', 1, countOf('current'));
  record('Mục đã hoàn tác', 0, countOf('undone'));
  record('Tổng số mục nhìn thấy', 6, visibleCountOf(afterPush.groups));

  /* ---- 5. Lùi thêm ba bước: luật cốt lõi ---------------------------------- */

  console.log('Bước 5 — lùi thêm 3 bước; CHỈ lùi, không làm gì mới\n');

  const beforeCount = visibleCountOf(afterPush.groups);

  for (let lap = 1; lap <= 3; lap += 1) {
    const transition = stack.undo();

    console.log(`  lùi ${String(lap)}/3: ${transition.step.label}`);
  }

  console.log('');

  const afterUndo = timeline();
  const undoRows = flatten(afterUndo.groups);

  printTimeline(undoRows);

  const undoneNow = undoRows.filter((row) => row.item.position === 'undone');

  console.log('');
  record('Tổng số mục KHÔNG đổi sau ba lượt lùi', beforeCount, visibleCountOf(afterUndo.groups));
  record('Ba mục vừa lùi nằm ở vị trí "đã hoàn tác"', 3, undoneNow.length);
  record(
    'Ba mục ấy vẫn còn trong danh sách, chỉ hạ độ mờ',
    3,
    undoneNow.filter((row) => row.item.label !== '').length,
  );

  /* ---- 6. Bộ lọc theo người phân biệt được ai với ai ---------------------- */

  /* Đọc trên dòng thời gian ĐẦY ĐỦ: hai trong ba người chỉ xuất hiện ở những
     bước mà nhánh redo đã bỏ, nên danh sách sau Bước 3 không còn đủ người để
     nói được điều gì về bộ lọc. */
  const people = peopleOf(twelveSteps.items);
  const labels = people.map((person) => person.label);

  console.log('Bộ lọc theo người — mỗi lựa chọn phải phân biệt được bằng mắt:\n');

  for (const person of people) {
    console.log(`  • ${person.label}`);
  }

  console.log('');
  record('Nhãn người không trùng nhau', labels.length, new Set(labels).size);

  /* ---- 7. Mười câu mô tả, để đọc bằng mắt --------------------------------- */

  console.log('Mười câu mô tả màn sinh ra — không tên hàm, không id lệnh, không JSON:\n');

  const sentences = [];

  for (const row of flatten(twelveSteps.groups)) {
    sentences.push(row.item.label);

    if (row.item.kind === 'batch') {
      for (const child of row.item.children) {
        sentences.push(child.label);
      }
    }
  }

  const shown = sentences.slice(0, 10);

  shown.forEach((sentence, index) => {
    console.log(`  ${String(index + 1).padStart(2)}. ${sentence}`);
  });

  console.log('');
  record('Số câu mô tả in ra', 10, shown.length);

  /* ---- Tổng kết ----------------------------------------------------------- */

  console.log(RULE);
  console.log('');

  for (const check of checks) {
    const verdict = check.pass ? 'ĐẠT' : 'KHÔNG ĐẠT';

    console.log(`  ${check.name}: ${String(check.actual)} / ${String(check.expected)} — ${verdict}`);
  }

  const passed = checks.filter((check) => check.pass).length;

  console.log('');
  console.log(`Kết quả: ${String(passed)}/${String(checks.length)} phép kiểm đạt`);
  console.log('');

  return passed === checks.length ? 0 : 1;
}

process.exit(await run());
