/**
 * Cửa vào trang 3D riêng (`public/editor3d.html?project=<id>`): trang chính của Pascal upstream
 * (`./upstream/page.tsx`) cộng đúng một thẻ "về dự án". Dữ liệu chỉ đi qua `./bridge`.
 */
/* eslint-disable react-refresh/only-export-components -- tệp vào của bó riêng, không có biên HMR để giữ. */
import './selfHost';
import './probe';
import './icons';
import './firstOpen';
import { acquireSceneReadOnlyLease, type SceneGraph } from '@pascal-app/core';
import { loadPlugin } from '@pascal-app/core/registry';
import { builtinPlugin } from '@pascal-app/nodes';
import { getSceneTheme, SSGI_PARAMS } from '@pascal-app/viewer';
import { type ReactNode, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import { flushAutosaves } from '@/hooks/useAutosave';

import { savePascalNow, usePascalProjectBridge } from './bridge';
import { BackToProjectCard, ProjectStepsCard } from './BackToProjectCard';
import { applyRenderLook } from './renderLook';
import { SceneStyleCard } from './SceneStyleCard';
import Home from './upstream/page';
// CSS của trang (Tailwind 4, không bọc phạm vi) — bản dựng xuất thành `/assets/pascal/style.css`.
import './pascal.css';

// Như upstream `apps/editor/lib/bootstrap.ts`, nhưng chỉ bộ node dựng sẵn — không plugin ngoài.
const builtinsLoaded = loadPlugin(builtinPlugin);
// Dáng render ấm: đè chủ đề `night` + SSGI trước khi vẽ (cả khung sửa lẫn Preview đọc chung).
applyRenderLook(getSceneTheme('night'), SSGI_PARAMS);

function Notice({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background p-6 text-center text-sm shadow-xl">
        {children}
      </div>
    </div>
  );
}

function PascalPage({ projectId }: { readonly projectId: string }) {
  const bridge = usePascalProjectBridge(projectId);
  const readOnly = bridge.status === 'ready' && bridge.readOnly;

  useEffect(() => (readOnly ? acquireSceneReadOnlyLease() : undefined), [readOnly]);

  if (bridge.status === 'loading') return <Notice>Đang mở mô hình 3D…</Notice>;
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
    <Home
      backCard={
        <>
          <BackToProjectCard href={bridge.backHref} projectName={bridge.projectName} />
          <ProjectStepsCard projectId={projectId} />
          <SceneStyleCard flushAutosaves={flushAutosaves} reload={() => window.location.reload()} saveNow={savePascalNow} />
        </>
      }
      onLoad={onLoad}
      {...(readOnly ? {} : { onSave: bridge.onSave })}
      projectId={projectId}
      projectName={bridge.projectName}
      readOnly={readOnly}
    />
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
