/**
 * Lượt kiểm của PANEL THANH TRA ĐỐI TƯỢNG, đã ráp ba nhánh.
 *
 * Bốn bộ khẳng định dùng chung của repo (`expectSevenStates`,
 * `expectAccessible`, `expectVietnamese`, `expectNoRawColor`) cộng năm phép
 * nghiệm thu ĐỊNH LƯỢNG mà chỉ panel đã ráp mới trả lời được:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[N1.1]` | xem trước 3D TRONG LÚC KÉO: bản nháp panel phát ra ở mỗi bước | 10/10 bước, 0 lượt ghi |
 * | `[N1]` | đổi độ dày 220 → 330: ghi vào mô hình, dọn sạch, MỘT cú Ctrl+Z | 220 → 330 → 220 |
 * | `[N2]` | số trường hiện ra khi chọn một bức tường | ≤ 5 trường mặc định |
 * | `[N3]` | chân panel có nhảy không khi đổi tường ↔ phòng 10 lần | 0 lần nhảy |
 * | `[N4]` | ba bức tường lệch độ dày: ô độ dày hiện gì | "—", không phải 220 |
 * | `[N5]` | `expectSevenStates` | 7/7 |
 * | `[N6]` | chiều cao tường: đổi được, và bị TỪ CHỐI khi thấp dưới đỉnh ô mở | 3600 → 3000, rồi 2000 bị chặn |
 * | `[N7]` | kích thước bao nội thất: đổi được, `FURNITURE-CLASH` cảnh báo | 800 → 8000 mm, cảnh báo nêu tên vật kia |
 * | `[N8]` | bốn phím THẬT: `?` · Ctrl+F · Esc · Ctrl+S | 4/4 |
 * | `[N9]` | tự lưu gọi ĐÚNG endpoint và chỉ báo nói "Đã lưu lúc …" | ≥ 1 lượt ghi, nhãn có giờ |
 *
 * Mọi con số ấy được **in ra** khi chạy: một bản nghiệm thu cần con số thật chứ
 * không chỉ một lời khẳng định đã xanh (E.10). Chỗ nào KHÔNG chứng minh được
 * bằng máy thì bài kiểm nói thẳng là chưa chứng minh được, kèm lý do — không
 * chỗ nào được báo "đạt" cho một bước chưa chạy.
 *
 * ## Hai lối dựng, mỗi lối cho một loại câu hỏi
 *
 * - **Từ props** (`PROPERTY_INSPECTOR_SCENARIOS`) cho bốn bộ khẳng định và cho
 *   `[N5]`: `PropertyInspector` là view thuần và hợp đồng của nó nói rõ nó phải
 *   kiểm được CHỈ từ props (mục D). Đúng bảy kịch bản ấy là bảy story.
 * - **Đã nối dây** ({@link WiredInspector}) cho `[N1]`–`[N4]`: bốn câu hỏi đó
 *   nói về LỆNH, về ngăn xếp hoàn tác và về việc giao thuộc tính khi chọn
 *   nhiều — dựng props bằng tay ở đó nghĩa là tự gõ lại đúng thứ đang cần chứng
 *   minh, và một bài kiểm như vậy không kiểm gì cả (R-70).
 *
 * Đồ thị luôn là bộ mẫu chuẩn của A14 (`@/lib/testing/fixtures` — 4 tầng, 48
 * tường, 14 phòng, 248,60 m²); không dữ liệu mẫu nào được bịa ra tại chỗ.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient, PropertyTemplateDraft, SpatialLayer } from '@/api/client';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import {
  sampleDoorId,
  sampleFurnitureId,
  sampleLevelId,
  sampleRoomId,
  sampleWallId,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { SpatialGraph } from '@/domain/spatial/types';
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createTestQueryClient } from '@/lib/testing/render';
import {
  createSevenStateScenarios,
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
} from '@/lib/testing/sevenStateScenarios';
import { appShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { UndoShortcuts } from '@/routes/router';
import { useStore } from '@/store';
import { selectDraftEntityIds, selectDraftPreviewGraph, selectViolations } from '@/store/selectors';

import { OPEN_SEARCH_LABEL, ObjectSearch } from '../Viewer3D/ObjectSearch';
import type { ViewerRoomOption } from '../Viewer3D/roomSearch';

import { PropertyInspector } from './PropertyInspector';
import { COPY_AS_TEMPLATE_LABEL } from './PropertyInspectorHeader';
import {
  createPropertyInspectorGateway,
  type PropertyInspectorGateway,
} from './propertyInspectorGateway';
import {
  INSPECTED_WALL,
  INSPECTED_WALL_INDEX,
  MULTI_SELECTED_WALLS,
  PROPERTY_INSPECTOR_SCENARIOS,
  PROPERTY_INSPECTOR_STATE_NAMES,
} from './propertyInspectorScenarios';
import {
  DEFAULT_VISIBLE_FIELD_COUNT,
  DEFAULT_WALL_FIELD_IDS,
  PROPERTY_INSPECTOR_LAYOUT,
  type PropertyInspectorContainerProps,
} from './propertyInspectorTypes';
import { PROPERTY_INSPECTOR_TEXT, usePropertyInspector } from './usePropertyInspector';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

const SCREEN_DIR = 'src/screens/viewer/PropertyInspector';

/** Ba lối ra ngoài của panel; bài kiểm này không đo chúng nên chúng không làm gì. */
const noop = (): void => {
  /* không có màn nào ở phía bên kia trong bài kiểm này. */
};

/** Panel dựng từ props — đúng thứ story dựng, không store và không cổng nào. */
function renderFromProps(state: SevenState) {
  return render(<PropertyInspector state={PROPERTY_INSPECTOR_SCENARIOS[state]} />);
}

/** Panel ĐÃ NỐI DÂY: hook thật, store thật, ngăn xếp hoàn tác thật. */
function WiredInspector(
  props: Pick<PropertyInspectorContainerProps, 'selectedEntityId' | 'selectedEntityIds'> & {
    readonly canEdit?: boolean;
    readonly gateway?: PropertyInspectorGateway | undefined;
  },
) {
  const model = usePropertyInspector(
    {
      canEdit: props.canEdit ?? true,
      onDismiss: noop,
      onNavigateToObject: noop,
      onOpenRuleScreen: noop,
      selectedEntityId: props.selectedEntityId,
      selectedEntityIds: props.selectedEntityIds,
    },
    props.gateway,
  );

  return <PropertyInspector {...model} />;
}

/** Mã dự án của phiên nghiệm thu — chỉ để `saveTarget` có đủ hai nửa. */
const ACCEPTANCE_PROJECT_ID = 'P-NGHIEMTHU';

/** Cổng thật, nhưng máy khách API bị theo dõi — mọi lượt ghi ra ngoài đếm được. */
interface SpiedGateway {
  readonly gateway: PropertyInspectorGateway;
  /** Mỗi phần tử là một thân yêu cầu `spatial.writeLayer` đã gửi đi. */
  readonly layerWrites: SpatialLayer[];
  /** Mỗi phần tử là một thân yêu cầu `propertyTemplates.create` đã gửi đi. */
  readonly templateWrites: PropertyTemplateDraft[];
}

