import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  id: string;
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-1" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={item.id}>
            {isLast ? (
              <span className="text-[13px] leading-[18px] font-semibold text-text-primary">
                {item.label}
              </span>
            ) : (
              <button
                onClick={item.onClick}
                className="text-[13px] leading-[18px] font-medium text-text-secondary hover:text-text-primary transition-colors active:scale-98"
                style={{ transition: 'all 180ms ease-out' }}
              >
                {item.label}
              </button>
            )}
            
            {!isLast && (
              <ChevronRight className="w-[14px] h-[14px] text-text-muted flex-shrink-0 mx-1" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
