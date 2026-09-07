/**
 * Lượt kiểm cấp màn của `ExplodedView`.
 *
 * `ExplodedView.tsx` và `useExplodedView.ts` CHƯA tồn tại trong worktree này —
 * hai worker khác đang viết chúng song song, từ cùng hợp đồng
 * `explodedViewTypes.ts`. File này vì vậy ĐỎ ngay ở import `./ExplodedView`
 * cho tới khi lớp gộp nối hai nhánh lại; đó là kết quả ĐÚNG của lượt này
 * (không phải `.skip`, không nới điều kiện — R-70). Cùng khuôn
 * `OverlayComparison.test.tsx`: chỉ props, không hook, không mạng (mục D).
 *
 * Bài kiểm "180 mm" (mô tả đầy đủ ở khối describe riêng bên dưới) không phụ
 * thuộc `ExplodedView` — nó gọi thẳng `alignFloors` của domain, vốn đã tồn
 * tại — nên khi lớp gộp xong, nó là bài kiểm ĐẦU TIÊN có ý nghĩa xanh thật.
 */

import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { alignFloors, type FloorPlan } from '@/domain/axes/alignFloors';
import type { DetectedAxis } from '@/domain/axes/detect';
import type { WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { SEVEN_STATES, SEVEN_STATE_LABELS, type SevenStateScenario } from '@/lib/testing/sevenStateScenarios';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';

import { ExplodedView } from './ExplodedView';
import { explodedViewPropsOf, type ExplodedViewRuntime } from './useExplodedView';
import {
  SAMPLE_ALIGNMENT_ISSUE,
  SAMPLE_MISALIGNED_FLOORS,
  explodedViewScenarioFor,
  withReducedMotion,
  withSeparation,
} from './explodedViewScenarios';
import { EXPLODED_MOTION_MS, LABEL_REVEAL_SEPARATION } from './explodedViewTypes';

/* -------------------------------------------------------------------------- */
/* Mảng thứ hai của `expectSevenStates` — cùng khuôn OverlayComparison.        */
/* -------------------------------------------------------------------------- */

function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => {
    const props = explodedViewScenarioFor(state);

    return {
      state,
      label: SEVEN_STATE_LABELS[state],
      rows: [],
      totalCount: props.floors.length,
      isLoading: state === 'loading',
      isCollapsed: state === 'collapsed',
      canView: state !== 'forbidden',
      error: null,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* [A11] Bảy trạng thái.                                                       */
/* -------------------------------------------------------------------------- */

describe('ExplodedView — bảy trạng thái (A11)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const props = explodedViewScenarioFor(scenario.state);
      const { container, unmount } = renderWithProviders(<ExplodedView {...props} />);

      rendered += 1;

      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });
});

/* -------------------------------------------------------------------------- */
/* [R-72] Khả năng tiếp cận và tiếng Việt.                                     */
/* -------------------------------------------------------------------------- */

describe('ExplodedView — khả năng tiếp cận, tiếng Việt (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái thành công', () => {
    const { container } = renderWithProviders(<ExplodedView {...explodedViewScenarioFor('success')} />);

    expectAccessible(container);
  });

  it('mọi chuỗi hiển thị ở trạng thái thành công là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<ExplodedView {...explodedViewScenarioFor('success')} />);

    expectVietnamese(container);
  });

  it('mọi chuỗi hiển thị ở trạng thái một phần cũng là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<ExplodedView {...explodedViewScenarioFor('partial')} />);

    expectVietnamese(container);
  });
});

/* -------------------------------------------------------------------------- */
/* Thẻ nhãn tầng chỉ hiện khi tách đủ nhiều.                                    */
/* -------------------------------------------------------------------------- */

