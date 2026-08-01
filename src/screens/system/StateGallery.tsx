import React, { useState } from 'react';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Skeleton } from '../../components/feedback/Skeleton';
import { DevStateSwitcher, ComponentState } from '../../components/shell/DevStateSwitcher';
import { 
  Home, Search, Table, Settings2, Box, Cuboid, 
  ShieldCheck, History, ClipboardCheck, LayoutDashboard, 
  PlaySquare, Lock, Settings, WifiOff 
} from 'lucide-react';

export function StateGallery() {
  const [globalState, setGlobalState] = useState<ComponentState>('empty');

  // The 14 Empty States
  const emptyStates = [
    { id: 1, icon: <Home />, title: 'Trang chủ', desc: 'Chưa có dữ liệu trang chủ.' },
    { id: 2, icon: <Search />, title: 'Search rỗng', desc: 'Không tìm thấy kết quả phù hợp.' },
    { id: 3, icon: <Table />, title: 'Table rỗng', desc: 'Bảng dữ liệu chưa có dòng nào.' },
    { id: 4, icon: <Settings2 />, title: 'Property rỗng', desc: 'Chưa chọn đối tượng nào.' },
    { id: 5, icon: <Box />, title: 'Canvas 2D rỗng', desc: 'Bản vẽ 2D trống.' },
    { id: 6, icon: <Cuboid />, title: 'Canvas 3D rỗng', desc: 'Không gian 3D trống.' },
    { id: 7, icon: <ShieldCheck />, title: 'QC an toàn', desc: 'Không phát hiện lỗi an toàn.' },
    { id: 8, icon: <History />, title: 'Lịch sử rỗng', desc: 'Chưa có lịch sử thay đổi.' },
    { id: 9, icon: <ClipboardCheck />, title: 'Review rỗng', desc: 'Chưa có review nào.' },
    { id: 10, icon: <LayoutDashboard />, title: 'Dashboard rỗng', desc: 'Dashboard chưa có widget.' },
    { id: 11, icon: <PlaySquare />, title: 'Pipeline trống', desc: 'Chưa chạy pipeline lần nào.' },
    { id: 12, icon: <Lock />, title: 'Truy cập từ chối', desc: 'Bạn không có quyền xem trang này.' },
    { id: 13, icon: <Settings />, title: 'Cấu hình trống', desc: 'Chưa có thiết lập nào.' },
    { id: 14, icon: <WifiOff />, title: 'Network offline', desc: 'Mất kết nối mạng, đang chờ...' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-app">
      <div className="p-6 border-b border-border-default flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary mb-6">State Gallery (QA)</h1>
        
        <DevStateSwitcher 
          currentState={globalState}
          onStateChange={setGlobalState}
        />
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-12">
        {/* Skeletons Section - Exactly 8 instances (4 presets x 2 contexts) */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-6">Skeletons (8 Instances)</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Context 1: Full width context */}
            <div className="flex flex-col gap-6 border border-border-default p-6 rounded-xl bg-bg-surface">
              <h3 className="text-sm font-medium text-text-secondary">Context 1: Broad / Full Width</h3>
              <Skeleton preset="table-row" />
              <Skeleton preset="project-card" />
              <Skeleton preset="property-panel" />
              <div className="h-[200px]">
                <Skeleton preset="canvas" />
              </div>
            </div>

            {/* Context 2: Narrow / Card context */}
            <div className="flex flex-col gap-6 border border-border-default p-6 rounded-xl bg-bg-surface w-full max-w-[320px]">
              <h3 className="text-sm font-medium text-text-secondary">Context 2: Narrow (320px)</h3>
              <Skeleton preset="table-row" />
              <Skeleton preset="project-card" />
              <Skeleton preset="property-panel" />
              <div className="h-[200px]">
                <Skeleton preset="canvas" />
              </div>
            </div>
          </div>
        </section>

        {/* Empty States Section - Exactly 14 instances */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-6">Empty States (14 Instances)</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {emptyStates.map((state) => (
              <div key={state.id} className="h-[240px] border border-border-default rounded-xl bg-bg-surface overflow-hidden">
                <EmptyState
                  icon={state.icon}
                  title={`${state.id}. ${state.title}`}
                  description={state.desc}
                  action={{
                    label: 'Thử lại',
                    onClick: () => console.log('Clicked', state.title)
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
