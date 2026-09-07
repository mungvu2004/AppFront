import { describe, expect, it } from 'vitest';

import type { LevelId, Point, RoomId, RoomUsage } from '../../spatial/types';
import { millimetres } from '../../units/types';
import { ALIGNMENT_WARNING_THRESHOLD_MM } from '../alignFloors';
import {
  CONTINUOUS_CORE_USAGES,
  findVerticalCores,
  isContinuousCoreUsage,
  type CoreLevel,
  type CoreRoom,
} from '../verticalCores';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Four storeys of one house, named the way the interface names them.
 *
 * Only `order` is read by the rule, so the levels carry nothing else: how far
 * apart two storeys are vertically has no bearing on whether a stair passes
 * between them, and a fixture that pretended otherwise would suggest it did.
 */
const LEVELS: readonly CoreLevel[] = [
  { levelId: 'L-000001AAAA' as LevelId, name: 'tầng trệt', order: 0 },
  { levelId: 'L-000002AAAA' as LevelId, name: 'tầng 2', order: 1 },
  { levelId: 'L-000003AAAA' as LevelId, name: 'tầng 3', order: 2 },
  { levelId: 'L-000004AAAA' as LevelId, name: 'tầng 4', order: 3 },
];

const LEVEL_IDS = LEVELS.map((level) => level.levelId);

function levelIdAt(order: number): LevelId {
  const found = LEVEL_IDS[order];
  if (found === undefined) {
    throw new RangeError(`No level at order ${String(order)}.`);
  }
  return found;
}

/** A stairwell in this fixture is 2 400 × 2 400 — one run plus its landing. */
const CORE_SIDE_MM = 2400;

/** A rectangle laid out from its bottom-left corner, counter-clockwise. */
function rectangle(xMm: number, yMm: number, widthMm: number, heightMm: number): Point[] {
  return [
    { x: xMm, y: yMm },
    { x: xMm + widthMm, y: yMm },
    { x: xMm + widthMm, y: yMm + heightMm },
    { x: xMm, y: yMm + heightMm },
  ];
}

interface RoomSpec {
  readonly id: string;
  readonly order: number;
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm?: number;
  readonly heightMm?: number;
  readonly usage?: RoomUsage;
  readonly name?: string;
}

function room(spec: RoomSpec): CoreRoom {
  const usage = spec.usage ?? 'stairwell';
  return {
    id: spec.id as RoomId,
    levelId: levelIdAt(spec.order),
    name: spec.name ?? 'thang bộ',
    usage,
    outline: rectangle(
      spec.xMm,
      spec.yMm,
      spec.widthMm ?? CORE_SIDE_MM,
      spec.heightMm ?? CORE_SIDE_MM,
    ),
  };
}

/** Where the stair sits on the ground storey, and where it should stay. */
const CORE_X_MM = 1000;
const CORE_Y_MM = 1000;
const CORE_CENTRE_X_MM = CORE_X_MM + CORE_SIDE_MM / 2;
const CORE_CENTRE_Y_MM = CORE_Y_MM + CORE_SIDE_MM / 2;