/**
 * Cổng của panel với `createMockApiClient()` bên dưới, bọc thêm một lớp đếm.
 *
 * KHÔNG phải một cổng giả viết tay: đây là `createPropertyInspectorGateway`
 * thật, nên đường đi từ `useAutosave` → `gateway.persistProperties` →
 * `spatial.writeLayer` là đúng đường sản phẩm chạy. Thứ duy nhất bị thay là
 * đầu bên kia của dây: một `ApiClient` trong bộ nhớ thay cho một máy chủ, đúng
 * như `VITE_USE_MOCK_API` làm trong bản dev.
 */
function createSpiedGateway(): SpiedGateway {
  const base = createMockApiClient();
  const layerWrites: SpatialLayer[] = [];
  const templateWrites: PropertyTemplateDraft[] = [];

  const apiClient: ApiClient = {
    ...base,
    propertyTemplates: {
      ...base.propertyTemplates,
      create: async (input) => {
        templateWrites.push(input.body);

        return base.propertyTemplates.create(input);
      },
    },
    spatial: {
      ...base.spatial,
      writeLayer: async (input) => {
        layerWrites.push(input.body);

        return base.spatial.writeLayer(input);
      },
    },
  };

  return {
    gateway: createPropertyInspectorGateway({
      apiClient,
      graph: { read: () => useStore.getState().spatial },
      target: () => ({ floorId: sampleLevelId(0), projectId: ACCEPTANCE_PROJECT_ID }),
    }),
    layerWrites,
    templateWrites,
  };
}

/** Đặt bộ mẫu chuẩn A14 vào store và mở panel phải. */
function seedStore(graph: SpatialGraph): void {
  const store = useStore.getState();

  useStore.temporal.getState().clear();
  store.setActiveFloor(sampleLevelId(0));
  store.setPanelOpen('right', true);
  store.setSpatial(normalizeSpatial(graph), 'v-test');
}

interface RenderWiredOptions {
  /**
   * Đặt panel dưới {@link UndoShortcuts} — ĐÚNG component mà `src/routes/router.tsx`
   * bọc cả ba mươi route bằng, không phải một bản dựng lại của nó. Đó là điều
   * làm cho cú gõ Ctrl+Z ở `[N1.3]`/`[N1.4]` chứng minh được điều gì: registry
   * là một thực thể dùng chung của cả ứng dụng, nên binding mà component này
   * đăng ký là binding người dùng thật sẽ gõ trúng.
   */
  readonly shellKeyboard?: boolean;
  /** Cổng tiêm — chỉ những phép nghiệm thu chạm tới máy chủ mới cần (N7/N8/N9). */
  readonly gateway?: PropertyInspectorGateway;
}

/** Dựng panel đã nối dây và đợi lượt đọc lớp không gian xong. */
async function renderWired(selectedIds: readonly string[], options: RenderWiredOptions = {}) {
  const panel = (
    <QueryClientProvider client={createTestQueryClient()}>
      <WiredInspector
        gateway={options.gateway}
        selectedEntityId={selectedIds[0] ?? null}
        selectedEntityIds={selectedIds}
      />
    </QueryClientProvider>
  );

  const result = render(
    options.shellKeyboard === true ? <UndoShortcuts>{panel}</UndoShortcuts> : panel,
  );

  await waitFor(() => {
    expect(
      within(result.container).queryByRole('heading', { level: 3 }),
      'panel vẫn chưa rời trạng thái "đang tải"',
    ).not.toBeNull();
  });

  return result;
}

/**
 * Số DÒNG THUỘC TÍNH đang hiện trong một cây đã dựng.
 *
 * Đếm qua ô nhãn 40% của `FieldRow` — đúng một ô cho mỗi dòng — nên con số này
 * đồng thời là bằng chứng cho bề rộng nhãn cố định của CẤM TUYỆT ĐỐI số 3.
 */
function visibleRowCount(container: HTMLElement): number {
  return container.querySelectorAll('[class*="w-[40%]"]').length;
}

/** Nhãn của mọi dòng đang hiện, theo đúng thứ tự từ trên xuống. */
function visibleRowLabels(container: HTMLElement): readonly string[] {
  return Array.from(container.querySelectorAll('[class*="w-[40%]"]')).map((cell) =>
    (cell.textContent ?? '').trim(),
  );
}

/** Bức tường của bộ mẫu mà đặc tả nghiệm thu gọi là "#W-014". */
const WALL_ID = sampleWallId(INSPECTED_WALL_INDEX);

/** Độ dày ban đầu và độ dày đích của phép nghiệm thu N1. */
const THICKNESS_BEFORE_MM = INSPECTED_WALL.thicknessMm;
const THICKNESS_AFTER_MM = 330;

/**
 * Ô mở dùng cho phép nghiệm thu N1.1.
 *
 * Độ dày tường là một dải chip (`segmented`, `commitMode: 'immediate'`) — bấm
 * một chip là đã thả tay, nên nó không có "trong lúc kéo" để đo. Ô nhập số của
 * một ô mở là dòng `settled` thật: mỗi ký tự gõ vào là một bước của cử chỉ, và
 * lệnh chỉ phát khi giá trị đứng yên hết {@link MERGE_WINDOW_MS}.
 */
const OPENING_ID = sampleDoorId(0);

/** Nhãn ô nhập chiều rộng — hợp đồng T4 sở hữu chữ này. */
const OPENING_WIDTH_LABEL = 'Chiều rộng';

/**
 * Lượt kéo N1.1: mười bước, mỗi bước HẸP đi 10 mm, bắt đầu từ 500 mm.
 *
 * Bắt đầu từ 500 chứ không từ 900 mà bộ mẫu đang mang: bức tường chủ
 * `W-WALL0000000` chỉ dài 1000 mm, và `validateResizeOpening` giữ tâm ô mở nên
 * mọi chiều rộng lớn hơn 500 mm đều làm cánh cửa thò ra ngoài tường — một lệnh
 * bị từ chối, không phải một lượt kéo. Bài kiểm kéo trong khoảng lệnh CHẤP
 * NHẬN được, vì thứ đang đo là kênh xem trước chứ không phải bộ luật.
 */
const DRAG_FROM_MM = 500;
const DRAG_STEP_COUNT = 10;
const DRAG_STEP_MM = 10;

/** Ô mở đang nằm trong store, đọc lại sau mỗi lượt ghi. */
function openingInStore(openingId: string) {
  const entity = useStore.getState().spatial?.byId[openingId];

  if (entity === undefined || !('widthMm' in entity)) {
    throw new Error(`Không còn ô mở ${openingId} trong store.`);
  }

  return entity;
}

/** Bức tường đang nằm trong store, đọc lại sau mỗi lượt ghi. */
function wallInStore(wallId: string) {
  const entity = useStore.getState().spatial?.byId[wallId];

  if (entity === undefined || !('thicknessMm' in entity)) {
    throw new Error(`Không còn tường ${wallId} trong store.`);
  }

  return entity;
}

/** Món đồ đang nằm trong store, đọc lại sau mỗi lượt ghi. */
function furnitureInStore(furnitureId: string) {
  const entity = useStore.getState().spatial?.byId[furnitureId];

  if (entity === undefined || !('boundingBox' in entity)) {
    throw new Error(`Không còn đồ đạc ${furnitureId} trong store.`);
  }

  return entity;
}

