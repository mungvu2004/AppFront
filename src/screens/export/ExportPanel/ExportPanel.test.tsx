/**
 * Bộ kiểm của L2-C cho màn `ExportPanel` — bảy trạng thái, cộng mười điều cấm
 * của đặc tả gốc.
 *
 * ## Vì sao nhiều import ở đây đi qua `import()` thay vì `import … from …`
 *
 * `./ExportPanel` (view) và `./useExportPanel` (hook) là việc của hai worker
 * khác, viết SONG SONG với worker này trên nhánh riêng — tại thời điểm file này
 * được viết, CẢ HAI CHƯA TỒN TẠI trong worktree này. Đã đo thật ở
 * `RuleReport.test.tsx`/`RuleSettings.test.tsx`: một `import` TĨNH của một chuỗi
 * không tồn tại làm Vite sập lúc transform và không một test nào trong cả file
 * chạy được. Giấu đường dẫn sau một biến, kèm `/* @vite-ignore *\/`, hoãn việc
 * phân giải sang đúng lúc CHẠY, nên một import hỏng chỉ làm hỏng ĐÚNG một `it`.
 *
 * Mọi test ở đây cần `./ExportPanel` thật nên HỎNG RIÊNG LẺ với "Failed to
 * resolve" cho tới khi lớp gộp ghép đủ view + hook — ĐIỀU ĐÓ LÀ BÌNH THƯỜNG ở
 * lớp này, không phải lỗi của L2-C.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';

import {
  buildExportPanelProps,
  buildSampleExportedFile,
  buildSampleProgress,
  DEFAULT_FORMATS,
  DEFAULT_OPTIONS,
  FIXED_EXPORT_CAPABILITIES,
  floorsWithOneUnapproved,
  formatsSelecting,
} from './exportPanelFixtures';
import { EXPORT_FORMAT_IDS } from './types';
import type { ExportPanelProps } from './types';

afterEach(() => {
  cleanup();
});

/* ==========================================================================
 * 0. Hạ tầng: nhập file cùng thư mục qua biến, không qua chuỗi tĩnh.
 * ========================================================================== */

/** Xem lời giải thích ở đầu file. */
async function importFromScreen<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

async function loadExportPanelView(): Promise<ComponentType<ExportPanelProps>> {
  const mod = await importFromScreen<{ ExportPanel: ComponentType<ExportPanelProps> }>('./ExportPanel');

  return mod.ExportPanel;
}

/* ==========================================================================
 * A. Bảy trạng thái (A11).
 * ========================================================================== */

describe('A11 — bảy trạng thái của ExportPanel', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', async () => {
    const ExportPanelView = await loadExportPanelView();
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<ExportPanelView {...buildExportPanelProps(scenario.state)} />);
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* ==========================================================================
 * B. Tiếp cận được, toàn chữ tiếng Việt có dấu, không mã màu thô (R-72).
 * ========================================================================== */

describe('R-72 — expectAccessible và expectVietnamese trên cây render thật', () => {
  it('trạng thái "success" tiếp cận được và toàn chữ tiếng Việt có dấu', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success');
    const { container } = render(<ExportPanelView {...props} />);

    // Ba ngoại lệ, không cái nào là chữ của màn — cùng lý do và cùng cách neo
    // như `RuleReport.test.tsx:496`:
    //
    // - `Level 0`…`Level 3` là TÊN TẦNG đọc nguyên văn từ đồ thị. Bộ mẫu chuẩn
    //   sinh tên tầng bằng tiếng Anh (`sampleBuilding.ts:85`); màn không được
    //   tự đặt lại tên tầng, y như nó không được viết lại tên phòng. Dữ liệu
    //   thật có tên tiếng Việt thì màn hiện tiếng Việt.
    // - Tên tệp đã xuất là một TÊN TỆP: nó không dấu vì hệ tệp, không vì ai
    //   quên bỏ dấu. Neo đúng chuỗi đó, không nới rộng.
    // - `glb` là mã định dạng, đúng loại với `pdf`/`png`/`json` mà
    //   `expectVietnamese` đã nhận sẵn; danh sách của nó chỉ thiếu đúng cái
    //   này, và `src/lib/**` nằm ngoài phạm vi sửa của lượt gộp (R-68). Đây là
    //   cửa `allowWords` mở sẵn cho ca "một đơn vị module chưa nghe tên".
    expectVietnamese(container, {
      allowWords: ['glb'],
      ignore: [/^Level \d+$/u, buildSampleExportedFile().fileName],
    });
    expectAccessible(container);
  });
});

