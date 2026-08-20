import React, { useState } from 'react';
import { DesignSystem } from './screens/DesignSystem';
import { CanvasOverlaysDemo } from './screens/CanvasOverlaysDemo';
import { DataEntryDemo } from './screens/DataEntryDemo';
import { DemoSharedControls } from './screens/DemoSharedControls';
import { FeedbackDemo } from './screens/FeedbackDemo';
import { ListReviewDemo } from './screens/ListReviewDemo';
import { MotionDemo } from './screens/MotionDemo';
import { ShellDemo } from './screens/ShellDemo';
import { StateGallery } from './screens/system/StateGallery';
import { Toast } from './components/feedback/Toast';
import { EmptyState } from './components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from './components/feedback/ScreenErrorBoundary';
import './styles/globals.css';

type ScreenId = 'design-system' | 'canvas' | 'data-entry' | 'shared' | 'feedback' | 'list-review' | 'shell' | 'motion' | 'states';

/**
 * Thứ người dùng thấy thay cho một màn đã sập.
 *
 * `ScreenErrorBoundary` cố ý không vẽ gì — nó không giữ màu, không giữ chữ. Chỗ
 * quyết định màn hỏng trông ra sao là ở đây. Chữ lấy thẳng từ `report.description`,
 * đã là tiếng Việt có dấu; nút "thử lại" chỉ hiện khi lỗi thuộc loại đáng thử lại.
 */
function ScreenCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="w-8 h-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

const screens: Record<ScreenId, { name: string; component: React.FC }> = {
  'design-system': { name: 'Design System', component: DesignSystem },
  'canvas': { name: 'Canvas & Overlays', component: CanvasOverlaysDemo },
  'data-entry': { name: 'Data Entry', component: DataEntryDemo },
  'shared': { name: 'Shared Controls', component: DemoSharedControls },
  'feedback': { name: 'Feedback & States', component: FeedbackDemo },
  'list-review': { name: 'List & Review', component: ListReviewDemo },
  'shell': { name: 'App Shell', component: ShellDemo },
  'motion': { name: 'Motion & Transitions', component: MotionDemo },
  'states': { name: 'State Gallery (QA)', component: StateGallery },
};

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('design-system');

  const ActiveComponent = screens[activeScreen].component;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-app text-text-primary font-sans">
      <div className="w-[240px] border-r border-border-default bg-bg-surface flex flex-col shrink-0">
        <div className="p-4 border-b border-border-default">
          <h1 className="text-[14px] font-semibold">Demo App</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-0.5 px-2">
          {Object.entries(screens).map(([id, screen]) => (
            <button
              key={id}
              className={`w-full text-left px-2 py-1.5 rounded-[6px] text-[14px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface ${
                activeScreen === id ? 'bg-bg-selected font-medium text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
              }`}
              onClick={() => setActiveScreen(id as ScreenId)}
            >
              {screen.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-bg-app">
        {/*
          `key={activeScreen}` để ranh giới lỗi gắn lại mỗi lần đổi màn: nếu không,
          một màn hỏng sẽ giữ trạng thái lỗi và màn được chọn tiếp theo cũng chỉ
          hiện lại phần dự phòng.

          Ranh giới nằm NGOÀI `Toast.Provider` là cố ý — màn hỏng thì kéo theo cả
          provider của nó, và phần dự phòng không được phụ thuộc vào thứ vừa sập.
        */}
        <ScreenErrorBoundary
          key={activeScreen}
          screenId={activeScreen}
          renderFallback={({ report, retry }) => (
            <ScreenCrashFallback report={report} retry={retry} />
          )}
        >
          <Toast.Provider>
            <ActiveComponent />
          </Toast.Provider>
        </ScreenErrorBoundary>
      </div>
    </div>
  );
}