/** A stair that runs straight up `count` storeys from the ground. */
function plumbStair(count: number): CoreRoom[] {
  const rooms: CoreRoom[] = [];
  for (let order = 0; order < count; order += 1) {
    rooms.push(
      room({ id: `R-00000${String(order + 1)}AAAA`, order, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
    );
  }
  return rooms;
}

/* -------------------------------------------------------------------------- */
/* The usages that can be continuous.                                          */
/* -------------------------------------------------------------------------- */

describe('CONTINUOUS_CORE_USAGES', () => {
  it('nhận đúng hai công năng liên tục được', () => {
    expect(CONTINUOUS_CORE_USAGES).toEqual(['stairwell', 'utility']);
  });

  it('nhận lõi thang và hộp kỹ thuật, loại các công năng còn lại', () => {
    expect(isContinuousCoreUsage('stairwell')).toBe(true);
    expect(isContinuousCoreUsage('utility')).toBe(true);
    expect(isContinuousCoreUsage('bedroom')).toBe(false);
    expect(isContinuousCoreUsage('corridor')).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* A stair that runs straight up.                                              */
/* -------------------------------------------------------------------------- */

describe('findVerticalCores — lõi chồng đúng', () => {
  it('gộp bốn tầng chồng đúng nhau thành một lõi, không vấn đề nào', () => {
    const report = findVerticalCores(plumbStair(4), LEVELS);

    expect(report.cores).toHaveLength(1);
    const core = report.cores[0];
    expect(core?.usage).toBe('stairwell');
    expect(core?.levelIds).toEqual(LEVEL_IDS);
    expect(core?.slices.map((slice) => slice.levelOrder)).toEqual([0, 1, 2, 3]);
    expect(core?.issues).toEqual([]);
    expect(report.issues).toEqual([]);
  });

  it('đặt trọng tâm đại diện đúng giữa mặt bằng lõi', () => {
    const report = findVerticalCores(plumbStair(4), LEVELS);

    expect(report.cores[0]?.centroid.x).toBeCloseTo(CORE_CENTRE_X_MM, 6);
    expect(report.cores[0]?.centroid.y).toBeCloseTo(CORE_CENTRE_Y_MM, 6);
    expect(report.cores[0]?.maxOffsetMm).toBeCloseTo(0, 6);
  });

  it('cho cùng một kết quả dù phòng được đưa vào theo thứ tự nào', () => {
    const rooms = plumbStair(4);
    const forwards = findVerticalCores(rooms, LEVELS);
    const backwards = findVerticalCores([...rooms].reverse(), LEVELS);

    expect(backwards).toEqual(forwards);
  });

  it('vẫn báo lõi một tầng, vì thang dừng lại là thứ người đọc cần thấy', () => {
    const report = findVerticalCores(plumbStair(1), LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.cores[0]?.levelIds).toEqual([levelIdAt(0)]);
    expect(report.cores[0]?.maxOffsetMm).toBe(0);
    expect(report.issues).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The acceptance case: 180 mm out.                                            */
/* -------------------------------------------------------------------------- */

describe('findVerticalCores — lệch 180 mm', () => {
  const OFFSET_MM = 180;

  const DRIFTED: readonly CoreRoom[] = [
    room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
    room({ id: 'R-000002AAAA', order: 1, xMm: CORE_X_MM + OFFSET_MM, yMm: CORE_Y_MM }),
  ];

  it('sinh đúng một vấn đề cần chú ý, với số milimét thật', () => {
    const report = findVerticalCores(DRIFTED, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.issues).toHaveLength(1);

    const issue = report.issues[0];
    expect(issue?.kind).toBe('coreOffset');
    expect(issue?.severity).toBe('attention');
    expect(issue?.amountMm).toBeCloseTo(OFFSET_MM, 6);
    expect(issue?.levelId).toBe(levelIdAt(1));
    expect(issue?.relatedLevelId).toBe(levelIdAt(0));
  });

  it('viết câu tiếng Việt gọi tên hai tầng và số milimét', () => {
    const issue = findVerticalCores(DRIFTED, LEVELS).issues[0];

    expect(issue?.message).toContain('180 mm');
    expect(issue?.message).toContain('tầng 2');
    expect(issue?.message).toContain('tầng trệt');
    expect(issue?.message).toContain('Lõi thang');
    expect(issue?.message).toContain('150 mm');
  });

  it('treo vấn đề lên chính lõi đó, và vẫn giữ hai tầng trong một lõi', () => {
    const core = findVerticalCores(DRIFTED, LEVELS).cores[0];

    expect(core?.levelIds).toEqual([levelIdAt(0), levelIdAt(1)]);
    expect(core?.issues).toHaveLength(1);
    expect(core?.maxOffsetMm).toBeCloseTo(OFFSET_MM, 6);
  });

  it('lấy ngưỡng của alignFloors chứ không đặt ngưỡng riêng', () => {
    expect(ALIGNMENT_WARNING_THRESHOLD_MM).toBe(150);

    const loosened = findVerticalCores(DRIFTED, LEVELS, {
      offsetThresholdMm: millimetres(200),
    });
    expect(loosened.issues).toEqual([]);
    expect(loosened.cores[0]?.maxOffsetMm).toBeCloseTo(OFFSET_MM, 6);
  });

  it('viết dấu thập phân bằng dấu phẩy, như phần còn lại của giao diện', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      room({ id: 'R-000002AAAA', order: 1, xMm: CORE_X_MM + 200, yMm: CORE_Y_MM + 100 }),
    ];

    expect(findVerticalCores(rooms, LEVELS).issues[0]?.message).toContain('223,6 mm');
  });

  it('viết ngưỡng 0 mm không kèm dấu âm khi người gọi siết hết cỡ', () => {
    const report = findVerticalCores(DRIFTED, LEVELS, { offsetThresholdMm: millimetres(0) });

    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.message).toContain('vượt ngưỡng 0 mm');
  });

  it('báo một vấn đề cho mỗi nấc lệch, không gộp thành một', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      room({ id: 'R-000002AAAA', order: 1, xMm: CORE_X_MM + OFFSET_MM, yMm: CORE_Y_MM }),
      room({ id: 'R-000003AAAA', order: 2, xMm: CORE_X_MM + OFFSET_MM * 2, yMm: CORE_Y_MM }),
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.issues).toHaveLength(2);
    expect(report.issues.map((issue) => issue.levelId)).toEqual([levelIdAt(1), levelIdAt(2)]);
  });
});

/* -------------------------------------------------------------------------- */
/* Under the threshold, and on it.                                             */
/* -------------------------------------------------------------------------- */

describe('findVerticalCores — lệch dưới ngưỡng', () => {
  it('bỏ qua lệch 100 mm nhưng vẫn ghi lại nó', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      room({ id: 'R-000002AAAA', order: 1, xMm: CORE_X_MM + 100, yMm: CORE_Y_MM }),
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.issues).toEqual([]);
    expect(report.cores[0]?.maxOffsetMm).toBeCloseTo(100, 6);
  });

  it('không báo khi lệch đúng bằng ngưỡng, vì ngưỡng là chỗ bắt đầu vượt', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      room({
        id: 'R-000002AAAA',
        order: 1,
        xMm: CORE_X_MM + ALIGNMENT_WARNING_THRESHOLD_MM,
        yMm: CORE_Y_MM,
      }),
    ];

    expect(findVerticalCores(rooms, LEVELS).issues).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* What is not one core.                                                       */
/* -------------------------------------------------------------------------- */

describe('findVerticalCores — thứ không phải một lõi', () => {
  it('tách hai thang ở hai góc nhà thành hai lõi rời, không phải một lõi lệch', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: 0, yMm: 0 }),
      room({ id: 'R-000002AAAA', order: 1, xMm: 20000, yMm: 20000 }),
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(2);
    expect(report.cores.map((core) => core.levelIds)).toEqual([
      [levelIdAt(0)],
      [levelIdAt(1)],
    ]);
    expect(report.issues).toEqual([]);
  });

  it('không nối hai tầng cách nhau một tầng', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      room({ id: 'R-000003AAAA', order: 2, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(2);
    expect(report.cores.map((core) => core.slices.length)).toEqual([1, 1]);
    expect(report.issues).toEqual([]);
  });

  it('không nối thang với hộp kỹ thuật, dù chúng chồng đúng lên nhau', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      room({
        id: 'R-000002AAAA',
        order: 1,
        xMm: CORE_X_MM,
        yMm: CORE_Y_MM,
        usage: 'utility',
        name: 'hộp gen',
      }),
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(2);
    expect(report.cores.map((core) => core.usage)).toEqual(['stairwell', 'utility']);
  });

  it('bỏ qua công năng không liên tục được', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM, usage: 'bedroom' }),
      room({ id: 'R-000002AAAA', order: 1, xMm: CORE_X_MM, yMm: CORE_Y_MM, usage: 'bedroom' }),
      room({ id: 'R-000003AAAA', order: 2, xMm: CORE_X_MM, yMm: CORE_Y_MM, usage: 'corridor' }),
    ];

    expect(findVerticalCores(rooms, LEVELS)).toEqual({ cores: [], issues: [] });
  });

  it('bỏ qua phòng ở tầng không có trong danh sách', () => {
    const orphan: CoreRoom = {
      ...room({ id: 'R-000009AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      levelId: 'L-000099AAAA' as LevelId,
    };
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      orphan,
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.cores[0]?.slices.map((slice) => slice.roomId)).toEqual(['R-000001AAAA']);
  });

  it('bỏ qua đường bao chưa khép thành hình', () => {
    const degenerate: CoreRoom = {
      id: 'R-000002AAAA' as RoomId,
      levelId: levelIdAt(1),
      name: 'thang bộ',
      usage: 'stairwell',
      outline: [
        { x: CORE_X_MM, y: CORE_Y_MM },
        { x: CORE_X_MM + CORE_SIDE_MM, y: CORE_Y_MM },
      ],
    };
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: CORE_X_MM, yMm: CORE_Y_MM }),
      degenerate,
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.cores[0]?.levelIds).toEqual([levelIdAt(0)]);
  });

  it('trả về kết quả rỗng cho danh sách rỗng, không ném', () => {
    expect(findVerticalCores([], [])).toEqual({ cores: [], issues: [] });
    expect(findVerticalCores([], LEVELS)).toEqual({ cores: [], issues: [] });
  });
});

