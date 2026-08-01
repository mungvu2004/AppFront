import React from 'react';

import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useBreadcrumb } from '../../hooks/useBreadcrumb';
import type { BreadcrumbItem, BreadcrumbOption } from '../../hooks/useBreadcrumb';

// Re-export types for consumers
export type { BreadcrumbItem, BreadcrumbOption };


// ─── Props ────────────────────────────────────────────────────────────────────

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

export function Breadcrumb({ items }: BreadcrumbProps) {
  const { openDropdownId, openDropdown, closeDropdown, dropdownZIndex } = useBreadcrumb();

  return (
    <nav className="flex items-center" aria-label="Breadcrumb">
      <ol className="flex items-center gap-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isMiddle = !isLast && index > 0;
          const hasDropdown = isMiddle && Array.isArray(item.options) && item.options.length > 0;
          const isDropdownOpen = openDropdownId === item.id;

          return (
            <li key={item.id} className="flex items-center">
              {/* Separator › */}
              {index > 0 && (
                <span
                  className="mx-1.5 text-[13px] text-text-muted select-none"
                  aria-hidden="true"
                >
                  ›
                </span>
              )}

              {isLast ? (
                /* Phần cuối — chữ primary, không click */
                <span
                  className="text-[13px] font-semibold text-text-primary leading-none"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : hasDropdown ? (
                /* Cấp giữa có dropdown */
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => isDropdownOpen ? closeDropdown() : openDropdown(item.id)}
                    className={cn(
                      'text-[13px] font-medium text-text-secondary leading-none',
                      'hover:text-text-primary transition-colors duration-120',
                      'rounded-[4px] px-0.5 -mx-0.5',
                      'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                      isDropdownOpen && 'text-text-primary'
                    )}
                    aria-haspopup="listbox"
                    aria-expanded={isDropdownOpen}
                    aria-label={`Chọn nhanh — đang ở ${item.label}`}
                  >
                    {item.label}
                  </button>

                  {/* Dropdown */}
                  {isDropdownOpen && (
                    <>
                      {/* Overlay đóng khi click ngoài */}
                      <div
                        className="fixed inset-0"
                        style={{ zIndex: dropdownZIndex - 1 }}
                        onClick={closeDropdown}
                        aria-hidden="true"
                      />
                      <ul
                        role="listbox"
                        aria-label="Chọn tầng"
                        className={cn(
                          'absolute top-full left-0 mt-1.5',
                          'min-w-[180px]',
                          'bg-bg-surface rounded-[10px] shadow-float',
                          'border border-border-default',
                          'py-1 overflow-hidden',
                          'animate-dropdown-open'
                        )}
                        style={{ zIndex: dropdownZIndex }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') closeDropdown();
                        }}
                      >
                        {item.options!.map((opt) => (
                          <li key={opt.id} role="option" aria-selected={opt.id === item.id}>
                            <button
                              type="button"
                              onClick={() => { opt.onClick(); closeDropdown(); }}
                              className={cn(
                                'w-full text-left px-3 py-2',
                                'text-[13px] text-text-primary',
                                'hover:bg-bg-hover transition-colors duration-120',
                                'flex items-center justify-between gap-2',
                                'outline-none focus-visible:bg-bg-selected'
                              )}
                            >
                              <span>{opt.label}</span>
                              {opt.id === item.id && (
                                <Check className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                /* Cấp đầu — click được, không có dropdown */
                <button
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'text-[13px] font-medium text-text-secondary leading-none',
                    'hover:text-text-primary transition-colors duration-120',
                    'rounded-[4px] px-0.5 -mx-0.5',
                    'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
                  )}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
