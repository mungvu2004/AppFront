/**
 * Cửa vào trang 3D riêng (`public/editor3d.html?project=<id>`): trang chính của Pascal upstream
 * (`./upstream/page.tsx`) cộng đúng một thẻ "về dự án". Dữ liệu chỉ đi qua `./bridge`.
 */
/* eslint-disable react-refresh/only-export-components -- tệp vào của bó riêng, không có biên HMR để giữ. */
import './selfHost';
import './probe';
import './icons';
import './firstOpen';
import { acquireSceneReadOnlyLease, pauseSceneHistory, resumeSceneHistory, type SceneGraph, useScene } from '@pascal-app/core';
import { CATALOG_ITEMS } from '@pascal-app/editor';
import { loadPlugin } from '@pascal-app/core/registry';
import { builtinPlugin } from '@pascal-app/nodes';
import { getSceneTheme, SSGI_PARAMS, useViewer } from '@pascal-app/viewer';
import { type ReactNode, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import { flushAutosaves } from '@/hooks/useAutosave';
import { setRealismModels } from '@/lib/pascal/furnitureCatalog';
import { getFeatureFlagsSnapshot } from '@/lib/telemetry/flags';

import { savePascalNow, usePascalProjectBridge } from './bridge';
import { BackToProjectCard, ProjectStepsCard } from './BackToProjectCard';
import { syncChromeTheme } from './chromeTheme';
import { LightingCard } from './LightingCard';
import { realismFlagsFrom, useRealism } from './realism/store';
import { setDetailsEnabled } from './realism/details';
import { applyDayLook, applyRenderLook, DAY_THEME_ID } from './renderLook';
import { SceneStyleCard } from './SceneStyleCard';
import { SwapModelCard } from './SwapModelCard';
import { PascalTour } from './tour/PascalTour';
import Home from './upstream/page';
// CSS của trang (Tailwind 4, không bọc phạm vi) — bản dựng xuất thành `/assets/pascal/style.css`.
import './pascal.css';
import './pascal-theme.css';
import './pascal-panels.css';
import './pascal-chrome.css';

// Như upstream `apps/editor/lib/bootstrap.ts`, nhưng chỉ bộ node dựng sẵn — không plugin ngoài.
const builtinsLoaded = loadPlugin(builtinPlugin);
// Dáng render ấm: đè chủ đề `night` + SSGI trước khi vẽ (cả khung sửa lẫn Preview đọc chung).
applyRenderLook(getSceneTheme('night'), SSGI_PARAMS);
// "Ban ngày" của thẻ Ánh sáng: đè chủ đề sáng `studio` cùng cách.
applyDayLook(getSceneTheme(DAY_THEME_ID));
// editor-realism: cờ `viewer.realism-*` → store (đọc một lần lúc mở trang: mặc định + override dev).
// eslint-disable-next-line local/no-direct-set -- store cờ realism riêng của trang Pascal (không phải store dự án), nạp một lần lúc mở trang.
useRealism.setState({ flags: realismFlagsFrom(getFeatureFlagsSnapshot().values) });
// R6: phào chân ngoài dựng lại trong `toPascalScene` mỗi lần nạp nên bền qua tải lại; fascia/gutter chỉ mái vẽ mới (mái chưa lưu về BE).
setDetailsEnabled(useRealism.getState().flags.details);
// B1 (bước 2): sofa/ghế bành/ghế ăn → mẫu Poly Haven `-ph` khi bật cờ materials (furnitureCatalog.ts).
setRealismModels(useRealism.getState().flags.materials);
// Backend thật (vendor ghi sau khi renderer init) khác phép thử `navigator.gpu` → đè lại số đèn.
// ponytail: đè tại chỗ, đèn đã vẽ chỉ đổi ở lượt dựng lại kế tiếp (đổi chủ đề/tải lại); GĐ3 nếu cần tức thì.
useRealism.subscribe((state, prev) => {
  if (state.backend === prev.backend) return;
  applyRenderLook(getSceneTheme('night'), SSGI_PARAMS);
  applyDayLook(getSceneTheme(DAY_THEME_ID));
});
// Áo trang theo sáng/tối của AppFront (`app-theme-mode`), trước lượt vẽ đầu.
syncChromeTheme();

function Notice({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background p-6 text-center text-sm shadow-xl">
        {children}
      </div>
    </div>
  );
}

/** Màn tải: hai bước (tải mô hình đang chạy, dựng cảnh chờ), chỉ báo nhấp nháy opacity (không chuyển vị). */
function LoadingNotice() {
  return (
    <Notice>
      <div aria-live="polite" role="status">
        <p className="font-medium">Đang mở mô hình 3D…</p>
        <ol className="mx-auto mt-4 flex w-fit flex-col gap-2 text-left text-[var(--pa-text-2)]">
          <li className="flex items-center gap-2 text-[var(--pa-text)]">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[var(--pa-accent)]" />
            Tải mô hình
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full border border-[var(--pa-border)]" />
            Dựng cảnh
          </li>
        </ol>
      </div>
    </Notice>
  );
}

/* Lượt sửa bị từ chối → đặt lại cảnh từ kho mà KHÔNG ghi bước hoàn tác và không xoá lịch sử
   (khác `applySceneGraphToEditor`): Ctrl+Z ngay sau đó về đúng cảnh trước lượt bị từ chối (no-op). */
const applyRejectedRevert = (scene: unknown) => {
  const { nodes, rootNodeIds, collections, materials } = scene as SceneGraph;
  pauseSceneHistory(useScene);
  try {
    useScene.getState().setScene(nodes as never, rootNodeIds as never, { collections, materials } as never);
  } finally {
    resumeSceneHistory(useScene);
  }
};

function PascalPage({ projectId }: { readonly projectId: string }) {
  const bridge = usePascalProjectBridge(projectId, applyRejectedRevert);
  const readOnly = bridge.status === 'ready' && bridge.readOnly;

  useEffect(() => (readOnly ? acquireSceneReadOnlyLease() : undefined), [readOnly]);

  if (bridge.status === 'loading') return <LoadingNotice />;
  if (bridge.status === 'error') {
    return (
      <Notice>
        <p className="text-muted-foreground">{bridge.error ?? 'Không mở được mô hình 3D.'}</p>
        <a className="mt-4 inline-block rounded-md border border-border bg-accent px-3 py-2 font-medium" href={bridge.backHref}>
          Về dự án
        </a>
      </Notice>
    );
  }

  // Cầu khai kiểu lỏng (`PascalSceneGraph`, `unknown`) để không nhập Pascal; ở đây là chỗ ráp với `SceneGraph`.
  const onLoad = bridge.onLoad as unknown as () => Promise<SceneGraph>;
  return (
    <>
    <Home
      backCard={
        <>
          <BackToProjectCard href={bridge.backHref} projectName={bridge.projectName} save={bridge.save} />
          <ProjectStepsCard projectId={projectId} />
          {/* UI-1023 V-01: các chỉnh cảnh là một cụm liền khối (pascal-chrome.css `[data-appfront-cluster]`). */}
          <div aria-label="Cảnh" className="inline-flex shrink-0 items-center" data-appfront-cluster="" role="group">
            <SceneStyleCard flushAutosaves={flushAutosaves} reload={() => window.location.reload()} saveNow={savePascalNow} />
            <LightingCard projectId={projectId} useViewer={useViewer} />
            <SwapModelCard catalog={CATALOG_ITEMS} readOnly={readOnly} stores={{ useScene, useViewer }} />
          </div>
        </>
      }
      onLoad={onLoad}
      {...(readOnly ? {} : { onSave: bridge.onSave })}
      projectId={projectId}
      projectName={bridge.projectName}
      readOnly={readOnly}
    />
    <PascalTour />
    </>
  );
}

const root = createRoot(document.getElementById('root') as HTMLElement);
const projectId = new URLSearchParams(window.location.search).get('project');

void builtinsLoaded.then(() =>
  root.render(
    <StrictMode>
      {projectId ? (
        <PascalPage projectId={projectId} />
      ) : (
        <Notice>
          <p>Thiếu mã dự án trong đường dẫn.</p>
          <a className="mt-4 inline-block font-medium underline" href="/">
            Về trang chính
          </a>
        </Notice>
      )}
    </StrictMode>,
  ),
);