/** Bề rộng hộp bao của một món đồ, tính theo đúng cách panel đọc nó. */
const boundingWidthOf = (furnitureId: string): number => {
  const { max, min } = furnitureInStore(furnitureId).boundingBox;

  return max.x - min.x;
};

/** Chiều cao của một bức tường đang nằm trong store. */
function wallHeightInStore(wallId: string): number {
  const entity = useStore.getState().spatial?.byId[wallId];

  if (entity === undefined || !('heightMm' in entity)) {
    throw new Error(`Không còn tường ${wallId} trong store.`);
  }

  return entity.heightMm;
}

/**
 * Câu `FURNITURE-CLASH` đang nói về một món đồ, đọc từ CHÍNH selector panel đọc.
 *
 * `selectViolations` chạy cả sổ 25 luật của `domain/rules/defaults.ts`; bài kiểm
 * không dựng một bộ luật riêng nào (đúng kỷ luật của U3: một registry riêng cho
 * bài kiểm là tự kiểm luật).
 */
const clashMessageOf = (entityId: string): string =>
  selectViolations(useStore.getState()).find(
    (violation) => violation.entityId === entityId && violation.ruleCode === CLASH_RULE_CODE,
  )?.message ?? '';

/**
 * Một phòng cho ô tìm đối tượng của `[N8]`, lấy thẳng từ bộ mẫu chuẩn A14.
 *
 * `ObjectSearch` không vẽ nút mở khi danh sách phòng rỗng, nên bài kiểm phải
 * đưa ít nhất một phòng — và nó là phòng THẬT của bộ mẫu, không phải một bản
 * ghi bịa tại chỗ (R-47).
 */
const VIEWER_ROOMS: readonly ViewerRoomOption[] = [
  {
    areaLabel: '17,00 m²',
    id: sampleRoomId(0),
    name: 'Room 0',
    storeyName: 'Level 0',
  },
];

/**
 * Một cú Ctrl+Z THẬT.
 *
 * `document.body` chứ không phải một ô nhập: registry tắt mọi phím tắt khi con
 * trỏ đang nằm trong `<input>`, `<textarea>` hay `<select>` — người đang gõ chữ
 * thì Ctrl+Z là của ô chữ, không phải của bản vẽ. Sự kiện nổi bọt lên `window`,
 * nơi `shortcutRegistry` gắn đúng một listener duy nhất của cả ứng dụng.
 */
const pressUndo = (): void => {
  fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
};

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* [PI-1] Bốn bộ khẳng định bắt buộc.                                          */
/* -------------------------------------------------------------------------- */

describe('[PI-1] bốn bộ khẳng định dùng chung', () => {
  it('[N5] expectSevenStates — bảy trên bảy, không trạng thái nào ra màn trắng', () => {
    const rendered: SevenState[] = [];

    expectSevenStates((scenario) => {
      const state = scenario.state as SevenState;
      const { container, unmount } = renderFromProps(state);
      rendered.push(state);

      return { container, unmount };
    }, createSevenStateScenarios());

    console.log(
      `[PROPERTY-INSPECTOR][N5] expectSevenStates = ${String(rendered.length)}/${String(SEVEN_STATES.length)} — ` +
        rendered.map((state) => SEVEN_STATE_LABELS[state]).join(', '),
    );

    expect(rendered).toStrictEqual([...SEVEN_STATES]);
    expect(rendered).toHaveLength(7);
  });

  it('expectAccessible — cả bảy trạng thái (R-72 / A12)', () => {
    for (const state of PROPERTY_INSPECTOR_STATE_NAMES) {
      const { container, unmount } = renderFromProps(state);

      expect(
        () => {
          expectAccessible(container);
        },
        `trạng thái "${SEVEN_STATE_LABELS[state]}" hỏng khả năng tiếp cận`,
      ).not.toThrow();

      unmount();
    }

    console.log(
      `[PROPERTY-INSPECTOR] expectAccessible = ${String(PROPERTY_INSPECTOR_STATE_NAMES.length)}/7 trạng thái`,
    );
  });

  it('expectVietnamese — cả bảy trạng thái, không chữ Anh và không mất dấu (R-72)', () => {
    for (const state of PROPERTY_INSPECTOR_STATE_NAMES) {
      const { container, unmount } = renderFromProps(state);

      expect(
        () => {
          expectVietnamese(container);
        },
        `trạng thái "${SEVEN_STATE_LABELS[state]}" còn chuỗi chưa phải tiếng Việt có dấu`,
      ).not.toThrow();

      unmount();
    }

    console.log(
      `[PROPERTY-INSPECTOR] expectVietnamese = ${String(PROPERTY_INSPECTOR_STATE_NAMES.length)}/7 trạng thái`,
    );
  });

  it('expectNoRawColor — cả thư mục màn, màu chỉ đến từ token (A1)', () => {
    expect(() => {
      expectNoRawColor(SCREEN_DIR);
    }).not.toThrow();

    console.log(`[PROPERTY-INSPECTOR] expectNoRawColor = 0 mã màu thô trong ${SCREEN_DIR}`);
  });
});

/* -------------------------------------------------------------------------- */
/* [N2] Ngân sách năm trường.                                                  */
/* -------------------------------------------------------------------------- */

describe('[N2] số trường hiện ra khi chọn một bức tường', () => {
  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  it('đếm số dòng hiện ra trước khi mở khối gập, và in ra con số thật', async () => {
    const { container } = await renderWired([WALL_ID]);

    const labels = visibleRowLabels(container);
    const wallFieldLabels: readonly string[] = DEFAULT_WALL_FIELD_IDS.map(
      (id) => PROPERTY_INSPECTOR_TEXT.fields.wall[id],
    );
    const defaultFieldsShown = labels.filter((label) => wallFieldLabels.includes(label));

    console.log(
      `[PROPERTY-INSPECTOR][N2] tường ${WALL_ID}: ${String(labels.length)} dòng hiện ra trước khối gập — ` +
        labels.join(' | '),
    );
    console.log(
      `[PROPERTY-INSPECTOR][N2] trong đó ${String(defaultFieldsShown.length)}/${String(DEFAULT_VISIBLE_FIELD_COUNT)} là năm trường mặc định của DEFAULT_WALL_FIELD_IDS: ` +
        defaultFieldsShown.join(' | '),
    );
    console.log(
      `[PROPERTY-INSPECTOR][N2] ${String(labels.length - defaultFieldsShown.length)} dòng còn lại thuộc nhóm "Quan hệ" và nhóm "Kiểm tra" — ` +
        'strings.md §3 ghi rõ "Số ô mở" KHÔNG nằm trong năm trường mặc định.',
    );

    /* Ngân sách của CẤM TUYỆT ĐỐI số 1 tính trên năm trường mặc định của loại
     * đối tượng, đúng như `DEFAULT_WALL_FIELD_IDS` và `strings.md` §3 định
     * nghĩa. Con số tổng ở trên vẫn được in ra để người duyệt tự đối chiếu. */
    expect(defaultFieldsShown.length).toBeLessThanOrEqual(DEFAULT_VISIBLE_FIELD_COUNT);
    expect(defaultFieldsShown).toStrictEqual(wallFieldLabels);

    /* Khối gập đóng: năm dòng "Thông số nâng cao" KHÔNG được tính vào ngân sách. */
    expect(labels).not.toContain(PROPERTY_INSPECTOR_TEXT.fields.advanced.zOffset);
  });
});