describe('không một mã màu thô nào trong cả thư mục màn (bao gồm chính test này)', () => {
  it('expectNoRawColor("src/screens/export/ExportPanel") không ném lỗi', () => {
    expect(() => {
      expectNoRawColor('src/screens/export/ExportPanel');
    }).not.toThrow();
  });
});

/* ==========================================================================
 * C. Đúng bốn định dạng — không IFC, không OBJ, ở bất kỳ đâu.
 * ========================================================================== */

describe('bốn định dạng, đúng bốn — không có định dạng thứ năm nào', () => {
  it('EXPORT_FORMAT_IDS và DEFAULT_FORMATS đều có đúng 4 phần tử', () => {
    expect(EXPORT_FORMAT_IDS).toHaveLength(4);
    expect(DEFAULT_FORMATS).toHaveLength(4);
  });

  it('cả bốn nhãn phần mở rộng hiện đúng một lần mỗi cái, ở trạng thái "success"', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success');
    render(<ExportPanelView {...props} />);

    for (const format of DEFAULT_FORMATS) {
      expect(screen.getAllByText(format.extensionLabel)).toHaveLength(1);
    }
  });

  it('không có ".ifc" và không có ".obj" ở bất kỳ đâu trong cây đã render', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success');
    const { container } = render(<ExportPanelView {...props} />);

    expect(container.innerHTML).not.toMatch(/\.ifc\b/iu);
    expect(container.innerHTML).not.toMatch(/\.obj\b/iu);
  });
});

/* ==========================================================================
 * D. Khối "Kiểm tra trước khi xuất" — CHỈ THÔNG TIN, KHÔNG BAO GIỜ CHẶN.
 * ========================================================================== */

describe('khối kiểm tra trước khi xuất không bao giờ chặn nút "Xuất"', () => {
  it('còn vi phạm chưa xử lý: nút "Xuất" vẫn bấm được, câu nhắc vẫn hiện', async () => {
    const ExportPanelView = await loadExportPanelView();
    // Mặc định của trạng thái "success" đã dùng buildPreflightWithViolations().
    const props = buildExportPanelProps('success');
    const { container } = render(<ExportPanelView {...props} />);

    const exportButtons = screen.getAllByRole('button', { name: /xuất/i });

    expect(exportButtons.length).toBeGreaterThan(0);
    for (const button of exportButtons) {
      expect(button).not.toBeDisabled();
    }

    expect(container.textContent).toMatch(/Còn \d+ vi phạm chưa xử lý\./u);
  });
});

/* ==========================================================================
 * E. Tầng chưa duyệt vẫn chọn được, mang caption cần chú ý.
 * ========================================================================== */

describe('tầng chưa duyệt vẫn chọn được', () => {
  it('tầng isApproved=false vẫn có điều khiển bấm được, gọi đúng onToggleFloor, và mang caption cần chú ý', async () => {
    const ExportPanelView = await loadExportPanelView();
    const floors = floorsWithOneUnapproved();
    const unapproved = floors[0];

    if (unapproved === undefined) {
      throw new Error('floorsWithOneUnapproved() trả về mảng rỗng — fixture lỗi');
    }

    expect(unapproved.isApproved).toBe(false);
    expect(unapproved.isSelected).toBe(true);

    const onToggleFloor = vi.fn();
    const props = buildExportPanelProps('success', { floors }, { onToggleFloor });
    const { container } = render(<ExportPanelView {...props} />);

    const control = screen.getByLabelText(new RegExp(unapproved.name, 'iu'));

    expect(control).not.toBeDisabled();
    fireEvent.click(control);
    expect(onToggleFloor).toHaveBeenCalledWith(unapproved.id);

    expect(container.textContent).toMatch(/chú ý/iu);
  });
});

