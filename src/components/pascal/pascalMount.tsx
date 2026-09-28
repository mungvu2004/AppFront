/**
 * Cửa vào của **lượt dựng thứ hai**. Không route nào được nhập tệp này.
 *
 * ## Vì sao Pascal phải dựng riêng
 *
 * Cổng "chi phí thêm cho một màn" là **280 KiB** và bản dựng hiện tại đã dùng
 * **279,6** — còn dư **0,4 KiB**. Màn Pascal nặng khoảng 1,5 MB gzip. Đưa nó vào
 * gói chính, kể cả qua `lazy()`, là làm hỏng cổng ấy gấp năm lần: cổng đo theo
 * đồ thị manifest nên một chunk route mới bị tính đủ
 * (`scripts/check-bundle-size.mjs`).
 *
 * Nên Pascal đi đường riêng: `vite.pascal.config.ts` dựng đúng tệp này thành một
 * gói độc lập trong `public/assets/pascal/`, và màn hình nạp nó lúc chạy bằng một
 * `import()` tới đường dẫn tĩnh. Bốn cổng cũ không đếm nhầm nó, theo **cấu tạo**:
 * `readAssets()` không đệ quy và lọc theo đuôi `.js`/`.css`, mà `assets/pascal` là
 * một thư mục — thư mục thì không có đuôi.
 *
 * Giá phải trả, ghi ra cho rõ: React và three **nằm hai bản** trong hai lượt dựng.
 * Đó là cái đã cân nhắc và chấp nhận khi chọn cơ chế này.
 *
 * ## Vì sao là gốc React thứ hai chứ không phải một component
 *
 * `ScreenErrorBoundary` của AppFront **không bắt được** lỗi xuyên gốc React. Nên
 * hợp đồng dưới đây nhận `onFatal`: gốc thứ hai tự báo ra, thay vì để màn hình
 * cha tưởng mọi thứ bình thường trong khi canvas đã chết.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import type { PascalScene } from '@/lib/pascal/types';

import { PascalFrame } from './PascalFrame';
import { clearPascalScene } from './pascalScene';

/** Cái người gọi cầm về, đủ để sống trọn vòng đời mà không chạm vào Pascal. */
export interface PascalMountHandle {
  /** Nạp một cảnh khác vào cùng khung đang chạy. */
  readonly setScene: (scene: PascalScene) => void;
  /** Gỡ gốc React thứ hai và trả store về rỗng. Gọi được nhiều lần. */
  readonly dispose: () => void;
}

/** Những gì màn hình cha cần nói cho khung nhúng biết. */
export interface PascalMountOptions {
  /** Cảnh đầu tiên. Đã phải đủ trường — xem `lib/pascal/__tests__/renderContract.test.ts`. */
  readonly scene: PascalScene;
  /** Cảnh đã dựng xong một khung hình thật, hoặc chưa. */
  readonly onReadyChange?: (ready: boolean) => void;
  /** Lỗi chết người ở gốc thứ hai. `ScreenErrorBoundary` không với tới đây được. */
  readonly onFatal?: (error: Error) => void;
}

/**
 * Dựng khung Pascal vào một phần tử DOM.
 *
 * Thứ tự bên trong đã đo, không đoán: bộ loại node vào registry **trước**, rồi
 * mới mount; cảnh vào store sau khi khung đã đứng. Chi tiết ở `pascalScene.ts`.
 */
export function mount(element: HTMLElement, options: PascalMountOptions): PascalMountHandle {
  const root = createRoot(element, {
    onUncaughtError: (error: unknown) => {
      options.onFatal?.(error instanceof Error ? error : new Error(String(error)));
    },
  });

  let sceneKey = 0;
  let disposed = false;

  const render = (scene: PascalScene): void => {
    sceneKey += 1;
    root.render(
      <StrictMode>
        <PascalFrame
          scene={scene}
          sceneKey={sceneKey}
          onReadyChange={options.onReadyChange}
          onFatal={options.onFatal}
        />
      </StrictMode>,
    );
  };

  render(options.scene);

  return {
    setScene: (scene) => {
      if (!disposed) render(scene);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      root.unmount();
      clearPascalScene();
    },
  };
}
