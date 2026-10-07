/**
 * Cổng cài đặt tài khoản: N11 đọc, N12 chỉ gửi khoá đổi, N14 thay ảnh, và bộ nhớ
 * của hai khối chưa có dây. Mọi bài tiêm client giả tường minh — không bài nào
 * dựa vào cổng mặc định (nạp lười, gọi mạng thật).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/api/client';
import { createMockApiClient } from '@/api/__mocks__/client';
import { ACCOUNT_LANGUAGES, type Me, type UpdateMe } from '@/api/schemas/me';
import type { HttpError } from '@/lib/http';

import { EMPTY_ACCOUNT_DRAFT, type AccountDraft } from './accountDraft';
import {
  createAccountSettingsGateway,
  profileDraftOf,
  resetAccountSettingsStore,
} from './accountSettingsGateway';

let sessionUserId: string | null = 'user-1';

vi.mock('@/lib/auth', () => ({
  getSession: () => ({ user: sessionUserId === null ? null : { id: sessionUserId } }),
}));

const ME: Me = {
  email: 'an@congty.vn',
  fullName: 'Phạm An',
  jobTitle: 'Kỹ sư',
  language: 'vi',
  phone: '0912',
};

const ME_MINIMAL: Me = { email: 'an@congty.vn', fullName: 'Phạm An', language: 'vi' };

const applyBody = (me: Me, body: UpdateMe): Me => ({
  ...me,
  ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
  ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle } : {}),
  ...(body.language !== undefined ? { language: body.language } : {}),
  ...(body.phone !== undefined ? { phone: body.phone } : {}),
});

function fakeClient(me: Me = ME) {
  const readProfile = vi.fn(() => Promise.resolve({ ok: true as const, data: me }));
  const updateProfile = vi.fn(({ body }: { body: UpdateMe }) =>
    Promise.resolve({ ok: true as const, data: applyBody(me, body) }),
  );
  const replaceAvatar = vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      data: { ...me, avatarUrl: 'https://cdn.example.test/avatars/a.png' },
    }),
  );
  const client: ApiClient = {
    ...createMockApiClient(),
    me: {
      changePassword: () => Promise.resolve({ ok: true, data: undefined }),
      readProfile,
      replaceAvatar,
      updateProfile,
    },
  };

  return { client, readProfile, replaceAvatar, updateProfile };
}

function draftWith(
  profile: Record<string, unknown>,
  rest: Partial<AccountDraft> = {},
): AccountDraft {
  return { ...EMPTY_ACCOUNT_DRAFT, ...rest, profile };
}

beforeEach(() => {
  sessionUserId = 'user-1';
  resetAccountSettingsStore();
});

describe('read (N11)', () => {
  it('ánh xạ hồ sơ ra bản nháp; jobTitle/phone vắng thành chuỗi rỗng', async () => {
    const { client } = fakeClient(ME_MINIMAL);

    const draft = await createAccountSettingsGateway({ apiClient: client }).read();

    expect(draft.profile).toEqual({ fullName: 'Phạm An', jobTitle: '', phone: '', language: 'vi' });
    expect(draft.appearance).toEqual({});
    expect(draft.notifications).toEqual({});
  });

  it('mang avatarUrl của máy chủ vào khối hồ sơ', () => {
    expect(profileDraftOf({ ...ME, avatarUrl: 'https://cdn.example.test/a.png' })).toMatchObject({
      avatarUrl: 'https://cdn.example.test/a.png',
    });
  });

  it('ném lỗi của client nguyên vẹn', async () => {
    const error: HttpError = {
      kind: 'http',
      raw: undefined,
      requestId: 'req-1',
      retryable: false,
      status: 500,
    };
    const client: ApiClient = {
      ...createMockApiClient(),
      me: { ...createMockApiClient().me, readProfile: () => Promise.resolve({ ok: false, error }) },
    };

    await expect(createAccountSettingsGateway({ apiClient: client }).read()).rejects.toBe(error);
  });
});

describe('save (N12)', () => {
  it('chỉ gửi khoá đổi, và không bao giờ gửi avatarUrl hay email', async () => {
    const { client, updateProfile } = fakeClient();
    const gateway = createAccountSettingsGateway({ apiClient: client });
    const read = await gateway.read();

    const result = await gateway.save(
      draftWith({
        ...read.profile,
        fullName: 'Lê Minh',
        avatarUrl: 'https://cdn.example.test/x.png',
        email: 'x@y.vn',
      }),
      read,
    );

    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile.mock.calls[0]?.[0].body).toStrictEqual({ fullName: 'Lê Minh' });
    expect(result?.fullName).toBe('Lê Minh');
  });

  it('gửi "" khi xoá chức danh hoặc số điện thoại', async () => {
    const { client, updateProfile } = fakeClient();
    const gateway = createAccountSettingsGateway({ apiClient: client });
    const read = await gateway.read();

    await gateway.save(
      draftWith({ ...read.profile, jobTitle: '', phone: '', language: 'en' }),
      read,
    );

    expect(updateProfile.mock.calls[0]?.[0].body).toStrictEqual({
      jobTitle: '',
      language: 'en',
      phone: '',
    });
  });

  it('chỉ đổi giao diện: không gọi N12, trả null', async () => {
    const { client, updateProfile } = fakeClient();
    const gateway = createAccountSettingsGateway({ apiClient: client });
    const read = await gateway.read();

    const result = await gateway.save(
      draftWith(read.profile, { appearance: { theme: 'dark' } }),
      read,
    );

    expect(result).toBeNull();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('lượt lưu thứ hai không gửi lại khoá đã lưu', async () => {
    const { client, updateProfile } = fakeClient();
    const gateway = createAccountSettingsGateway({ apiClient: client });
    const read = await gateway.read();
    const edited = draftWith({ ...read.profile, fullName: 'Lê Minh' });

    await gateway.save(edited, read);
    await gateway.save(edited, edited);

    expect(updateProfile).toHaveBeenCalledTimes(1);
  });

  it('ném lỗi của client nguyên vẹn, và lượt sau vẫn gửi lại khoá đó', async () => {
    const error: HttpError = {
      kind: 'http',
      raw: undefined,
      requestId: 'req-2',
      retryable: false,
      status: 422,
    };
    const base = fakeClient();
    let calls = 0;
    const client: ApiClient = {
      ...base.client,
      me: {
        ...base.client.me,
        updateProfile: (input) => {
          calls += 1;

          return calls === 1
            ? Promise.resolve({ ok: false, error })
            : base.client.me.updateProfile(input);
        },
      },
    };
    const gateway = createAccountSettingsGateway({ apiClient: client });
    const read = await gateway.read();
    const edited = draftWith({ ...read.profile, fullName: 'Lê Minh' });

    await expect(gateway.save(edited, read)).rejects.toBe(error);
    await expect(gateway.save(edited, read)).resolves.not.toBeNull();
    expect(base.updateProfile).toHaveBeenCalledTimes(1);
  });
});

describe('cổng không giữ trạng thái hồ sơ', () => {
  it('cổng mới, không gọi read(): chỉ đổi giao diện thì không gửi N12', async () => {
    const { client, updateProfile } = fakeClient();
    const gateway = createAccountSettingsGateway({ apiClient: client });
    const saved = draftWith({
      fullName: 'Phạm An',
      jobTitle: 'Kỹ sư',
      phone: '0912',
      language: 'vi',
    });

    const result = await gateway.save({ ...saved, appearance: { showGrid: false } }, saved);

    expect(result).toBeNull();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('không có bản đã lưu thì mọi khoá có giá trị là khoá đổi', async () => {
    const { client, updateProfile } = fakeClient();

    await createAccountSettingsGateway({ apiClient: client }).save(
      draftWith({ fullName: 'A', jobTitle: '', phone: '', language: 'vi' }),
      null,
    );

    expect(updateProfile.mock.calls[0]?.[0].body).toStrictEqual({
      fullName: 'A',
      jobTitle: '',
      language: 'vi',
      phone: '',
    });
  });
});

describe('ngôn ngữ viết thẳng khớp schema', () => {
  it('Me["language"] đúng là vi | en (đổi schema thì dòng satisfies này đỏ ở typecheck)', () => {
    const languages = ['vi', 'en'] satisfies readonly Me['language'][];
    const everyLanguageListed: Me['language'] extends (typeof languages)[number] ? true : never =
      true;

    expect(everyLanguageListed).toBe(true);
    expect(ACCOUNT_LANGUAGES).toEqual(languages);
  });
});

describe('hai khối giao diện và thông báo (bộ nhớ module)', () => {
  it('lưu rồi đọc lại thấy nguyên; đổi user.id giữa hai lượt read() thì về mặc định', async () => {
    const { client } = fakeClient();
    const gateway = createAccountSettingsGateway({ apiClient: client });
    const read = await gateway.read();

    await gateway.save(
      draftWith(read.profile, { appearance: { theme: 'dark' }, notifications: { email: true } }),
      read,
    );

    const same = await gateway.read();

    expect(same.appearance).toEqual({ theme: 'dark' });
    expect(same.notifications).toEqual({ email: true });

    sessionUserId = 'user-2';
    const other = await gateway.read();

    expect(other.appearance).toEqual({});
    expect(other.notifications).toEqual({});
  });

  it('hồ sơ không bao giờ nằm trong bộ nhớ: đọc luôn đi qua N11', async () => {
    const { client, readProfile } = fakeClient();
    const gateway = createAccountSettingsGateway({ apiClient: client });

    await gateway.read();
    await gateway.read();

    expect(readProfile).toHaveBeenCalledTimes(2);
  });
});

describe('nạp lười client hỏng', () => {
  it('replaceAvatar trả ApiResult lỗi thay vì ném', async () => {
    const client: ApiClient = {
      ...createMockApiClient(),
      me: {
        ...createMockApiClient().me,
        replaceAvatar: () => Promise.reject(new Error('mất chunk')),
      },
    };

    const result = await createAccountSettingsGateway({ apiClient: client }).replaceAvatar({
      contentBase64: 'AA==',
      mimeType: 'image/png',
    });

    expect(result.ok).toBe(false);
  });
});

describe('replaceAvatar (N14)', () => {
  it('chuyển thân {mimeType, contentBase64} cho client và trả ApiResult', async () => {
    const { client, replaceAvatar } = fakeClient();
    const body = { contentBase64: 'iVBORw0KGgo=', mimeType: 'image/png' } as const;

    const result = await createAccountSettingsGateway({ apiClient: client }).replaceAvatar(body);

    expect(replaceAvatar).toHaveBeenCalledWith({ body });
    expect(result.ok && result.data.avatarUrl).toBe('https://cdn.example.test/avatars/a.png');
  });
});
