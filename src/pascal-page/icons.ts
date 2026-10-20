/**
 * Nạp sẵn các icon Iconify mà Pascal dùng. `@iconify/react` được alias sang bản `offline`
 * (vite.pascal.config.ts) nên không bao giờ gọi `api.iconify.design`; icon thiếu ở đây sẽ trống.
 * Thêm icon: `node scripts/gen-pascal-icons.mjs`.
 */
import { addCollection, type IconifyJSON } from '@iconify/react';

import sets from './pascal-icons.json';

// JSON do gen-pascal-icons.mjs ghi thẳng từ API Iconify; TS suy kiểu từng khoá nên phải ép.
for (const set of sets as unknown as readonly IconifyJSON[]) addCollection(set);