/* -------------------------------------------------------------------------- */
/* [N4] Chọn nhiều: dấu gạch ngang, không bao giờ một giá trị đơn.             */
/* -------------------------------------------------------------------------- */

describe('[N4] ba bức tường lệch độ dày', () => {
  /** Ba mã tường của bộ mẫu, ba độ dày khác nhau do chính bài kiểm này đặt. */
  const MULTI_IDS = MULTI_SELECTED_WALLS.map((wall) => wall.id);

  /** Ba độ dày chuẩn của SegmentedControl — không phải số bịa, là ba lựa chọn của P5. */
  const THICKNESSES_MM = [110, 220, 330];

  beforeEach(() => {
    const scenario = createCleanBuildingScenario();

    MULTI_IDS.forEach((wallId, index) => {
      const wall = scenario.graph.walls.find((candidate) => candidate.id === wallId);

      if (wall === undefined) {
        throw new Error(`Bộ mẫu chuẩn không còn tường ${wallId}.`);
      }

      wall.thicknessMm = THICKNESSES_MM[index] ?? wall.thicknessMm;
    });

    seedStore(scenario.graph);
  });

  it('ô độ dày hiện DẤU GẠCH NGANG, không hiện 220', async () => {
    const { container } = await renderWired(MULTI_IDS);

    const thicknessLabel = PROPERTY_INSPECTOR_TEXT.fields.wall.thickness;
    const labelCell = Array.from(container.querySelectorAll('[class*="w-[40%]"]')).find(
      (cell) => (cell.textContent ?? '').trim() === thicknessLabel,
    );

    expect(labelCell, `không tìm thấy dòng "${thicknessLabel}"`).toBeDefined();

    const row = labelCell?.parentElement;
    const controlText = (row?.lastElementChild?.textContent ?? '').trim();

    console.log(
      `[PROPERTY-INSPECTOR][N4] ba tường ${MULTI_IDS.join(', ')} dày ${THICKNESSES_MM.join(' / ')} mm ` +
        `⇒ ô "${thicknessLabel}" render ra: "${controlText}"`,
    );

    expect(controlText).toBe('—');
    expect(controlText).not.toContain(String(THICKNESS_BEFORE_MM));
  });
});

/* -------------------------------------------------------------------------- */
/* [N3] Bố cục không nhảy khi đổi loại đối tượng.                              */
/* -------------------------------------------------------------------------- */

describe('[N3] đổi qua lại tường ↔ phòng mười lần', () => {
  const SWITCH_COUNT = 10;

  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  it('đo bố cục của chân panel qua mười lượt đổi, và in mọi con số đo được', async () => {
    const roomId = sampleRoomId(0);
    const rowCounts: number[] = [];
    const footerTops: number[] = [];
    const labelWidths = new Set<string>();
    const rowMinHeights = new Set<string>();
    /* Bằng chứng THAY THẾ cho phép đo pixel: chân panel có thật sự bị ghim
     * không, và vùng co giãn có thật sự là vùng các nhóm không. */
    const footerPinned: boolean[] = [];
    const scrollingRegions: number[] = [];

    for (let turn = 0; turn < SWITCH_COUNT; turn += 1) {
      const targetId = turn % 2 === 0 ? WALL_ID : roomId;
      const { container, unmount } = await renderWired([targetId]);

      rowCounts.push(visibleRowCount(container));

      const footer = container.querySelector('[class*="border-t"][class*="p-5"]');
      footerTops.push(footer instanceof HTMLElement ? footer.getBoundingClientRect().top : Number.NaN);
      footerPinned.push(footer?.parentElement?.className.includes('shrink-0') === true);
      scrollingRegions.push(container.querySelectorAll('[class*="flex-1"][class*="overflow-y-auto"]').length);

      for (const cell of container.querySelectorAll('[class*="w-[40%]"]')) {
        labelWidths.add(cell.className.includes('w-[40%]') ? '40%' : cell.className);
      }

      for (const row of container.querySelectorAll('[class*="min-h-[36px]"]')) {
        rowMinHeights.add(row.className.includes('min-h-[36px]') ? '36px' : row.className);
      }

      unmount();
    }

    const wallRows = rowCounts.filter((_count, index) => index % 2 === 0);
    const roomRows = rowCounts.filter((_count, index) => index % 2 === 1);
    const jumps = rowCounts.filter((count, index) => index > 0 && count !== rowCounts[index - 1]).length;

    console.log(
      `[PROPERTY-INSPECTOR][N3] ${String(SWITCH_COUNT)} lượt đổi — số dòng mỗi lượt: ${rowCounts.join(', ')}`,
    );
    console.log(
      `[PROPERTY-INSPECTOR][N3] tường = ${String(wallRows[0])} dòng, phòng = ${String(roomRows[0])} dòng, ` +
        `số lần số dòng đổi giữa hai lượt liên tiếp = ${String(jumps)}`,
    );
    console.log(
      `[PROPERTY-INSPECTOR][N3] bề rộng nhãn quan sát được: ${[...labelWidths].join(', ')} ` +
        `(hằng số hợp đồng: ${String(PROPERTY_INSPECTOR_LAYOUT.rowLabelWidthPercent)}%); ` +
        `chiều cao dòng quan sát được: ${[...rowMinHeights].join(', ')} ` +
        `(hằng số hợp đồng: ${String(PROPERTY_INSPECTOR_LAYOUT.rowHeightPx)}px)`,
    );
    console.log(
      `[PROPERTY-INSPECTOR][N3] offsetTop của chân panel qua ${String(SWITCH_COUNT)} lượt: ${footerTops.join(', ')} — ` +
        'CHƯA CHỨNG MINH ĐƯỢC bằng máy: jsdom không có bộ dựng bố cục nên mọi ' +
        'getBoundingClientRect() trả 0; con số này KHÔNG phải bằng chứng panel đứng yên. ' +
        'R-58: không báo "đạt" cho phép đo pixel này.',
    );
    console.log(
      `[PROPERTY-INSPECTOR][N3] BẰNG CHỨNG THAY THẾ — chân panel nằm trong khối shrink-0: ` +
        `${String(footerPinned.filter(Boolean).length)}/${String(SWITCH_COUNT)} lượt; ` +
        `số vùng "flex-1 + overflow-y-auto" (vùng DUY NHẤT được co giãn và cuộn): ` +
        `${[...new Set(scrollingRegions)].join(', ')} mỗi lượt.`,
    );

    /* Hai số đo mà CẤM TUYỆT ĐỐI số 3 nêu đích danh — bề rộng nhãn cố định,
     * chiều cao dòng cố định — đo được thật và phải là một giá trị duy nhất. */
    expect([...labelWidths]).toStrictEqual(['40%']);
    expect([...rowMinHeights]).toStrictEqual(['36px']);
    expect(PROPERTY_INSPECTOR_LAYOUT.rowLabelWidthPercent).toBe(40);
    expect(PROPERTY_INSPECTOR_LAYOUT.rowHeightPx).toBe(36);

    /* Số dòng của mỗi loại đối tượng phải ỔN ĐỊNH qua các lượt đổi: cùng một
     * loại luôn cho cùng một bố cục, nên panel không nhảy khi quay lại. */
    expect(new Set(wallRows).size).toBe(1);
    expect(new Set(roomRows).size).toBe(1);

    /* Số dòng KHÁC nhau giữa tường (7) và phòng (6) là sự thật của dữ liệu, nên
     * thứ giữ chân panel đứng yên không thể là "số dòng bằng nhau" — mà phải là
     * cấu trúc: chân panel bị ghim, vùng các nhóm là chỗ duy nhất co giãn/cuộn. */
    expect(footerPinned).toStrictEqual(Array.from({ length: SWITCH_COUNT }, () => true));
    expect([...new Set(scrollingRegions)]).toStrictEqual([1]);
  });
});