/* -------------------------------------------------------------------------- */
/* Slices of unequal size, and cores that meet.                                */
/* -------------------------------------------------------------------------- */

describe('findVerticalCores — mặt bằng không bằng nhau', () => {
  /** A stair hall wide enough to hold both risers of the storey above. */
  const HALL_WIDTH_MM = 6000;
  const HALL_DEPTH_MM = 3000;

  function hall(id: string, order: number): CoreRoom {
    return room({
      id,
      order,
      xMm: 0,
      yMm: 0,
      widthMm: HALL_WIDTH_MM,
      heightMm: HALL_DEPTH_MM,
      name: 'sảnh thang',
    });
  }

  function riser(id: string, order: number, xMm: number): CoreRoom {
    return room({
      id,
      order,
      xMm,
      yMm: 200,
      widthMm: 1200,
      heightMm: 1200,
      usage: 'utility',
      name: 'hộp gen',
    });
  }

  it('nối hộp gen nhỏ nằm gọn trong sảnh phía trên nó', () => {
    const rooms: readonly CoreRoom[] = [
      riser('R-000001AAAA', 0, 200),
      { ...hall('R-000002AAAA', 1), usage: 'utility' },
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.cores[0]?.slices).toHaveLength(2);
  });

  it('nối hộp gen nhỏ nằm gọn trong sảnh phía dưới nó', () => {
    const rooms: readonly CoreRoom[] = [
      { ...hall('R-000001AAAA', 0), usage: 'utility' },
      riser('R-000002AAAA', 1, 200),
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.cores[0]?.slices).toHaveLength(2);
  });

  it('gộp hai hộp gen gặp nhau ở một sảnh thành một lõi duy nhất', () => {
    const rooms: readonly CoreRoom[] = [
      riser('R-000001AAAA', 0, 200),
      riser('R-000002AAAA', 0, 4000),
      { ...hall('R-000003AAAA', 1), usage: 'utility' },
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.cores[0]?.slices.map((slice) => slice.roomId)).toEqual([
      'R-000001AAAA',
      'R-000002AAAA',
      'R-000003AAAA',
    ]);
    expect(report.cores[0]?.id).toBe('VC-utility-R-000001AAAA');
  });

  it('gộp một lõi chẻ đôi rồi nhập lại, không đếm nấc chung hai lần', () => {
    const rooms: readonly CoreRoom[] = [
      { ...hall('R-000001AAAA', 0), usage: 'utility' },
      riser('R-000002AAAA', 1, 200),
      riser('R-000003AAAA', 1, 4000),
      { ...hall('R-000004AAAA', 2), usage: 'utility' },
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(1);
    expect(report.cores[0]?.slices).toHaveLength(4);
    expect(report.cores[0]?.levelIds).toEqual([
      levelIdAt(0),
      levelIdAt(1),
      levelIdAt(1),
      levelIdAt(2),
    ]);
  });

  it('gọi hộp kỹ thuật đúng tên tiếng Việt của nó trong câu báo lệch', () => {
    const rooms: readonly CoreRoom[] = [
      riser('R-000001AAAA', 0, 200),
      riser('R-000002AAAA', 1, 600),
      { ...hall('R-000003AAAA', 2), usage: 'utility' },
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.issues[0]?.message).toContain('Lõi hộp kỹ thuật');
    expect(report.issues[0]?.amountMm).toBeCloseTo(400, 6);
  });
});

/* -------------------------------------------------------------------------- */
/* Order of the answer.                                                        */
/* -------------------------------------------------------------------------- */

describe('findVerticalCores — thứ tự kết quả', () => {
  it('xếp lõi theo tầng thấp nhất, rồi theo mã lõi', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000004AAAA', order: 1, xMm: 20000, yMm: 20000 }),
      room({ id: 'R-000002AAAA', order: 0, xMm: 20000, yMm: 20000 }),
      room({ id: 'R-000003AAAA', order: 1, xMm: 0, yMm: 0 }),
      room({ id: 'R-000001AAAA', order: 0, xMm: 0, yMm: 0 }),
      room({ id: 'R-000005AAAA', order: 2, xMm: 40000, yMm: 40000 }),
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores.map((core) => core.id)).toEqual([
      'VC-stairwell-R-000001AAAA',
      'VC-stairwell-R-000002AAAA',
      'VC-stairwell-R-000005AAAA',
    ]);
  });

  it('nối danh sách vấn đề theo đúng thứ tự các lõi', () => {
    const rooms: readonly CoreRoom[] = [
      room({ id: 'R-000001AAAA', order: 0, xMm: 0, yMm: 0 }),
      room({ id: 'R-000002AAAA', order: 1, xMm: 200, yMm: 0 }),
      room({ id: 'R-000003AAAA', order: 0, xMm: 20000, yMm: 20000 }),
      room({ id: 'R-000004AAAA', order: 1, xMm: 20300, yMm: 20000 }),
    ];
    const report = findVerticalCores(rooms, LEVELS);

    expect(report.cores).toHaveLength(2);
    expect(report.issues).toHaveLength(2);
    expect(report.issues.map((issue) => Math.round(issue.amountMm))).toEqual([200, 300]);
  });
});
