import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createMockApiClient, MOCK_SHARE_TOKEN } from '@/api/__mocks__/client';
import { createExportPanelGateway, ExportAccessError } from '@/screens/export/ExportPanel/exportPanelGateway';
import { createShareLink, revokeShareLink, type ShareLinkGateway } from '@/lib/export/shareLink';

import { SHARE_LINK_GONE_MESSAGE, SharedModelPage } from './SharedModelPage';

function renderAt(token: string) {
  const client = createMockApiClient();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<SharedModelPage client={client} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const wire = (status: string) => ({
  id: 'shl_1',
  url: 'http://api.example:8000/share/tok_abc',
  permission: 'view',
  status,
  createdAt: '2026-10-25T00:00:00Z',
  expiresAt: null,
  revokedAt: status === 'revoked' ? '2026-10-25T01:00:00Z' : null,
  passwordProtected: false,
  viewpointCode: null,
  label: null,
});

describe('trang chia sẻ công khai', () => {
  it('token lạ/hết hạn (404) hiện "Liên kết không còn hiệu lực"', async () => {
    renderAt('khong-co');
    expect(await screen.findByRole('heading', { name: SHARE_LINK_GONE_MESSAGE })).toBeInTheDocument();
  });

  it('token hợp lệ hiện tên dự án và mặt bằng chỉ đọc', async () => {
    renderAt(MOCK_SHARE_TOKEN);
    expect(await screen.findByText('Bản xem chỉ đọc qua liên kết chia sẻ.')).toBeInTheDocument();
  });
});

describe('xuất qua tuyến có kiểm quyền', () => {
  it('403 thành lỗi nói rõ không có quyền xuất', async () => {
    const gateway = createExportPanelGateway({
      exportGraph: async () => ({ ok: false, error: { kind: 'http', status: 403 } as never }),
    });
    const run = gateway.loadExportGraph!('p1');
    await expect(run).rejects.toBeInstanceOf(ExportAccessError);
    await expect(run).rejects.toThrow('không có quyền xuất');
  });

  it('404 nói không tìm thấy dự án', async () => {
    const gateway = createExportPanelGateway({
      exportGraph: async () => ({ ok: false, error: { kind: 'http', status: 404 } as never }),
    });
    await expect(gateway.loadExportGraph!('p1')).rejects.toThrow('Không tìm thấy dự án');
  });
});

describe('tạo/thu hồi liên kết', () => {
  const gateway: ShareLinkGateway = {
    supported: true,
    create: async () => ({ ok: true, data: wire('active') }),
    list: async () => ({ ok: true, data: [wire('active')] }),
    revoke: async () => ({ ok: true, data: wire('revoked') }),
  };

  it('URL dựng từ origin FE + token, không dùng origin API', async () => {
    const result = await createShareLink(gateway, { projectId: 'p1', permission: 'view', expiresAt: null });
    expect(result.ok && result.data.url).toBe(`${window.location.origin}/share/tok_abc`);
  });

  it('thu hồi trả trạng thái revoked', async () => {
    const result = await revokeShareLink(gateway, { projectId: 'p1', linkId: 'shl_1' });
    expect(result.ok && result.data.status).toBe('revoked');
  });
});