/* ==========================================================================
 * F. Tám công năng false → giao diện tương ứng rời khỏi DOM.
 * ========================================================================== */

describe('capabilities false → giao diện tương ứng rời khỏi DOM, không giả vờ có', () => {
  it('capabilities cố định đúng tám trường, đều false', () => {
    expect(FIXED_EXPORT_CAPABILITIES).toEqual({
      canEstimateSize: false,
      canPersistHistory: false,
      canChooseUnit: false,
      canNameFloorStep: false,
      canPutDownloadInToast: false,
      canRenderPdfBytes: false,
      canCaptureImage: false,
      canIncludeAxisGrid: false,
    });
  });

  it('canEstimateSize=false: không có dòng ước tính dung lượng nào trước khi xuất', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success');
    const { container } = render(<ExportPanelView {...props} />);

    expect(container.textContent).not.toMatch(/ước tính (dung lượng|kích thước)/iu);
  });

  it('canChooseUnit=false: không có điều khiển chọn đơn vị nào', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success');
    render(<ExportPanelView {...props} />);

    expect(screen.queryByRole('combobox', { name: /đơn vị/iu })).toBeNull();
    expect(screen.queryByRole('button', { name: /đơn vị/iu })).toBeNull();
    expect(screen.queryByText(/chọn đơn vị/iu)).toBeNull();
  });

  it('canPersistHistory=false: không có điều khiển "lưu lịch sử qua lần tải lại"', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success');
    render(<ExportPanelView {...props} />);

    expect(screen.queryByText(/lưu lịch sử.*(tải lại|phiên)/iu)).toBeNull();
  });

  it('canNameFloorStep=false: bước tiến trình đang xuất không đặt tên theo từng tầng', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('partial');
    const { container } = render(<ExportPanelView {...props} />);

    expect(container.textContent).not.toMatch(/đang (gộp lưới|xử lý) tầng \d/iu);
  });

  it('canPutDownloadInToast=false: nếu có toast trên màn, toast đó không chứa nút hành động nào', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('partial');
    const { container } = render(<ExportPanelView {...props} />);

    const toastNode = container.querySelector('[role="status"], [role="alert"]');

    if (toastNode !== null) {
      expect(toastNode.querySelector('button')).toBeNull();
    }
  });

  /* ------------------------------------------------------------------------
   * Ba công năng tìm ra sau khi hợp đồng đóng băng, cùng một loại với năm cái
   * trên: một mảnh giao diện không có đích đến ở tầng logic. Ba bài dưới đây là
   * chốt chặn chống người sau lén thêm lại một điều khiển không chạy.
   * ---------------------------------------------------------------------- */

  it('canRenderPdfBytes=false: thẻ PDF vẫn ở lại và vẫn hiện số trang thật, nhưng không còn khả năng tải nào', async () => {
    const ExportPanelView = await loadExportPanelView();
    const pdfCard = DEFAULT_FORMATS.find((format) => format.id === 'pdf');

    if (pdfCard?.pageCountLabel == null) {
      throw new Error('thẻ PDF phải có pageCountLabel thật — fixture lỗi');
    }

    const props = buildExportPanelProps('success', {
      formats: formatsSelecting('pdf'),
      exportedFiles: [],
    });
    const { container } = render(<ExportPanelView {...props} />);

    // Thẻ vẫn ở lại, và con số trên nó là số thật.
    expect(screen.getAllByText('.pdf')).toHaveLength(1);
    expect(container.textContent).toContain(pdfCard.pageCountLabel);

    // Không nút xuất, không nút tải — kể cả một nút xám.
    expect(screen.queryByRole('button', { name: /xuất|tải/iu })).toBeNull();
  });

  it('canCaptureImage=false: thẻ ảnh vẫn ở lại nhưng không còn khả năng tải nào', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success', {
      formats: formatsSelecting('image'),
      exportedFiles: [],
    });

    render(<ExportPanelView {...props} />);

    expect(screen.getAllByText('.png')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /xuất|tải/iu })).toBeNull();
  });

  it('canIncludeAxisGrid=false: không có công tắc "lưới trục" nào, kể cả khi mục tuỳ chọn đã mở', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success', {
      formats: formatsSelecting('glb'),
      options: { ...DEFAULT_OPTIONS, isExpanded: true },
    });

    render(<ExportPanelView {...props} />);

    // Mục tuỳ chọn của `.glb` đang mở thật — công tắc anh em của nó vẫn ở đó.
    expect(screen.getByLabelText(/đồ nội thất/iu)).not.toBeDisabled();
    expect(screen.queryByLabelText(/lưới trục/iu)).toBeNull();
  });

  it('.glb và Spatial JSON thì NGƯỢC LẠI: khả năng xuất vẫn còn nguyên', async () => {
    const ExportPanelView = await loadExportPanelView();

    for (const id of ['glb', 'spatial-json'] as const) {
      const props = buildExportPanelProps('success', { formats: formatsSelecting(id) });
      const { unmount } = render(<ExportPanelView {...props} />);

      expect(screen.getByRole('button', { name: /^xuất$/iu })).not.toBeDisabled();
      unmount();
    }
  });
});

