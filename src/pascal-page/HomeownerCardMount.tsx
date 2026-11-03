/**
 * Ráp `HomeownerCard` với store Pascal thật. Tách riêng để test của thẻ không nhập `@pascal-app/*`
 * (vitest không nạp được gói chưa dựng) — `main.tsx` chỉ thêm một import + một dòng render.
 */
import { useInteractive, useScene } from '@pascal-app/core';
import { runUndo, useEditor } from '@pascal-app/editor';
import { useViewer } from '@pascal-app/viewer';
import type { ReactNode } from 'react';

import { HomeownerCard, type HomeownerCardStores } from './HomeownerCard';

// Kiểu store Pascal chặt hơn kiểu lỏng của thẻ (id nhãn, node hợp) — ráp ở đây như `SwapModelCard` trong main.tsx.
const stores = {
  useViewer,
  useScene,
  useEditor,
  undo: () => void runUndo(),
  forgetDoorOpenState: (id: string) => useInteractive.getState().removeDoorOpenState(id as never),
} as unknown as HomeownerCardStores;

export function HomeownerCardMount({ readOnly, extra }: { readonly readOnly: boolean; readonly extra?: ReactNode }) {
  return <HomeownerCard extra={extra} readOnly={readOnly} stores={stores} />;
}