describe('ExplodedView — thẻ nhãn tầng chỉ hiện khi tách đủ nhiều', () => {
  it('dưới LABEL_REVEAL_SEPARATION: không thẻ nào trong cây; trên ngưỡng: đủ thẻ', () => {
    const base = explodedViewScenarioFor('success');
    const below = withSeparation(base, LABEL_REVEAL_SEPARATION - 0.05);
    const above = withSeparation(base, LABEL_REVEAL_SEPARATION + 0.05);

    expect(below.areLabelsVisible).toBe(false);
    expect(above.areLabelsVisible).toBe(true);
    // Cùng dữ liệu tầng ở cả hai bên — chỉ độ tách đổi (R-70: không bịa hai bộ dữ liệu khác nhau).
    expect(below.floors).toBe(base.floors);
    expect(above.floors).toBe(base.floors);

    const { container: belowContainer, unmount: unmountBelow } = renderWithProviders(
      <ExplodedView {...below} />,
    );

    for (const floor of below.floors) {
      expect(within(belowContainer).queryByText(floor.name)).not.toBeInTheDocument();
    }

    unmountBelow();

    const { container: aboveContainer } = renderWithProviders(<ExplodedView {...above} />);

    for (const floor of above.floors) {
      expect(within(aboveContainer).getByText(floor.name)).toBeInTheDocument();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Lệch trục 180 mm — bài kiểm quan trọng nhất của lượt này.                    */
/*                                                                              */
/* `alignFloors` được phép tịnh tiến tự do, nên một tầng dời cả khối 180 mm sẽ  */
/* bị kéo về đúng chỗ và phần dư bằng 0 — KHÔNG sinh cảnh báo nào. Cái nó bắt   */
/* là lệch TƯƠNG ĐỐI: một trục xê dịch 180 mm so với các trục còn lại của      */
/* chính tầng đó. Hai bài kiểm dưới đây khẳng định cả hai nửa của sự thật này. */
/* -------------------------------------------------------------------------- */

describe('ExplodedView — lệch trục 180 mm', () => {
  it('lệch TƯƠNG ĐỐI 180 mm giữa hai trục cùng phương sinh FloorIssue kind alignment, severity attention, amountMm 180', () => {
    expect(SAMPLE_ALIGNMENT_ISSUE.kind).toBe('alignment');
    expect(SAMPLE_ALIGNMENT_ISSUE.severity).toBe('attention');
    expect(SAMPLE_ALIGNMENT_ISSUE.amountMm).toBe(180);
    expect(SAMPLE_ALIGNMENT_ISSUE.message).toContain('180 mm');
  });

  it('tính lại report từ SAMPLE_MISALIGNED_FLOORS khớp đúng SAMPLE_ALIGNMENT_ISSUE đã đóng băng', () => {
    const report = alignFloors(SAMPLE_MISALIGNED_FLOORS);
    const issue = report.issues.find((candidate) => candidate.kind === 'alignment');

    expect(issue).toEqual(SAMPLE_ALIGNMENT_ISSUE);
  });

  it('ExplodedAlignmentPath của tầng đó có tone "attention" và caption đúng bằng FloorIssue.message thật', () => {
    const partial = explodedViewScenarioFor('partial');
    const path = partial.alignmentPaths.find((candidate) => candidate.tone === 'attention');

    expect(path).toBeDefined();
    expect(path?.caption).toBe(SAMPLE_ALIGNMENT_ISSUE.message);
    expect(path?.residualMm).toBe(SAMPLE_ALIGNMENT_ISSUE.amountMm);
  });

  it('một tầng dời cả khối 180 mm ĐỀU nhau (lệch tuyệt đối) KHÔNG sinh cảnh báo nào — alignFloors tịnh tiến bù trừ hết', () => {
    const axis = (coordinateMm: number, wallIds: readonly [WallId, WallId]): DetectedAxis => ({
      direction: 'vertical',
      coordinateMm: millimetres(coordinateMm),
      startMm: millimetres(0),
      endMm: millimetres(3000),
      spreadMm: millimetres(0),
      wallIds,
    });

    const base: FloorPlan = {
      levelId: 'L-01',
      name: 'Tầng 01',
      floorElevationMm: millimetres(0),
      clearHeightMm: millimetres(3000),
      axes: [axis(0, ['W-101', 'W-102']), axis(3000, ['W-103', 'W-104'])],
    };
    const shiftedUniformly: FloorPlan = {
      levelId: 'L-02',
      name: 'Tầng 02',
      floorElevationMm: millimetres(3000),
      clearHeightMm: millimetres(3000),
      // Cả hai trục dời đúng 180 mm — một phép tịnh tiến duy nhất khớp cả hai.
      axes: [axis(180, ['W-105', 'W-106']), axis(3180, ['W-107', 'W-108'])],
    };

    const report = alignFloors([base, shiftedUniformly]);

    expect(report.issues).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Giảm chuyển động.                                                           */
/* -------------------------------------------------------------------------- */

describe('ExplodedView — giảm chuyển động', () => {
  it('EXPLODED_MOTION_MS.reducedMs là mức nhảy thẳng (instant), không phải một thời lượng chạy vị trí', () => {
    expect(EXPLODED_MOTION_MS.reducedMs).toBe(MOTION_DURATIONS_MS.instant);
  });

  it('bật reducedMotion không đổi độ tách hay dữ liệu tầng, và view vẫn dựng được, tiếp cận được', () => {
    const base = explodedViewScenarioFor('success');
    const reduced = withReducedMotion(base, true);

    expect(reduced.reducedMotion).toBe(true);
    expect(reduced.separation).toBe(base.separation);
    expect(reduced.floors).toBe(base.floors);

    const { container } = renderWithProviders(<ExplodedView {...reduced} />);

    expectAccessible(container);
  });
});

/* -------------------------------------------------------------------------- */
/* Không tô màu theo tầng.                                                     */
/* -------------------------------------------------------------------------- */

describe('ExplodedView — không tô màu theo tầng', () => {
  it('dữ liệu mẫu không chứa mã màu thô', () => {
    expectNoRawColor('src/screens/viewer/ExplodedView/explodedViewScenarios.ts');
  });

  it('không tầng nào mang thuộc tính màu, và mọi tầng dùng chung một bộ khoá thuộc tính', () => {
    const { floors } = explodedViewScenarioFor('success');

    expect(floors.length).toBeGreaterThan(1);

    const keySets = floors.map((floor) => Object.keys(floor).sort().join(','));
    const [first, ...rest] = keySets;

    for (const keys of rest) {
      expect(keys).toBe(first);
    }

    for (const floor of floors) {
      for (const key of Object.keys(floor)) {
        expect(key.toLowerCase()).not.toMatch(/color|colour|tint|hue|fill|stroke/);
      }
    }
  });

  it('alignmentPaths chỉ mang hai tone cố định của A4, không có màu thứ tư biến thiên theo trục', () => {
    const partial = explodedViewScenarioFor('partial');
    const tones = new Set(partial.alignmentPaths.map((path) => path.tone));

    for (const tone of tones) {
      expect(['aligned', 'attention']).toContain(tone);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Hai khoản nợ vừa trả: khuôn camera vào tầng, và chỉ báo chạy trên LÕI.      */
/* -------------------------------------------------------------------------- */

/** Runtime tối thiểu — mọi trường bắt buộc, không trục không lõi. */
function bareRuntime(): ExplodedViewRuntime {
  return {
    state: 'success',
    floors: [],
    axes: [],
    cores: [],
    hoveredStoreyId: null,
    isCapturing: false,
    captureError: null,
    onFloorHover: () => undefined,
    onCapture: () => undefined,
    canvasRef: () => undefined,
  };
}

/** Tuỳ chọn tối thiểu — khung của vỏ ở độ tách 0, không cổng. */
function bareOptions(
  extra: Partial<Parameters<typeof explodedViewPropsOf>[0]> = {},
): Parameters<typeof explodedViewPropsOf>[0] {
  return {
    projectId: 'P-1',
    frame: {
      azimuthRad: 0,
      polarRad: 0,
      distanceM: 10,
      isOrthographic: false,
      visibleStoreyIds: [],
      separation: 0,
      sectionPlane: null,
      selectedEntityIds: [],
      hoveredEntityId: null,
      isolatedEntityIds: null,
      hiddenEntityIds: [],
      reducedMotion: false,
    },
    onSeparationChange: () => undefined,
    onStoreyActivate: () => undefined,
    onStoreyVisibilityToggle: () => undefined,
    storeys: [],
    ...extra,
  };
}

describe('ExplodedView — bấm thẻ tầng làm CẢ HAI nửa của hành động', () => {
  it('gọi onStoreyActivate và onStoreyFrame, đúng mã tầng, mỗi cái một lần', () => {
    const activated: [string, boolean][] = [];
    const framed: string[] = [];

    const props = explodedViewPropsOf(
      bareOptions({
        onStoreyActivate: (id, additive) => activated.push([id, additive]),
        onStoreyFrame: (id) => framed.push(id),
      }),
      bareRuntime(),
    );

    props.actions.onFloorActivate('L-02');

    expect(activated).toEqual([['L-02', false]]);
    expect(framed).toEqual(['L-02']);
  });

  it('vỏ không dựng frameStorey thì vẫn kích hoạt tầng, không ném', () => {
    const activated: string[] = [];

    const props = explodedViewPropsOf(
      bareOptions({ onStoreyActivate: (id) => activated.push(id) }),
      bareRuntime(),
    );

    expect(() => {
      props.actions.onFloorActivate('L-02');
    }).not.toThrow();
    expect(activated).toEqual(['L-02']);
  });
});

describe('ExplodedView — chỉ báo thẳng hàng chạy trên LÕI, trục là đường lui', () => {
  const core = {
    id: 'stairwell:R-0001',
    xFraction: 0.4,
    maxOffsetMm: millimetres(180),
    caption: 'Lõi thang ở tầng 2 lệch 180 mm so với tầng trệt, vượt ngưỡng 150 mm.',
  };

  it('có lõi thì đường dẫn dựng từ lõi, và caption ghi đúng 180 mm', () => {
    const props = explodedViewPropsOf(bareOptions(), { ...bareRuntime(), cores: [core] });

    expect(props.alignmentPaths).toHaveLength(1);
    expect(props.alignmentPaths[0]?.id).toBe('stairwell:R-0001');
    expect(props.alignmentPaths[0]?.tone).toBe('attention');
    expect(props.alignmentPaths[0]?.residualMm).toBe(180);
    expect(props.alignmentPaths[0]?.caption).toContain('180 mm');
  });

  it('lõi thẳng đứng thì đường dẫn ở tone aligned và không có caption', () => {
    const props = explodedViewPropsOf(bareOptions(), {
      ...bareRuntime(),
      cores: [{ ...core, maxOffsetMm: millimetres(0), caption: null }],
    });

    expect(props.alignmentPaths[0]?.tone).toBe('aligned');
    expect(props.alignmentPaths[0]?.caption).toBeNull();
  });

  it('có lõi thì KHÔNG vẽ thêm đường của trục — hai chùm chồng nhau là không đọc được', () => {
    const props = explodedViewPropsOf(bareOptions(), {
      ...bareRuntime(),
      cores: [core],
      axes: [
        { id: 'A-01', levelId: 'L-01', xFraction: 0.1 },
        { id: 'A-02', levelId: 'L-01', xFraction: 0.9 },
      ],
    });

    expect(props.alignmentPaths).toHaveLength(1);
    expect(props.alignmentPaths.map((path) => path.id)).not.toContain('A-01');
  });

  it('bản vẽ chưa có lõi nào thì lùi về trục, không để trống chỉ báo', () => {
    const props = explodedViewPropsOf(bareOptions(), {
      ...bareRuntime(),
      cores: [],
      axes: [{ id: 'A-01', levelId: 'L-01', xFraction: 0.1 }],
    });

    expect(props.alignmentPaths).toHaveLength(1);
    expect(props.alignmentPaths[0]?.id).toBe('A-01');
  });
});
