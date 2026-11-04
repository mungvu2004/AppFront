/**
 * Tường kính không đổ bóng đặc xuống sàn: `castShadow` của mesh tường theo `wallCastsShadow`
 * (`src/pascal-page/realism/daylight.ts`). `node` là prop của renderer nên đổi vật liệu thì cờ đổi theo.
 * Tường kính không vào `wall-batch` (lô chỉ nhận vật liệu đục) nên cờ trên mesh có tác dụng.
 */
export const RULES = {
  'nodes/src/wall/renderer.tsx': [
    [
      "import { type ComponentProps, useEffect, useLayoutEffect, useMemo, useRef } from 'react'",
      "import { wallCastsShadow } from '@pascal-realism/daylight'\nimport { type ComponentProps, useEffect, useLayoutEffect, useMemo, useRef } from 'react'",
    ],
    ["      castShadow={node.wallType !== 'curtain'}\n", '      castShadow={wallCastsShadow(node)}\n'],
  ],
};