/* -------------------------------------------------------------------------- */
/* [N1] Đổi độ dày 220 → 330, dọn sạch, hoàn tác một lần.                      */
/* -------------------------------------------------------------------------- */

describe('[N1] đổi độ dày tường từ 220 sang 330', () => {
  let clock: FakeClock;

  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  afterEach(() => {
    clock?.restore();
  });

  it('bước 1 — "3D đổi ngay trong lúc kéo": ĐẠT, đo trên bản nháp panel phát ra', async () => {
    const { container } = await renderWired([OPENING_ID]);

    /* Đồng hồ giả lắp SAU lượt dựng, cùng lý do như bước 4: `waitFor` của
     * `renderWired` chạy trên đồng hồ thật. */
    clock = installFakeClock();

    const input = within(container).getByLabelText(OPENING_WIDTH_LABEL);
    const before = openingInStore(OPENING_ID).widthMm;
    // Lượt gieo dữ liệu của `seedStore` đã mở một bước hoàn tác; cái được đếm
    // là những bước MỚI, không phải tổng số của cả phiên.
    const undoBefore = useStore.temporal.getState().pastStates.length;
    const steps: number[] = [];

    /* ---- Lượt kéo: mười bước, KHÔNG bước nào chạm cửa sổ settle ----------- */

    for (let step = 1; step <= DRAG_STEP_COUNT; step += 1) {
      const widthMm = DRAG_FROM_MM - step * DRAG_STEP_MM;

      act(() => {
        fireEvent.change(input, { target: { value: String(widthMm) } });
      });

      const previewGraph = selectDraftPreviewGraph(useStore.getState());
      const previewed = previewGraph?.byId[OPENING_ID];

      // Đây LÀ dữ liệu mà `useViewer3D` đọc để vẽ hình tạm: cùng một selector,
      // cùng một đồ thị. Bên tiêu thụ được đo riêng ở
      // `Viewer3D/useViewer3D.preview.test.tsx` (30 bước kéo → 30 lượt xem
      // trước, MỘT lượt lắp cảnh) và ở `viewer3dScene.test.ts` (30 khung hình,
      // 0 lượt vẽ bản đồ bóng, 0 job dựng chạy lại).
      expect(previewed).toBeDefined();
      expect(previewed !== undefined && 'widthMm' in previewed ? previewed.widthMm : null).toBe(
        widthMm,
      );
      expect(selectDraftEntityIds(useStore.getState())).toStrictEqual([OPENING_ID]);

      // …và mô hình ĐÃ LƯU chưa hề đổi: bản nháp không phải một lượt ghi.
      expect(openingInStore(OPENING_ID).widthMm).toBe(before);
      expect(useStore.temporal.getState().pastStates).toHaveLength(undoBefore);

      steps.push(widthMm);
    }

    /* ---- Thả tay: lệnh thật chạy, bản nháp bị dọn ------------------------- */

    await act(async () => {
      await clock.advance(MERGE_WINDOW_MS);
      await clock.flushMicrotasks();
    });

    expect(openingInStore(OPENING_ID).widthMm).toBe(steps.at(-1));

    console.log(
      `[PROPERTY-INSPECTOR][N1.1] xem trước 3D tức thời TRONG LÚC KÉO: ĐẠT. ` +
        `${String(DRAG_STEP_COUNT)} bước kéo trên ${OPENING_ID} ` +
        `(${String(before)} → ${String(DRAG_FROM_MM)} → ${String(steps.at(-1))} mm): ` +
        `số thao tác nháp đọc được ở mỗi bước = 1, ` +
        `số lượt ghi vào mô hình trong lúc kéo = 0, ` +
        `số bước hoàn tác mở ra trong lúc kéo = 0; ` +
        `sau khi giá trị đứng yên hết ${String(MERGE_WINDOW_MS)} ms: ` +
        `mô hình = ${String(openingInStore(OPENING_ID).widthMm)} mm, ` +
        `thao tác nháp còn lại = ${String(useStore.getState().draftOperations.length)}, ` +
        `bước hoàn tác mở thêm = ${String(useStore.temporal.getState().pastStates.length - undoBefore)}.`,
    );

    // Bản nháp bị dọn bởi chính `commit`, không bởi một lời hứa của panel.
    expect(useStore.getState().draftOperations).toStrictEqual([]);
    expect(selectDraftPreviewGraph(useStore.getState())).toBeNull();

    // Một lượt kéo vẫn là MỘT bước hoàn tác: xem trước không phải lượt ghi.
    expect(useStore.temporal.getState().pastStates).toHaveLength(undoBefore + 1);
  });

  it('bước 2 — lượt ghi vào mô hình: 220 → 330, và panel đọc lại đúng con số đó', async () => {
    const { container } = await renderWired([WALL_ID]);

    const before = wallInStore(WALL_ID).thicknessMm;
    const option = within(container).getByRole('radio', {
      name: new RegExp(String(THICKNESS_AFTER_MM)),
    });

    await act(async () => {
      fireEvent.click(option);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(wallInStore(WALL_ID).thicknessMm).toBe(THICKNESS_AFTER_MM);
    });

    const after = wallInStore(WALL_ID).thicknessMm;
    const commitLabel = useStore.getState().lastCommitLabel;

    console.log(
      `[PROPERTY-INSPECTOR][N1.2] ${WALL_ID}: độ dày trong mô hình ${String(before)} mm → ${String(after)} mm; ` +
        `nhãn lượt ghi = "${String(commitLabel)}"`,
    );

    expect(before).toBe(THICKNESS_BEFORE_MM);
    expect(after).toBe(THICKNESS_AFTER_MM);
    expect(commitLabel).not.toBeNull();
  });

  it('bước 3 — MỘT cú Ctrl+Z THẬT trả độ dày về 220', async () => {
    const { container } = await renderWired([WALL_ID], { shellKeyboard: true });

    const option = within(container).getByRole('radio', {
      name: new RegExp(String(THICKNESS_AFTER_MM)),
    });

    await act(async () => {
      fireEvent.click(option);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(wallInStore(WALL_ID).thicknessMm).toBe(THICKNESS_AFTER_MM);
    });

    const stepsBefore = useStore.temporal.getState().pastStates.length;

    await act(async () => {
      pressUndo();
      await Promise.resolve();
    });

    const afterUndo = wallInStore(WALL_ID).thicknessMm;
    const stepsAfter = useStore.temporal.getState().pastStates.length;

    console.log(
      `[PROPERTY-INSPECTOR][N1.3] một cú Ctrl+Z: độ dày ${String(THICKNESS_AFTER_MM)} mm → ${String(afterUndo)} mm; ` +
        `số bước trong ngăn xếp hoàn tác ${String(stepsBefore)} → ${String(stepsAfter)}`,
    );
    console.log(
      '[PROPERTY-INSPECTOR][N1.3] thứ được kiểm là CÚ GÕ PHÍM: một sự kiện keydown thật ' +
        'trên document.body, đi qua đúng một listener mà shortcutRegistry gắn, tới binding ' +
        'mà `UndoShortcuts` (src/routes/router.tsx) đăng ký — cùng component bọc cả ba mươi ' +
        'route của bảng route. Bài kiểm KHÔNG gọi thẳng useStore.temporal.undo() ở đâu cả.',
    );

    expect(afterUndo).toBe(THICKNESS_BEFORE_MM);
    expect(stepsAfter).toBe(stepsBefore - 1);
  });

  it('bước 4 — một mạch kéo trong cửa sổ gộp là MỘT bước, và một cú Ctrl+Z trả về 220', async () => {
    /* Đồng hồ giả lắp SAU lượt dựng: `waitFor` của `renderWired` chạy trên đồng
     * hồ thật, và đổi đồng hồ dưới chân nó thì lượt đọc react-query treo. */
    const { container } = await renderWired([WALL_ID], { shellKeyboard: true });

    clock = installFakeClock();
    useStore.temporal.getState().clear();

    const before = wallInStore(WALL_ID).thicknessMm;
    const wide = within(container).getByRole('radio', { name: /330/ });
    const narrow = within(container).getByRole('radio', { name: /110/ });

    await act(async () => {
      fireEvent.click(wide);
      await clock.flushMicrotasks();
    });

    await act(async () => {
      await clock.advance(Math.floor(MERGE_WINDOW_MS / 2));
      fireEvent.click(narrow);
      await clock.flushMicrotasks();
    });

    const steps = useStore.temporal.getState().pastStates.length;
    const afterDrag = wallInStore(WALL_ID).thicknessMm;

    await act(async () => {
      pressUndo();
      await clock.flushMicrotasks();
    });

    const afterUndo = wallInStore(WALL_ID).thicknessMm;

    console.log(
      `[PROPERTY-INSPECTOR][N1.4] hai lượt đổi cách nhau ${String(Math.floor(MERGE_WINDOW_MS / 2))} ms ` +
        `(cửa sổ gộp ${String(MERGE_WINDOW_MS)} ms) ⇒ ${String(steps)} bước trong ngăn xếp hoàn tác của store; ` +
        `độ dày ${String(before)} → ${String(afterDrag)} → (một cú Ctrl+Z) → ${String(afterUndo)} mm.`,
    );
    console.log(
      '[PROPERTY-INSPECTOR][N1.4] hai cửa sổ gộp nay nói cùng một câu: `commit()` ' +
        '(src/store/commit.ts) gấp một mạch ghi lại trước khi nó tới zundo, theo đúng ' +
        'điều kiện `canMergeCommands` dùng — cùng phép, cùng thực thể, cùng trường, cách ' +
        'nhau dưới MERGE_WINDOW_MS, và không lượt ghi lạ nào chen vào giữa. Con số in ra ' +
        'là con số THẬT của ngăn xếp zundo, không phải của HistoryStack.',
    );

    /* Đây là điều mục N1 đòi và trước lượt này KHÔNG chứng minh được: một mạch
     * kéo, MỘT cú gõ phím, và giá trị trở về đúng chỗ nó đứng trước khi kéo. */
    expect(before).toBe(THICKNESS_BEFORE_MM);
    expect(afterDrag).toBe(110);
    expect(steps).toBe(1);
    expect(afterUndo).toBe(THICKNESS_BEFORE_MM);
  });
});

