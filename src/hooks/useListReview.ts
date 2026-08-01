import { useState, useMemo, useCallback } from 'react';

export interface WallData {
  id: string;
  code: string;
  thickness: number; // mm
  confidence: number;
  level: string;
  status: 'verified' | 'attention' | 'violation' | 'neutral';
  isFlash?: boolean;
}

type SortConfig = {
  key: keyof WallData | null;
  direction: 'asc' | 'desc' | null;
}

let undoBackup: WallData[] | null = null;

export function useListReview(
  initialData: WallData[],
  onToast?: (toast: { message: string; onUndo: () => void }) => void
) {
  const [data, setData] = useState<WallData[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key!];
      const bVal = b[sortConfig.key!];
      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const handleSort = (key: keyof WallData) => {
    setSortConfig(current => {
      if (current.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        if (current.direction === 'desc') return { key: null, direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSelect = useCallback((id: string, isShift: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (isShift && lastSelectedId) {
        const currentIndex = sortedData.findIndex(item => item.id === id);
        const lastIndex = sortedData.findIndex(item => item.id === lastSelectedId);
        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);
          for (let i = start; i <= end; i++) {
            const item = sortedData[i];
            if (item) next.add(item.id);
          }
        }
      } else {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
    setLastSelectedId(id);
  }, [sortedData, lastSelectedId]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === sortedData.length && sortedData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedData.map(item => item.id)));
    }
  }, [selectedIds.size, sortedData]);

  // batch approve
  const batchApprove = useCallback(() => {
    setData(current => current.map(item => {
      if (selectedIds.has(item.id)) {
        return { ...item, status: 'verified', isFlash: true };
      }
      return item;
    }));
    
    // reset flash after 400ms
    setTimeout(() => {
      setData(current => current.map(item => {
        if (selectedIds.has(item.id)) {
          return { ...item, isFlash: false };
        }
        return item;
      }));
      setSelectedIds(new Set());
    }, 400);
  }, [selectedIds]);

  // Undo delete toast logic simulation
  const handleDeleteSelected = useCallback(() => {
    const backup = [...data];
    const count = selectedIds.size;
    
    setData(current => current.filter(item => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    
    undoBackup = backup;
    
    onToast?.({
      message: `Đã xóa ${count > 0 ? count : 'các'} cấu kiện`,
      onUndo: () => {
        if (undoBackup) {
          setData(undoBackup);
          undoBackup = null;
        }
      }
    });
  }, [data, selectedIds, onToast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!focusedId) return;
    const currentIndex = sortedData.findIndex(item => item.id === focusedId);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextItem = sortedData[Math.min(currentIndex + 1, sortedData.length - 1)];
      if (nextItem) setFocusedId(nextItem.id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevItem = sortedData[Math.max(currentIndex - 1, 0)];
      if (prevItem) setFocusedId(prevItem.id);
    } else if (e.key === ' ') {
      e.preventDefault();
      handleSelect(focusedId, e.shiftKey);
    }
  }, [focusedId, sortedData, handleSelect]);

  return {
    data: sortedData,
    selectedIds,
    focusedId,
    setFocusedId,
    sortConfig,
    handleSort,
    handleSelect,
    handleSelectAll,
    batchApprove,
    handleDeleteSelected,
    handleKeyDown,
    rawCount: data.length,
    verifiedCount: data.filter(d => d.status === 'verified').length
  };
}
