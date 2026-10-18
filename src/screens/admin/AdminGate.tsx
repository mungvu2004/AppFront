import { ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { useSession } from '@/hooks/useSession';
import { ROUTES } from '@/routes/paths';

/**
 * Chặn khu `/admin/*` cho người không phải quản trị viên (G2-25): không hiện thanh
 * tab quản trị, chỉ một câu giải thích và nút về bảng điều khiển.
 * Backend vẫn chặn từng API — đây chỉ là lớp giao diện.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const navigate = useNavigate();
  if (session.roles.includes('admin')) return <>{children}</>;
  return (
    <EmptyState
      className="min-h-[60vh]"
      headingLevel="h1"
      icon={<ShieldOff size={32} aria-hidden="true" />}
      title="Khu Quản trị chỉ dành cho quản trị viên"
      description="Vai của bạn chưa có quyền quản lý người dùng và model. Nếu cần, hãy nhờ quản trị viên đổi vai cho bạn."
      action={{ label: 'Về bảng điều khiển', onClick: () => navigate(ROUTES.dashboard) }}
    />
  );
}
