import { useState, useCallback } from 'react';
import { Z_INDEX } from '../lib/zIndex';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BreadcrumbOption {
  id: string;
  label: string;
  onClick: () => void;
}

export interface BreadcrumbItem {
  id: string;
  label: string;
  onClick?: () => void;
  /** Các lựa chọn nhanh (dropdown) — chỉ hiện ở cấp giữa */
  options?: BreadcrumbOption[];
}

export interface UseBreadcrumbReturn {
  openDropdownId: string | null;
  openDropdown: (id: string) => void;
  closeDropdown: () => void;
  dropdownZIndex: number;
}

// ─── useBreadcrumb ────────────────────────────────────────────────────────────

export function useBreadcrumb(): UseBreadcrumbReturn {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const openDropdown = useCallback((id: string) => {
    setOpenDropdownId(id);
  }, []);

  const closeDropdown = useCallback(() => {
    setOpenDropdownId(null);
  }, []);

  // Đóng khi click ngoài — xử lý trong view qua onBlur
  return {
    openDropdownId,
    openDropdown,
    closeDropdown,
    dropdownZIndex: Z_INDEX.dropdown,
  };
}