/* ==========================================================================
 * G. Đang xuất — tiến trình THẬT, không thanh giả.
 * ========================================================================== */

describe('đang xuất: stepLabel và countLabel thật, có nút Huỷ, không thanh tiến độ giả', () => {
  it('trạng thái "partial" (đang xuất): stepLabel + countLabel thật hiện ra, có nút Huỷ gọi được onCancel', async () => {
    const ExportPanelView = await loadExportPanelView();
    const onCancel = vi.fn();
    const progress = buildSampleProgress();
    const props = buildExportPanelProps('partial', { progress }, { onCancel });
    const { container } = render(<ExportPanelView {...props} />);

    expect(props.progress).not.toBeNull();
    expect(container.textContent).toContain(progress.stepLabel);
    expect(container.textContent).toContain(progress.countLabel);

    const cancelButton = screen.getByRole('button', { name: /huỷ/iu });

    expect(cancelButton).not.toBeDisabled();
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('progress === null (trạng thái "success"): không có thanh tiến độ nào chạy', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('success');

    expect(props.progress).toBeNull();

    const { container } = render(<ExportPanelView {...props} />);

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});

/* ==========================================================================
 * H. Lỗi — mã chữ đều, có gợi ý, thử lại giữ nguyên thiết lập.
 * ========================================================================== */

describe('trạng thái "error": mã lỗi chữ đều, có gợi ý, thử lại giữ nguyên thiết lập', () => {
  it('có code chữ đều và hint hiện trong DOM', async () => {
    const ExportPanelView = await loadExportPanelView();
    const props = buildExportPanelProps('error');

    if (props.error === null) {
      throw new Error('trạng thái "error" phải có props.error khác null');
    }

    expect(props.error.code).toBe(props.error.code.toUpperCase());

    const { container } = render(<ExportPanelView {...props} />);

    expect(container.textContent).toContain(props.error.code);
    expect(container.textContent).toContain(props.error.hint);
  });

  it('bấm nút thử lại gọi onRetry, KHÔNG gọi onChangeOptions — thiết lập giữ nguyên', async () => {
    const ExportPanelView = await loadExportPanelView();
    const onRetry = vi.fn();
    const onChangeOptions = vi.fn();
    const props = buildExportPanelProps('error', {}, { onRetry, onChangeOptions });

    render(<ExportPanelView {...props} />);

    const retryButton = screen.getByRole('button', { name: /thử lại/iu });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onChangeOptions).not.toHaveBeenCalled();
  });
});