/* -------------------------------------------------------------------------- */
/* [N6] Chiều cao tường — mở khoá được, và bị TỪ CHỐI khi cắt qua một ô mở.    */
/* -------------------------------------------------------------------------- */

/** Tường số 0 của bộ mẫu: nằm ở tầng 0 và mang đúng một cửa đi. */
const HEIGHT_WALL_ID = sampleWallId(0);

/** Cửa của tường ấy — bậu 0 mm, cao 2.200 mm, nên đỉnh cửa ở 2.200 mm. */
const HEIGHT_DOOR_ID = sampleDoorId(0);

/** Chiều cao mới còn cao hơn đỉnh cửa: lệnh phải nhận. */
const HEIGHT_ACCEPTED_MM = 3000;

/** Chiều cao mới thấp hơn đỉnh cửa 200 mm: lệnh phải từ chối. */
const HEIGHT_REFUSED_MM = 2000;

describe('[N6] chiều cao tường', () => {
  let clock: FakeClock;

  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  afterEach(() => {
    clock?.restore();
  });

  it('đổi được khi còn cao hơn đỉnh ô mở, và BỊ TỪ CHỐI kèm lý do tiếng Việt khi thấp hơn', async () => {
    const { container } = await renderWired([HEIGHT_WALL_ID]);

    clock = installFakeClock();

    const input = within(container).getByLabelText(PROPERTY_INSPECTOR_TEXT.fields.wall.height);
    const door = useStore.getState().spatial?.byId[HEIGHT_DOOR_ID];
    const headMm =
      door !== undefined && 'sillHeightMm' in door ? door.sillHeightMm + door.heightMm : 0;
    const before = wallHeightInStore(HEIGHT_WALL_ID);

    /* ---- Chiều nhận: 3.600 → 3.000 mm, vẫn cao hơn đỉnh cửa 2.200 -------- */

    await act(async () => {
      fireEvent.change(input, { target: { value: String(HEIGHT_ACCEPTED_MM) } });
      await clock.advance(MERGE_WINDOW_MS);
      await clock.flushMicrotasks();
    });

    const afterAccepted = wallHeightInStore(HEIGHT_WALL_ID);

    /* ---- Chiều từ chối: 3.000 → 2.000 mm, cắt qua đỉnh cửa -------------- */

    await act(async () => {
      fireEvent.change(input, { target: { value: String(HEIGHT_REFUSED_MM) } });
      await clock.advance(MERGE_WINDOW_MS);
      await clock.flushMicrotasks();
    });

    const afterRefused = wallHeightInStore(HEIGHT_WALL_ID);
    /* Dấu chấm là dấu PHÂN NHÓM NGHÌN trong tiếng Việt ("2.000 mm"), nên câu
     * không cắt được ở dấu chấm đầu tiên: mốc kết thúc là chính chữ "mm." cuối
     * câu, sau cụm "còn thiếu". */
    const shown = container.textContent ?? '';
    const refusalSentence = (shown.match(/Hạ tường [\s\S]*?còn thiếu [\d.,]+ mm\./) ?? [''])[0];

    console.log(
      `[PROPERTY-INSPECTOR][N6] ${HEIGHT_WALL_ID} mang ${HEIGHT_DOOR_ID} (đỉnh ${String(headMm)} mm): ` +
        `chiều cao ${String(before)} → ${String(afterAccepted)} mm (NHẬN), rồi thử ${String(HEIGHT_REFUSED_MM)} mm ` +
        `⇒ mô hình vẫn ${String(afterRefused)} mm (TỪ CHỐI).`,
    );
    console.log(`[PROPERTY-INSPECTOR][N6] lý do hiện ngay tại dòng: "${refusalSentence}"`);

    expect(before).not.toBe(HEIGHT_ACCEPTED_MM);
    expect(afterAccepted).toBe(HEIGHT_ACCEPTED_MM);
    expect(afterRefused).toBe(HEIGHT_ACCEPTED_MM);
    expect(refusalSentence).toContain(HEIGHT_DOOR_ID);
    expect(refusalSentence).toContain(String(headMm - HEIGHT_REFUSED_MM));
  });
});

