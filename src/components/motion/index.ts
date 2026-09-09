/**
 * Chỗ duy nhất trong sản phẩm được nhập `framer-motion` (R-39).
 *
 * ## Vì sao phải có một cửa duy nhất
 *
 * Trước module này, 16 file component nhập thẳng `motion` và `AnimatePresence`
 * từ `framer-motion`. Mỗi file tự quyết có tôn trọng "giảm chuyển động" của hệ
 * điều hành hay không, và 11 trong 16 file KHÔNG. Người bật thiết lập đó vì
 * chuyển động làm họ chóng mặt hoặc buồn nôn vẫn nhận đủ hoạt ảnh từ 11 chỗ ấy.
 *
 * Không có cách nào bắt được lỗ hổng đó bằng cách đọc từng file: nó là chuyện
 * THIẾU một lời gọi, và thứ thiếu thì không hiện ra trong diff. Nên nó được đóng
 * bằng cấu trúc — một cửa, và một luật ESLint canh cửa.
 *
 * ## Vì sao ở `src/components` chứ không phải `src/lib/motion`
 *
 * `RULE.md` R-39 và mục 2 của `BAO_CAO_DO_LECH.md` đều viết rằng
 * `src/lib/motion/index.ts` phải tái xuất ba tên này. **Không làm được**, và lý
 * do đáng ghi lại:
 *
 * - `framer-motion` nhập React. `src/lib/**` TUYỆT ĐỐI không được import React —
 *   ranh giới ở CLAUDE.md mục 0.4, ép bằng `no-restricted-imports`, và chính
 *   `src/lib/motion/index.ts` mở đầu bằng câu "Nothing in this folder imports
 *   React". Tái xuất từ đó sẽ kéo React vào 36 nơi đang nhập barrel ấy, trong đó
 *   có mã chạy trong worker (`src/lib/three/build/buildQueue.ts`,
 *   `src/lib/export/exportGlb.ts`).
 * - Thứ thật sự đóng lỗ hổng là `useReducedMotion`, mà đó là một HOOK. Hook
 *   không sống được trong `src/lib` vì lý do trên. Cửa phải nằm ở tầng React.
 *
 * `src/lib/motion` vẫn là nguồn duy nhất của thang thời lượng và đường cong —
 * module này không nói gì về chúng, nó chỉ dựng cổng cho thư viện hoạt ảnh.
 *
 * ## Cách dùng
 *
 * ```tsx
 * import { motion, AnimatePresence } from '@/components/motion';
 * ```
 *
 * và bọc vỏ ứng dụng đúng một lần bằng {@link MotionProvider}.
 */
import { createElement, type ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'framer-motion';

/**
 * `m`, xuất ra dưới tên `motion` — cùng một API, ít hơn ~10 KiB mỗi route.
 *
 * `motion` của framer-motion là một **proxy**: chạm `motion.div` là kéo theo cả
 * nhà máy dựng component cho MỌI thẻ HTML/SVG cộng toàn bộ tính năng, và
 * rollup không rung bớt được vì proxy đọc thuộc tính lúc chạy. `m` là đúng cùng
 * component ấy nhưng KHÔNG mang tính năng theo mình — tính năng do
 * {@link MotionProvider} nạp một lần qua `LazyMotion` bên dưới.
 *
 * Đổi tên khi tái xuất là có chủ ý: R-39 bắt mọi nơi dùng hoạt ảnh phải đi qua
 * đúng cửa này, nên đổi được cả ứng dụng sang `m` mà **không sửa một nơi gọi
 * nào** — 25 màn và 9 component dùng chung vẫn viết `motion.div` như cũ. Đó
 * chính là khoản lãi mà luật một-cửa được dựng ra để có.
 *
 * Số đo thật nằm ở `MotionProvider` bên dưới và ở `./features`.
 */
export { m as motion, AnimatePresence, useAnimation } from 'framer-motion';

export interface MotionProviderProps {
  readonly children: ReactNode;
}

/**
 * Bật "giảm chuyển động" cho MỌI hoạt ảnh của framer-motion, ở một chỗ.
 *
 * `reducedMotion="user"` bảo framer-motion đọc `prefers-reduced-motion` của hệ
 * điều hành và tự bỏ mọi hoạt ảnh biến đổi vị trí — giữ lại opacity, thứ không
 * gây chóng mặt. Đặt ở đây thay vì để từng component tự hỏi `useReducedMotion()`
 * vì một component QUÊN hỏi là một lỗ hổng không nhìn thấy được, còn một provider
 * thiếu thì cả ứng dụng hết hoạt ảnh — hỏng rõ ràng, sửa ngay.
 *
 * Năm component đã tự gọi `useReducedMotion` từ trước vẫn giữ nguyên: chúng dùng
 * nó để quyết những thứ framer-motion không biết, như chọn thời lượng nào trong
 * thang hay có dựng hẳn một cây khác hay không.
 *
 * Không viết bằng JSX để file này ở lại `.ts`: mọi `.tsx` trong `src/components`
 * đều phải có story đi kèm theo R-50, mà một provider không vẽ gì thì không có
 * gì để kể trong story.
 *
 * ## `LazyMotion` nạp tính năng bằng `import()`, không nhập tĩnh
 *
 * `m` không mang tính năng theo mình; `LazyMotion` cấp chúng một lần cho cả cây.
 * Gói tính năng nằm ở `./features` và được nạp **động** — lý do đầy đủ, kèm số
 * đo của lần chọn sai, viết trong chính file đó. Tóm tắt: nhập tĩnh `domMax` ở
 * đây đẩy cả gói vào chunk khởi động và làm hỏng hai cổng khác.
 *
 * Cái giá của nạp động: trong khoảng vài chục mili giây đầu, `m` dựng ra phần
 * tử **tĩnh** — hoạt ảnh đầu tiên ngay lúc mở ứng dụng có thể không chạy. Đổi
 * lại là ~35 KiB mỗi màn. Với một sản phẩm mà A11 đã bắt mọi hoạt ảnh phải bỏ
 * được, mất một lượt hoạt ảnh mở màn là cái giá đúng để trả.
 *
 * `strict` để mặc định (tắt): bật lên thì mọi `motion.*` còn sót thành lỗi lúc
 * chạy, mà cửa này đã tái xuất `m` dưới tên `motion` nên không nơi nào còn dùng
 * proxy thật — không có gì để bắt, chỉ thêm một cách làm sập ứng dụng.
 */
export function MotionProvider({ children }: MotionProviderProps): ReactNode {
  return createElement(
    LazyMotion,
    { features: () => import('./features').then((module) => module.default) },
    createElement(MotionConfig, { reducedMotion: 'user' }, children),
  );
}
