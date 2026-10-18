import { NavLink } from 'react-router-dom';

import { cn } from '../../lib/utils';
import { ROUTE_PATTERNS } from '../../routes/paths';

const TABS = [
  { to: ROUTE_PATTERNS.adminUsers, label: 'Người dùng' },
  { to: ROUTE_PATTERNS.adminModels, label: 'Thư viện model' },
  { to: ROUTE_PATTERNS.adminTrainingModels, label: 'Model AI' },
  { to: ROUTE_PATTERNS.adminTrainingJobs, label: 'Huấn luyện' },
] as const;

/** Thanh điều hướng chung cho bốn màn quản trị; liên kết thật nên bấm giữa/Tab đều dùng được. */
export function AdminNav() {
  return (
    <nav aria-label="Mục quản trị" className="mx-auto flex w-full max-w-[1200px] gap-1 border-b border-border-default px-6 pt-4">
      {TABS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              '-mb-px border-b-2 px-3 py-2 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-accent',
              isActive
                ? 'border-accent font-semibold text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
