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
import { clearPascalScene, type PascalSceneCensus } from './pascalScene';

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
  /** Số node vào store và số node store dọn đi — xem `PascalFrameProps.onSceneLoaded`. */
  readonly onSceneLoaded?: (census: PascalSceneCensus) => void;
  /** Máy không dựng được 3D — xem `PascalFrameProps.onRendererUnavailable`. */
  readonly onRendererUnavailable?: () => void;
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
          onSceneLoaded={options.onSceneLoaded}
          onRendererUnavailable={options.onRendererUnavailable}
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

/**
 * Gói tự treo mình lên `window` — và đây KHÔNG phải thói quen xấu.
 *
 * Màn nạp gói này bằng một thẻ `<script src>` chứ không bằng `import()`. Lý do
 * đã đo: ở `vite dev`, một `import()` tới đường dẫn tĩnh bị bộ phân tích của
 * Vite viết lại thành `/assets/pascal/pascal-mount.js?import`, và Vite trả
 * **500** khi cố dịch một gói 14 MB đã dựng sẵn. Thẻ `<script src>` đi thẳng
 * qua tầng phục vụ tệp tĩnh, giống hệt nhau ở dev và ở bản sản phẩm.
 *
 * Vì sao không chuyển bản dựng sang IIFE cho gọn: IIFE buộc `inlineDynamicImports`,
 * tức gộp cả 251 chunk thành một tệp và người dùng tải hết mọi bộ vẽ ngay từ
 * đầu. Đo được: một cảnh AppFront chỉ cần 8 chunk bộ vẽ. Giữ ES module là giữ
 * phần chia nhỏ ấy.
 */
declare global {
  interface Window {
    __pascalMount?: { readonly mount: typeof mount };
  }
}

if (typeof window !== 'undefined') {
  window.__pascalMount = { mount };
}