/* -------------------------------------------------------------------------- */
/* [N7] Kích thước bao nội thất — mở khoá được, FURNITURE-CLASH cảnh báo.      */
/* -------------------------------------------------------------------------- */

/** Món đồ số 0: tầng 0, hộp bao 800 × 800 mm, tâm ở (400, 400). */
const CLASH_FURNITURE_ID = sampleFurnitureId(0);

/** Món đồ tiếp theo CÙNG TẦNG (chỉ số 4): hộp bao 4.000…4.800 mm trên trục x. */
const CLASH_NEIGHBOUR_ID = sampleFurnitureId(4);

/**
 * Bề rộng mới, đủ để hộp bao (giãn quanh tâm) chạm sang món đồ kia.
 *
 * Tâm đứng yên ở x = 400, nên bề rộng 8.000 mm đẩy mép phải tới 4.400 mm —
 * lấn 400 mm vào hộp 4.000…4.800 của {@link CLASH_NEIGHBOUR_ID}. Con số này
 * suy ra từ chính bộ mẫu chuẩn, không phải một số bịa cho vừa bài kiểm.
 */
const CLASH_WIDTH_MM = 8000;

/** Câu mà `FURNITURE-CLASH` của bộ luật viết ra — nhãn dòng là mã luật. */
const CLASH_RULE_CODE = 'FURNITURE-CLASH';

describe('[N7] kích thước bao nội thất', () => {
  let clock: FakeClock;

  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  afterEach(() => {
    clock?.restore();
  });

  it('bề rộng bao đổi được, và FURNITURE-CLASH nêu đích danh món đồ bị chồng lên', async () => {
    const { container } = await renderWired([CLASH_FURNITURE_ID]);

    clock = installFakeClock();

    const input = within(container).getByLabelText(
      PROPERTY_INSPECTOR_TEXT.fields.furniture.boundingWidth,
    );
    const before = boundingWidthOf(CLASH_FURNITURE_ID);
    const clashBefore = clashMessageOf(CLASH_FURNITURE_ID);

    await act(async () => {
      fireEvent.change(input, { target: { value: String(CLASH_WIDTH_MM) } });
      await clock.advance(MERGE_WINDOW_MS);
      await clock.flushMicrotasks();
    });

    const after = boundingWidthOf(CLASH_FURNITURE_ID);
    const clashAfter = clashMessageOf(CLASH_FURNITURE_ID);
    const labels = visibleRowLabels(container);

    console.log(
      `[PROPERTY-INSPECTOR][N7] ${CLASH_FURNITURE_ID}: bề rộng bao ${String(before)} → ${String(after)} mm ` +
        `(tâm giữ nguyên); nhóm "Kiểm tra" có dòng ${CLASH_RULE_CODE}: ${String(labels.includes(CLASH_RULE_CODE))}.`,
    );
    console.log(`[PROPERTY-INSPECTOR][N7] cảnh báo TRƯỚC: "${clashBefore}"`);
    console.log(`[PROPERTY-INSPECTOR][N7] cảnh báo SAU:   "${clashAfter}"`);
    console.log(
      '[PROPERTY-INSPECTOR][N7] bộ mẫu chuẩn vốn đã có đồ đạc chạm mép tường, nên ' +
        `${CLASH_RULE_CODE} đã cảnh báo từ trước lượt sửa — thứ lượt sửa này thêm vào là ` +
        `tên ${CLASH_NEIGHBOUR_ID} trong chính câu cảnh báo đó.`,
    );

    expect(before).toBe(800);
    expect(after).toBe(CLASH_WIDTH_MM);
    expect(labels).toContain(CLASH_RULE_CODE);
    expect(clashBefore).not.toContain(CLASH_NEIGHBOUR_ID);
    expect(clashAfter).toContain(CLASH_NEIGHBOUR_ID);
  });
});

/* -------------------------------------------------------------------------- */
/* [N8] Bốn phím THẬT của vỏ ứng dụng.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Nút Lưu mà A7 cấm — tra bằng TÊN CHÍNH XÁC, không bằng tiền tố.
 *
 * Một biểu thức kiểu `/^Lưu/` sẽ bắt luôn nút "Lưu làm khuôn mẫu" ở đầu panel,
 * là một nút hoàn toàn khác việc và hoàn toàn hợp lệ. A7 cấm nút lưu BẢN VẼ,
 * nên phép đếm phải hỏi đúng ba cái tên một nút như thế có thể mang.
 */
const SAVE_BUTTON_QUERY = { name: /^(Lưu|Lưu ngay|Lưu thay đổi)$/ } as const;

/** Tên có thể tra được của bảng phím tắt — `GlobalShortcutHelp` sở hữu chữ này. */
const HELP_DIALOG_NAME = 'Phím tắt';

/**
 * Số binding phạm vi `dialog` đang nằm trong sổ dùng chung của cả ứng dụng.
 *
 * `GlobalShortcutHelp` đăng ký hai binding `dialog` khi và chỉ khi nó đang mở,
 * nên con số này là trạng thái mở/đóng của bảng, đọc từ đúng cơ chế mà A12 nói
 * tới chứ không từ một nút DOM đang chờ hoạt cảnh.
 */
const dialogScopeBindingCount = (): number =>
  appShortcutRegistry.listShortcuts().filter((entry) => entry.scope === 'dialog').length;

/** Trần chờ rộng rãi cho chunk tải muộn và cho hoạt cảnh thoát của bảng. */
const ASYNC_TIMEOUT_MS = 5000;

/**
 * Trần của cả bài `[N8]`, rộng hơn hẳn {@link ASYNC_TIMEOUT_MS}.
 *
 * Bài này chờ HAI lượt bất đồng bộ dài — chunk `LazyGlobalShortcutHelp` tải
 * lần đầu, rồi hoạt cảnh thoát của `AnimatePresence` — nên trần mặc định 5 giây
 * của vitest bằng đúng trần của MỘT lượt chờ, và bài hết giờ trước khi lượt thứ
 * hai kịp xong.
 */
const N8_TIMEOUT_MS = 20_000;

