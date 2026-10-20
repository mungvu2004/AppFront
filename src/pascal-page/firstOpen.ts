/**
 * Gieo dáng mở đầu (tô `rendered`, chủ đề tối) cho lần mở đầu tiên. Phải chạy trước khi React
 * vẽ: `<Viewer>` đọc `shadingByContext` lúc gắn. Thân ở `./applyFirstOpenLook`.
 */
import { useViewer } from '@pascal-app/viewer';

import { applyFirstOpenLook } from './applyFirstOpenLook';

applyFirstOpenLook(useViewer, () => window.localStorage);
