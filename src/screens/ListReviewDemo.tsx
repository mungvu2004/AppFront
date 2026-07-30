import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Badge } from '../components/ui/Badge';
import { ConfidenceMeter } from '../components/ui/ConfidenceMeter';
import { TreeItem } from '../components/ui/TreeItem';
import { Table, TableHeader, TableHead, TableRow, TableCell } from '../components/ui/Table';
import { useListReview, WallData } from '../hooks/useListReview';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/feedback/Skeleton';
import { EmptyState } from '../components/feedback/EmptyState';

const mockData: WallData[] = Array.from({ length: 48 }).map((_, i) => {
  const num = i + 1;
  const isLowConf = i % 5 === 0;
  return {
    id: `wall-${num}`,
    code: `W-${num.toString().padStart(3, '0')}`,
    thickness: 220,
    confidence: isLowConf ? 0.71 : 0.85 + (Math.random() * 0.1),
    level: 'Tầng 01',
    status: 'neutral' // Chua duyet
  };
});

type DemoState = 'default' | 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'permission' | 'collapsed';
const DEMO_STATES: DemoState[] = ['default', 'empty', 'loading', 'partial', 'error', 'success', 'permission', 'collapsed'];

export function ListReviewDemo() {
  const [demoState, setDemoState] = useState<DemoState>('default');
  
  // Use mock data if not empty/error/permission
  const initialData = (demoState === 'empty' || demoState === 'error' || demoState === 'permission') ? [] : mockData;
  const review = useListReview(initialData);

  const [layerVisible, setLayerVisible] = useState(true);

  const isCollapsed = demoState === 'collapsed';

  const renderSkeletons = () =>
    Array.from({ length: 8 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20 rounded" /></TableCell>
        {!isCollapsed && (
          <>
            <TableCell><Skeleton className="h-4 w-12 rounded" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24 rounded" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16 rounded" /></TableCell>
            <TableCell><Skeleton className="h-6 w-24 rounded" /></TableCell>
          </>
        )}
      </TableRow>
    ));

  return (
    <div className="flex flex-col h-screen bg-bg-surface overflow-hidden">
      {/* Top Demo State Switcher (Not part of component, just for testing states) */}
      <div className="flex items-center gap-2 p-2 bg-bg-sunken border-b border-border-default shrink-0 overflow-x-auto">
        <span className="text-sm font-semibold text-text-secondary whitespace-nowrap">States:</span>
        {DEMO_STATES.map(state => (
          <Button
            key={state}
            variant={demoState === state ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setDemoState(state)}
          >
            {state}
          </Button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (TreeItems) */}
        <div className="w-64 border-r border-border-default p-2 flex flex-col gap-1 overflow-y-auto shrink-0">
          <TreeItem 
            label="Kiến trúc" 
            expanded={true} 
            count={48} 
          />
          <TreeItem 
            level={1}
            label="Tầng 01" 
            count={21}
            visible={layerVisible}
            onToggleVisible={() => setLayerVisible(!layerVisible)}
            colorChip="var(--accent)"
          />
          <TreeItem 
            level={1}
            label="Tầng 02" 
            count={27}
          />
        </div>

        {/* Main Table Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden focus:outline-none" tabIndex={0} onKeyDown={review.handleKeyDown}>
          
          {demoState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-surface z-20">
              <span className="text-state-violation-text text-sm">Đã có lỗi xảy ra khi tải dữ liệu</span>
              <Button onClick={() => setDemoState('default')}>Thử lại</Button>
            </div>
          )}

          {demoState === 'permission' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-surface z-20">
              <span className="text-text-secondary text-sm">Bạn không có quyền xem dữ liệu này</span>
            </div>
          )}

          {demoState === 'empty' && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-surface z-20">
              <EmptyState
                title="Chưa có kết quả AI"
                description="Bắt đầu chạy nhận diện để xem kết quả tại đây."
                buttonText="Chạy AI"
                onButtonClick={() => {}}
              />
            </div>
          )}

          {demoState === 'success' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-surface z-20">
              <span className="text-state-verified-text text-sm">Duyệt dữ liệu thành công!</span>
            </div>
          )}

          <Table>
            <TableHeader>
              <tr>
                <TableHead className="w-10">
                  <input 
                    type="checkbox" 
                    checked={review.selectedIds.size === review.data.length && review.data.length > 0}
                    onChange={review.handleSelectAll}
                    className="rounded border-border-default text-accent focus:ring-accent"
                  />
                </TableHead>
                <TableHead sortable sortDirection={review.sortConfig.key === 'code' ? review.sortConfig.direction : null} onSort={() => review.handleSort('code')}>
                  Mã cấu kiện
                </TableHead>
                {!isCollapsed && (
                  <>
                    <TableHead sortable sortDirection={review.sortConfig.key === 'thickness' ? review.sortConfig.direction : null} onSort={() => review.handleSort('thickness')}>
                      Chiều dày
                    </TableHead>
                    <TableHead sortable sortDirection={review.sortConfig.key === 'confidence' ? review.sortConfig.direction : null} onSort={() => review.handleSort('confidence')}>
                      Độ tin cậy
                    </TableHead>
                    <TableHead sortable sortDirection={review.sortConfig.key === 'level' ? review.sortConfig.direction : null} onSort={() => review.handleSort('level')}>
                      Tầng
                    </TableHead>
                    <TableHead sortable sortDirection={review.sortConfig.key === 'status' ? review.sortConfig.direction : null} onSort={() => review.handleSort('status')}>
                      Trạng thái
                    </TableHead>
                  </>
                )}
              </tr>
            </TableHeader>
            <tbody>
              {demoState === 'partial' && (
                <tr>
                  <td colSpan={isCollapsed ? 2 : 6} className="p-0">
                    <div className="bg-state-attention-tint border-b border-state-attention text-state-attention-text px-3 py-2 text-sm flex items-center justify-between">
                      <span>Có lỗi khi tải trang 2. Một số dữ liệu có thể bị thiếu.</span>
                      <Button variant="ghost" size="sm" className="h-6">Thử lại</Button>
                    </div>
                  </td>
                </tr>
              )}
              {demoState === 'loading' ? renderSkeletons() : review.data.map(item => {
                const isSelected = review.selectedIds.has(item.id);
                const isFocused = review.focusedId === item.id;
                const isAttention = item.confidence < 0.75;
                const badgeText = item.status === 'verified' ? 'Đã duyệt' : item.status === 'neutral' ? 'Chưa duyệt' : item.status;

                return (
                  <TableRow 
                    key={item.id} 
                    layoutId={item.id}
                    selected={isSelected}
                    focused={isFocused}
                    isAttention={isAttention}
                    isFlash={item.isFlash || false}
                    onClick={() => {
                      review.setFocusedId(item.id);
                      // prevent triggering row selection if clicking inside checkbox wrapper
                    }}
                  >
                    <TableCell>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => review.handleSelect(item.id, (e.nativeEvent as PointerEvent).shiftKey)}
                        className="rounded border-border-default text-accent focus:ring-accent relative z-10"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.code}</TableCell>
                    {!isCollapsed && (
                      <>
                        <TableCell>{item.thickness.toLocaleString('vi-VN')} mm</TableCell>
                        <TableCell>
                          <ConfidenceMeter value={item.confidence} />
                        </TableCell>
                        <TableCell>{item.level}</TableCell>
                        <TableCell>
                          <Badge variant={item.status}>
                            {badgeText}
                          </Badge>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Sticky Bottom Summary Bar */}
      {review.selectedIds.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-bg-surface border border-border-default rounded-full shadow-float px-4 py-2 z-30">
          <span className="text-sm font-medium">
            Đã chọn {review.selectedIds.size} cấu kiện
          </span>
          <div className="w-px h-4 bg-border-default" />
          <Button variant="primary" size="sm" onClick={review.batchApprove}>
            Duyệt danh sách
          </Button>
          <Button variant="ghost" size="sm" onClick={review.handleDeleteSelected} className="text-state-violation-text hover:bg-danger-tint">
            Xóa
          </Button>
        </div>
      )}

      {/* Persistent summary count (if nothing is selected) */}
      {review.selectedIds.size === 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-bg-sunken border-t border-border-default flex items-center px-4 z-20">
          <span className="text-sm font-medium text-text-primary">
            {review.verifiedCount}/{review.rawCount} tường đã duyệt
          </span>
        </div>
      )}

      {/* Undo Toast */}
      <div 
        className={clsx(
          "fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-text-primary text-bg-surface px-4 py-3 rounded-lg shadow-float transition-all duration-340 z-50",
          review.showUndo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
        )}
      >
        <span className="text-sm font-medium">Đã xóa {review.selectedIds.size > 0 ? review.selectedIds.size : 'các'} cấu kiện</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={review.handleUndo}
          className="text-accent-wash hover:text-accent-wash font-bold"
        >
          Hoàn tác
        </Button>
      </div>
    </div>
  );
}