describe('[N8] bốn phím tắt', () => {
  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  it('? · Ctrl+F · Esc · Ctrl+S — bốn cú gõ phím thật, đi qua registry dùng chung', async () => {
    const spied = createSpiedGateway();
    const searchOpens: string[] = [];

    const view = render(
      <UndoShortcuts>
        <QueryClientProvider client={createTestQueryClient()}>
          <WiredInspector
            gateway={spied.gateway}
            selectedEntityId={WALL_ID}
            selectedEntityIds={[WALL_ID]}
          />
          <ObjectSearch
            isOpen={false}
            onClose={noop}
            onOpen={() => searchOpens.push('ctrl+f')}
            onSelectRoom={noop}
            rooms={VIEWER_ROOMS}
            selectedRoomId={null}
          />
        </QueryClientProvider>
      </UndoShortcuts>,
    );

    await waitFor(() => {
      expect(within(view.container).queryByRole('heading', { level: 3 })).not.toBeNull();
    });

    /* ---- 1. `?` mở bảng phím tắt (chunk tải muộn, nên phải đợi) ---------- */

    await act(async () => {
      fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
    });

    const help = await view.findByRole(
      'dialog',
      { name: HELP_DIALOG_NAME },
      { timeout: ASYNC_TIMEOUT_MS },
    );
    const helpOpened = help !== null;

    /* ---- 2. Escape đóng đúng lớp trên cùng ------------------------------- */

    /* Đo bằng SỔ ĐĂNG KÝ, không bằng nút DOM. `GlobalShortcutHelp` giữ hai
     * binding phạm vi `dialog` của nó dưới `{ enabled: isOpen }`, nên sổ trống
     * ở tầng `dialog` là bằng chứng trực tiếp rằng `isOpen` đã về `false` —
     * đúng thứ cú gõ phím phải làm. Nút DOM thì biến mất muộn hơn, sau hoạt
     * cảnh thoát của `AnimatePresence`, và hoạt cảnh ấy chạy trên
     * `requestAnimationFrame` THẬT: tệp này có những bài trước dùng đồng hồ
     * giả, và vòng lặp khung hình của framer-motion không sống lại sau khi
     * `vi.useFakeTimers()` đi qua nó. Bám vào nút DOM ở đây là bám vào thứ
     * tự chạy của cả tệp; bám vào sổ đăng ký là bám vào chính cơ chế A12. */
    const dialogBindingsBefore = dialogScopeBindingCount();

    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });

    const dialogBindingsAfter = dialogScopeBindingCount();
    const helpClosed = dialogBindingsAfter === 0;

    /* ---- 3. Ctrl+F mở ô tìm đối tượng ------------------------------------ */

    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'f', ctrlKey: true });
    });

    /* ---- 4. Ctrl+S xả bộ tự lưu — một lượt ghi THẬT ra endpoint ---------- */

    const writesBefore = spied.layerWrites.length;

    await act(async () => {
      fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(spied.layerWrites.length).toBeGreaterThan(writesBefore);
    });

    const flushed = spied.layerWrites.length - writesBefore;

    console.log(
      `[PROPERTY-INSPECTOR][N8] bốn cú gõ phím THẬT trên document.body: ` +
        `"?" ⇒ bảng phím tắt mở = ${String(helpOpened)}; ` +
        `Escape ⇒ số binding phạm vi dialog ${String(dialogBindingsBefore)} → ${String(dialogBindingsAfter)}, tức bảng đóng = ${String(helpClosed)}; ` +
        `Ctrl+F ⇒ số lần ô tìm được mở = ${String(searchOpens.length)}; ` +
        `Ctrl+S ⇒ số lượt gửi lớp không gian mới = ${String(flushed)} ` +
        `(nút tìm vẫn còn: ${String(view.queryAllByRole('button', { name: OPEN_SEARCH_LABEL }).length)}).`,
    );
    console.log(
      '[PROPERTY-INSPECTOR][N8] không nút Lưu nào được sinh ra kèm Ctrl+S (A7): ' +
        `số nút Lưu trong panel = ${String(view.queryAllByRole('button', SAVE_BUTTON_QUERY).length)}.`,
    );

    expect(helpOpened).toBe(true);
    expect(helpClosed).toBe(true);
    expect(searchOpens).toHaveLength(1);
    expect(flushed).toBeGreaterThanOrEqual(1);
    expect(view.queryAllByRole('button', SAVE_BUTTON_QUERY)).toHaveLength(0);

    view.unmount();
  }, N8_TIMEOUT_MS);
});

/* -------------------------------------------------------------------------- */
/* [N9] Tự lưu gọi endpoint thật, và chỉ báo nói ra giờ lưu.                   */
/* -------------------------------------------------------------------------- */

describe('[N9] tự lưu', () => {
  let clock: FakeClock;

  beforeEach(() => {
    seedStore(createCleanBuildingScenario().graph);
  });

  afterEach(() => {
    clock?.restore();
  });

  it('gửi lớp không gian của tầng đang mở, và chân panel hiện "Đã lưu lúc …"', async () => {
    const spied = createSpiedGateway();
    const { container } = await renderWired([WALL_ID], { gateway: spied.gateway });

    clock = installFakeClock();

    const writesBefore = spied.layerWrites.length;
    const option = within(container).getByRole('radio', {
      name: new RegExp(String(THICKNESS_AFTER_MM)),
    });

    await act(async () => {
      fireEvent.click(option);
      await clock.flushMicrotasks();
    });

    await act(async () => {
      await clock.runAllTimers();
      await clock.flushMicrotasks();
    });

    const sent = spied.layerWrites.slice(writesBefore);
    const lastLayer = sent.at(-1);
    const caption = container.textContent ?? '';
    const savedLabel = (caption.match(/Đã lưu lúc \d{2}:\d{2}/) ?? [''])[0];

    console.log(
      '[PROPERTY-INSPECTOR][N9] sau một lượt ghi và hết cửa sổ im lặng của A7 ' +
        '(hằng số nằm trong createAutosave, không viết lại ở đây): ' +
        `${String(sent.length)} lượt gọi spatial.writeLayer; thân yêu cầu cuối mang ` +
        `${String(lastLayer?.walls.length ?? 0)} tường · ${String(lastLayer?.openings.length ?? 0)} ô mở · ` +
        `${String(lastLayer?.rooms.length ?? 0)} phòng · ${String(lastLayer?.furniture.length ?? 0)} nội thất ` +
        `của tầng ${sampleLevelId(0)}.`,
    );
    console.log(`[PROPERTY-INSPECTOR][N9] chỉ báo lưu ở chân panel: "${savedLabel}"`);

    expect(sent.length).toBeGreaterThanOrEqual(1);
    expect(lastLayer?.walls.length ?? 0).toBeGreaterThan(0);
    expect(savedLabel).toMatch(/^Đã lưu lúc \d{2}:\d{2}$/);
  });

  it('nút "khuôn" ở đầu panel gửi một khuôn mẫu thật, và panel nói ra kết quả', async () => {
    const spied = createSpiedGateway();
    const { container } = await renderWired([WALL_ID], { gateway: spied.gateway });

    const templateButton = within(container).getByRole('button', {
      name: COPY_AS_TEMPLATE_LABEL,
    });

    await act(async () => {
      fireEvent.click(templateButton);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(spied.templateWrites.length).toBeGreaterThan(0);
    });

    const draft = spied.templateWrites.at(-1);
    const notice = (container.textContent ?? '').match(/Đã lưu khuôn mẫu "[^"]*"[^.]*\./);

    console.log(
      `[PROPERTY-INSPECTOR][N9b] nút "khuôn" ⇒ ${String(spied.templateWrites.length)} lượt gọi ` +
        `propertyTemplates.create; loại đối tượng = "${String(draft?.objectKind)}", ` +
        `tên = "${String(draft?.name)}", số trường mang theo = ` +
        `${String(Object.keys(draft?.fields ?? {}).length)}.`,
    );
    console.log(`[PROPERTY-INSPECTOR][N9b] câu panel nói ra: "${String(notice?.[0])}"`);

    expect(draft?.objectKind).toBe('wall');
    expect(notice).not.toBeNull();
  });
});
