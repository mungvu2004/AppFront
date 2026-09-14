/**
 * Bộ kiểm của S-36 — màn xem Spatial JSON.
 *
 * Bốn nhóm: hàm thuần của model · bộ số mẫu chuẩn đo lại · bảy trạng thái và
 * khả năng tiếp cận · hành vi của hook.
 *
 * ## Vì sao có một nhóm chỉ để ĐO bộ mẫu chuẩn
 *
 * Ba tài liệu nói ba kiểu về bộ mẫu (mục Đ11 của `BAO_CAO_DOI_CHIEU_v2.3.md`):
 * bộ prompt ghi "21 đối tượng gồm 9 cửa + 7 cửa sổ + 5 nội thất", `CLAUDE.md`
 * A14 ghi "16 ô mở, 21 đồ đạc". Cách duy nhất để chốt là **đo chính fixture**,
 * và ghim số đo lại bằng một bài kiểm — để lần sau không ai phải đoán nữa.
 */

import { cleanup, fireEvent, renderHook, screen, within, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SAMPLE_AXIS_COUNT,
  SAMPLE_DIMENSION_COUNT,
  SAMPLE_DOOR_COUNT,
  SAMPLE_FURNITURE_COUNT,
  SAMPLE_LEVEL_COUNT,
  SAMPLE_ROOM_COUNT,
  SAMPLE_WALL_COUNT,
  SAMPLE_WINDOW_COUNT,
  createSampleBuilding,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';

import { SpatialJsonTree } from './SpatialJsonTree';
import { SpatialJsonViewer } from './SpatialJsonViewer';
import {
  ancestorsOf,
  countEntities,
  describeCounts,
  findMatches,
  flattenJson,
  summariseValidity,
  toRawText,
  tokenizeJsonLine,
  visibleNodes,
} from './spatialJsonModel';
import { buildSpatialJsonViewerProps } from './spatialJsonViewerFixtures';
import { useSpatialJsonViewer } from './useSpatialJsonViewer';

afterEach(() => {
  cleanup();
});

const GRAPH = createSampleBuilding();

/* -------------------------------------------------------------------------- */
/* 1. Hàm thuần của model.                                                     */
/* -------------------------------------------------------------------------- */

describe('spatialJsonModel', () => {
  it('suy ra tổ tiên từ chính đường dẫn, cả khoá lẫn chỉ số mảng', () => {
    expect(ancestorsOf('walls[3].centreline.start.x')).toEqual([
      'walls[3].centreline.start',
      'walls[3].centreline',
      'walls[3]',
      'walls',
    ]);
  });

  it('hàng gốc không có tổ tiên nào', () => {
    expect(ancestorsOf('walls')).toEqual([]);
  });

  /**
   * So theo TẬP, không theo thứ tự.
   *
   * Thứ tự hàng gốc là thứ tự khoá của chính đối tượng, và đó cũng là thứ tự
   * `JSON.stringify` sinh ra — nên cây và chữ thô luôn khớp nhau. Ghim một thứ
   * tự cụ thể vào bài kiểm là ghim một chi tiết của fixture, không phải một lời
   * hứa của màn.
   */
  it('dàn phẳng đủ mọi khoá gốc của đồ thị', () => {
    const nodes = flattenJson(GRAPH);
    const roots = nodes.filter((node) => node.depth === 0).map((node) => node.label);

    expect([...roots].sort()).toEqual(
      [
        'axes',
        'building',
        'dimensions',
        'furniture',
        'levels',
        'notes',
        'openings',
        'rooms',
        'walls',
      ].sort(),
    );
  });

  it('thứ tự hàng gốc trùng thứ tự khoá của chữ thô', () => {
    const roots = flattenJson(GRAPH)
      .filter((node) => node.depth === 0)
      .map((node) => node.label);

    expect(roots).toEqual(Object.keys(GRAPH));
  });

  it('chỉ hiện hàng con khi MỌI tổ tiên đang mở', () => {
    const nodes = flattenJson(GRAPH);
    const closed = visibleNodes(nodes, new Set(), new Set());
    const opened = visibleNodes(nodes, new Set(['walls']), new Set());

    expect(closed.every((node) => node.depth === 0)).toBe(true);
    expect(opened.filter((node) => node.depth === 1)).toHaveLength(SAMPLE_WALL_COUNT);
  });

  it('gắn mã thực thể vào hàng của một phần tử có id', () => {
    const nodes = flattenJson(GRAPH);
    const firstWall = nodes.find((node) => node.id === 'walls[0]');

    expect(firstWall?.entityId).toBe(GRAPH.walls[0]?.id);
  });

  it('tìm theo khoá và theo giá trị, không phân biệt hoa thường', () => {
    const nodes = flattenJson(GRAPH);

    expect(findMatches(nodes, 'THICKNESSMM').length).toBe(SAMPLE_WALL_COUNT);
    expect(findMatches(nodes, '   ')).toEqual([]);
  });

  it('tách chữ thô thành đúng ba tông, khoá không bị nhận nhầm thành chuỗi', () => {
    const segments = tokenizeJsonLine('  "thicknessMm": 220,');
    const tones = segments.map((segment) => segment.tone);

    expect(tones).toContain('key');
    expect(tones).toContain('number');
    expect(tones).not.toContain('string');
  });

  it('nhận ra chuỗi là chuỗi khi nó đứng ở vế giá trị', () => {
    const segments = tokenizeJsonLine('  "name": "Phòng khách",');

    expect(segments.filter((segment) => segment.tone === 'key')).toHaveLength(1);
    expect(segments.filter((segment) => segment.tone === 'string')).toHaveLength(1);
  });

  it('boolean và null đi cùng tông với số — đúng ba tông, không phải bốn', () => {
    expect(tokenizeJsonLine('  "reviewed": true,').some((s) => s.tone === 'number')).toBe(true);
    expect(tokenizeJsonLine('  "note": null').some((s) => s.tone === 'number')).toBe(true);
  });

  it('dải kiểm tra nói "0 lỗi" khi không có lỗi nào', () => {
    const validity = summariseValidity([]);

    expect(validity.isValid).toBe(true);
    expect(validity.summary).toContain('0 lỗi');
  });

  it('đếm riêng lỗi nghiêm trọng và cảnh báo', () => {
    const validity = summariseValidity([
      { id: 'a', path: 'walls[0]', problem: 'Hỏng.', severity: 'critical' },
      { id: 'b', path: 'rooms[1]', problem: 'Cảnh báo.', severity: 'warning' },
    ]);

    expect(validity.isValid).toBe(false);
    expect(validity.criticalCount).toBe(1);
    expect(validity.warningCount).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Bộ mẫu chuẩn — ĐO, không chép.                                           */
/* -------------------------------------------------------------------------- */

describe('bộ mẫu chuẩn, đo từ chính fixture', () => {
  it('đếm ra đúng các hằng số mà fixture tự khai', () => {
    const counts = countEntities(GRAPH);

    expect(counts).toEqual({
      axes: SAMPLE_AXIS_COUNT,
      dimensions: SAMPLE_DIMENSION_COUNT,
      furniture: SAMPLE_FURNITURE_COUNT,
      levels: SAMPLE_LEVEL_COUNT,
      openings: SAMPLE_DOOR_COUNT + SAMPLE_WINDOW_COUNT,
      rooms: SAMPLE_ROOM_COUNT,
      walls: SAMPLE_WALL_COUNT,
    });
  });

  /**
   * Ghim lại lời đính chính của Đ11 — và ghim đúng phần thật sự lệch.
   *
   * Bộ prompt v2.3 mục 3.0 ghi "21 đối tượng — gồm 9 cửa đi, 7 cửa sổ, 5 nội
   * thất". Tổng 9 + 7 + 5 đúng bằng 21, nên **con số tổng thì trùng** — nhưng
   * nó trùng do trùng hợp số học, không phải do mô tả đúng: trong fixture, 21 là
   * số ĐỒ ĐẠC (không phải 5), và 9 cửa + 7 cửa sổ là **16 ô mở**, một đại lượng
   * thứ ba mà mục 3.0 không nhắc tới.
   *
   * `CLAUDE.md` A14 ("16 ô mở, 21 đồ đạc") mới là bản khớp fixture.
   */
  it('21 là số đồ đạc, còn 9 cửa + 7 cửa sổ là 16 ô mở — hai đại lượng khác nhau', () => {
    const counts = countEntities(GRAPH);

    expect(counts.furniture).toBe(21);
    expect(counts.openings).toBe(SAMPLE_DOOR_COUNT + SAMPLE_WINDOW_COUNT);
    expect(counts.openings).toBe(16);
    // Phần sai của mục 3.0: nó mô tả 21 như "5 nội thất" cộng 16 ô mở.
    expect(counts.furniture).not.toBe(5);
  });

  it('dựng câu đếm ở chân màn bằng số đo, dấu thập phân là dấu phẩy (A15)', () => {
    const label = describeCounts(countEntities(GRAPH));

    expect(label).toContain('4 tầng');
    expect(label).toContain('48 tường');
    expect(label).toContain('16 ô mở');
    expect(label).toContain('14 phòng');
  });

  it('chữ thô đi qua JSON.stringify và đọc ngược lại được đúng đồ thị', () => {
    expect(JSON.parse(toRawText(GRAPH))).toEqual(JSON.parse(JSON.stringify(GRAPH)));
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Bảy trạng thái, khả năng tiếp cận, tiếng Việt.                           */
/* -------------------------------------------------------------------------- */

describe('bảy trạng thái', () => {
  it('không trạng thái nào dựng ra màn trắng', () => {
    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <SpatialJsonViewer {...buildSpatialJsonViewerProps(scenario.state)} />,
      );

      return { container, unmount };
    }, createSevenStateScenarios());
  });

  it('trạng thái thu gọn ẩn hẳn nửa phải', () => {
    const { unmount } = renderWithProviders(
      <SpatialJsonViewer {...buildSpatialJsonViewerProps('collapsed')} />,
    );

    expect(screen.queryByRole('tablist', { name: 'Cách xem nội dung' })).toBeNull();
    expect(screen.getByRole('tree', { name: 'Cấu trúc dữ liệu không gian' })).toBeInTheDocument();

    unmount();
  });

  it('trạng thái một phần vẫn hiện dữ liệu, kèm một câu nói rõ đang làm mới', () => {
    renderWithProviders(<SpatialJsonViewer {...buildSpatialJsonViewerProps('partial')} />);

    expect(screen.getByRole('tree', { name: 'Cấu trúc dữ liệu không gian' })).toBeInTheDocument();
    expect(screen.getByText(/đang làm mới/i)).toBeInTheDocument();
  });

  /**
   * Trạng thái lỗi phải cho một đường ra DẪN ĐI ĐÂU ĐÓ.
   *
   * Không phải "thử lại" — phép dựng cây là hàm thuần của dữ liệu trong kho, nên
   * chạy lại nó trên cùng dữ liệu hỏng cho ra đúng lỗi cũ. Đường ra thật là quay
   * về màn quản lý tầng để mở lại bản vẽ.
   */
  it('trạng thái lỗi cho một đường ra dẫn về màn quản lý tầng', () => {
    const onReopenFloors = vi.fn();
    const props = buildSpatialJsonViewerProps('error');

    renderWithProviders(
      <SpatialJsonViewer model={props.model} actions={{ ...props.actions, onReopenFloors }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở lại từ quản lý tầng' }));

    expect(onReopenFloors).toHaveBeenCalledTimes(1);
  });

  it('đi qua expectAccessible ở trạng thái thành công', () => {
    const { container } = renderWithProviders(
      <SpatialJsonViewer {...buildSpatialJsonViewerProps('success')} />,
    );

    expectAccessible(container);
  });

  it('đi qua expectVietnamese ở trạng thái thành công', () => {
    const { container } = renderWithProviders(
      <SpatialJsonViewer {...buildSpatialJsonViewerProps('success')} />,
    );

    expectVietnamese(container, {
      /*
       * "Spatial JSON" là TÊN của định dạng đầu ra — chính sáu bước pipeline gọi
       * bước cuối là "Dựng Spatial JSON" (`docs/master-brief.md`). `allowWords`
       * là cửa mà `expectVietnamese` mở sẵn cho tên sản phẩm và tên định dạng.
       *
       * Khoá dữ liệu (`walls`, `openings`…) KHÔNG đi qua cửa này: chúng nằm
       * trong `<code>`, thẻ mà bộ soát cố ý không đọc, vì chúng là định danh chứ
       * không phải chuỗi giao diện.
       */
      allowWords: ['spatial', 'json'],
    });
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Màn CHỈ ĐỌC.                                                             */
/* -------------------------------------------------------------------------- */

describe('chỉ đọc', () => {
  it('ô nhập duy nhất là ô tìm kiếm', () => {
    renderWithProviders(<SpatialJsonViewer {...buildSpatialJsonViewerProps('success')} />);

    const textboxes = screen.getAllByRole('textbox');

    expect(textboxes).toHaveLength(1);
    expect(textboxes[0]).toHaveAttribute('aria-label', 'Tìm theo khoá hoặc giá trị');
  });

  it('không có nút nào sửa dữ liệu', () => {
    renderWithProviders(<SpatialJsonViewer {...buildSpatialJsonViewerProps('success')} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent ?? '').not.toMatch(/lưu|sửa|xoá|xóa/i);
      expect(button.getAttribute('aria-label') ?? '').not.toMatch(/lưu|sửa|xoá|xóa/i);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Hook.                                                                    */
/* -------------------------------------------------------------------------- */

const baseOptions = {
  canView: true,
  errorMessage: null,
  graph: GRAPH,
  isLoading: false,
  isNarrow: false,
  issues: [],
  onReopenFloors: () => undefined,
};

describe('useSpatialJsonViewer', () => {
  it('mở sẵn đúng một khoá gốc — building, tức project_metadata của đặc tả', () => {
    const { result } = renderHook(() => useSpatialJsonViewer(baseOptions));
    const [model] = result.current;
    const expanded = model.nodes.filter((node) => node.isExpanded);

    expect(expanded).toHaveLength(1);
    expect(expanded[0]?.label).toBe('building');
  });

  it('mở rộng tất cả rồi thu gọn tất cả đưa cây về đúng hai đầu', () => {
    const { result } = renderHook(() => useSpatialJsonViewer(baseOptions));

    act(() => {
      result.current[1].onExpandAll();
    });
    const afterExpand = result.current[0].nodes.length;

    act(() => {
      result.current[1].onCollapseAll();
    });
    const afterCollapse = result.current[0].nodes.length;

    expect(afterExpand).toBeGreaterThan(afterCollapse);
    expect(result.current[0].nodes.every((node) => node.depth === 0)).toBe(true);
  });

  it('tìm kiếm mở sẵn tổ tiên của kết quả, và đếm đúng số khớp', () => {
    const { result } = renderHook(() => useSpatialJsonViewer(baseOptions));

    act(() => {
      result.current[1].onSearchChange('thicknessMm');
    });

    const [model] = result.current;

    expect(model.matchLabel).toBe(`1 / ${SAMPLE_WALL_COUNT}`);
    expect(model.nodes.some((node) => node.isMatch)).toBe(true);
  });

  it('ô tìm kiếm không khớp gì thì nói 0, không giấu bộ đếm đi', () => {
    const { result } = renderHook(() => useSpatialJsonViewer(baseOptions));

    act(() => {
      result.current[1].onSearchChange('khong-co-khoa-nao-ten-nay');
    });

    expect(result.current[0].matchLabel).toBe('0 / 0');
  });

  it('chọn một nút thì mở mọi nút cha của nó', () => {
    const { result } = renderHook(() => useSpatialJsonViewer(baseOptions));

    act(() => {
      result.current[1].onSelectNode('walls[0].centreline.start');
    });

    const [model] = result.current;
    const ids = model.nodes.map((node) => node.id);

    expect(model.selectedNodeId).toBe('walls[0].centreline.start');
    expect(ids).toContain('walls[0].centreline.start');
  });

  it('không có quyền thì không rò một hàng nào, kể cả chữ thô', () => {
    const { result } = renderHook(() =>
      useSpatialJsonViewer({ ...baseOptions, canView: false }),
    );
    const [model] = result.current;

    expect(model.state).toBe('forbidden');
    expect(model.nodes).toHaveLength(0);
    expect(model.rawText).toBe('');
  });

  it('đã có dữ liệu mà vẫn đang tải là "một phần", không phải "đang tải"', () => {
    const { result } = renderHook(() => useSpatialJsonViewer({ ...baseOptions, isLoading: true }));

    expect(result.current[0].state).toBe('partial');
    expect(result.current[0].isRefreshing).toBe(true);
  });

  it('chưa có dữ liệu và đang tải là "đang tải"', () => {
    const { result } = renderHook(() =>
      useSpatialJsonViewer({ ...baseOptions, graph: null, isLoading: true }),
    );

    expect(result.current[0].state).toBe('loading');
  });

  it('không quyền che cả lỗi — thứ tự xét là nghiêm trọng giảm dần', () => {
    const { result } = renderHook(() =>
      useSpatialJsonViewer({ ...baseOptions, canView: false, errorMessage: 'Hỏng.' }),
    );

    expect(result.current[0].state).toBe('forbidden');
  });

  it('nút tải xuống chỉ có khi nơi gọi cấp đường sang S-34', () => {
    const withoutDownload = renderHook(() => useSpatialJsonViewer(baseOptions));
    const withDownload = renderHook(() =>
      useSpatialJsonViewer({ ...baseOptions, onDownload: () => undefined }),
    );

    expect(withoutDownload.result.current[0].canDownload).toBe(false);
    expect(withDownload.result.current[0].canDownload).toBe(true);
  });

  it('sao chép nhánh đưa đúng chữ thô ra ngoài, không tự chạm clipboard', () => {
    const onCopy = vi.fn();
    const { result } = renderHook(() => useSpatialJsonViewer({ ...baseOptions, onCopy }));

    act(() => {
      result.current[1].onCopyBranch();
    });

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(String(onCopy.mock.calls[0]?.[0])).toContain('"building"');
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Cây.                                                                     */
/* -------------------------------------------------------------------------- */

describe('cây cấu trúc', () => {
  it('nói ra số phần tử con của một nhánh đang gấp', () => {
    renderWithProviders(<SpatialJsonViewer {...buildSpatialJsonViewerProps('success')} />);

    const tree = screen.getByRole('tree', { name: 'Cấu trúc dữ liệu không gian' });
    const walls = within(tree)
      .getAllByRole('treeitem')
      .find((item) => item.textContent?.startsWith('walls'));

    expect(walls?.textContent).toContain(`[${SAMPLE_WALL_COUNT}]`);
  });

  /**
   * Phím mũi tên mở và thu một nhánh — A12.
   *
   * Tam giác gấp mở là hình, không phải nút, nên đây là đường bàn phím DUY NHẤT
   * tới việc mở một nhánh. Mất bài này là mất luôn khả năng duyệt cây bằng bàn
   * phím mà không ai thấy.
   */
  it('mũi tên phải mở một nhánh, mũi tên trái thu nó lại', () => {
    const onToggle = vi.fn();
    const props = buildSpatialJsonViewerProps('success');

    renderWithProviders(
      <SpatialJsonTree
        nodes={props.model.nodes}
        selectedNodeId={null}
        onToggle={onToggle}
        onSelect={() => undefined}
      />,
    );

    const rows = screen.getAllByRole('treeitem');
    const collapsed = rows.find((row) => row.getAttribute('aria-expanded') === 'false');
    const expanded = rows.find((row) => row.getAttribute('aria-expanded') === 'true');

    expect(collapsed).toBeDefined();
    expect(expanded).toBeDefined();

    fireEvent.keyDown(collapsed as HTMLElement, { key: 'ArrowRight' });
    fireEvent.keyDown(expanded as HTMLElement, { key: 'ArrowLeft' });

    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('hàng lá không nhận phím mũi tên — không có gì để mở', () => {
    const onToggle = vi.fn();
    const props = buildSpatialJsonViewerProps('success');

    renderWithProviders(
      <SpatialJsonTree
        nodes={props.model.nodes}
        selectedNodeId={null}
        onToggle={onToggle}
        onSelect={() => undefined}
      />,
    );

    const leaf = screen
      .getAllByRole('treeitem')
      .find((row) => !row.hasAttribute('aria-expanded'));

    expect(leaf).toBeDefined();
    fireEvent.keyDown(leaf as HTMLElement, { key: 'ArrowRight' });

    expect(onToggle).not.toHaveBeenCalled();
  });
});
