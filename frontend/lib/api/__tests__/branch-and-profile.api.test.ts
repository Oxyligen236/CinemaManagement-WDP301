import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, profileApi } from '@/lib/api/profile.api';

const BASE_URL = 'http://localhost:8010';

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('lib/api/branch.api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null immediately when branchId is empty', async () => {
    const { fetchBranchInfo } = await import('@/lib/api/branch.api');
    await expect(fetchBranchInfo('')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches from direct /branches/:branchId, normalizes Lotte -> Latte, and caches hits', async () => {
    const { fetchBranchInfo } = await import('@/lib/api/branch.api');
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        branch: {
          branchName: 'Lotte Cinema Cantavil',
          address: 'TTTM Lotte Premier',
          hotline: '19001234',
          branchStatus: 'ACTIVE',
        },
      }),
    );

    const first = await fetchBranchInfo('b 1');
    expect(first).toEqual({
      branchId: 'b 1',
      branchName: 'Latte Cinema Cantavil',
      address: 'TTTM Latte Premier',
      hotline: '19001234',
      branchStatus: 'ACTIVE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/branches/b%201`, {
      cache: 'no-store',
    });

    const second = await fetchBranchInfo('b 1');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports flat branch object without optional fields from direct endpoint', async () => {
    const { fetchBranchInfo } = await import('@/lib/api/branch.api');
    fetchMock.mockResolvedValueOnce(mockResponse({ name: 'Lotte Gò Vấp' }));

    await expect(fetchBranchInfo('b-flat')).resolves.toEqual({
      branchId: 'b-flat',
      branchName: 'Latte Gò Vấp',
      address: undefined,
      hotline: undefined,
      branchStatus: undefined,
    });
  });

  it('falls back to /branches/public when direct endpoint lacks name, returns !ok, or throws', async () => {
    const { fetchBranchInfo } = await import('@/lib/api/branch.api');

    // Direct returns 200 without name, fallback returns array
    fetchMock
      .mockResolvedValueOnce(mockResponse({ branch: {} }))
      .mockResolvedValueOnce(
        mockResponse([
          { id: 'ignored-no-name' },
          {
            id: 'b-pub-1',
            name: 'Lotte Nam Sài Gòn',
            address: 'Lotte Mart Q7',
            hotline: '028123',
            branchStatus: 'ACTIVE',
          },
        ]),
      );

    await expect(fetchBranchInfo('b-pub-1')).resolves.toEqual({
      branchId: 'b-pub-1',
      branchName: 'Latte Nam Sài Gòn',
      address: 'Latte Mart Q7',
      hotline: '028123',
      branchStatus: 'ACTIVE',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${BASE_URL}/branches/public`, {
      cache: 'no-store',
    });

    // Direct throws network error, fallback returns { branches: [...] } with _id
    fetchMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(
        mockResponse({
          branches: [{ _id: 'b-pub-2', branchName: 'CGV Thủ Đức' }],
        }),
      );
    await expect(fetchBranchInfo('b-pub-2')).resolves.toEqual({
      branchId: 'b-pub-2',
      branchName: 'CGV Thủ Đức',
      address: undefined,
      hotline: undefined,
      branchStatus: undefined,
    });

    // Direct returns 404, fallback returns { branches: [...] } using branchId field
    fetchMock
      .mockResolvedValueOnce(mockResponse({}, false, 404))
      .mockResolvedValueOnce(
        mockResponse({
          branches: [{ branchId: 'b-pub-3', branchName: 'Latte Landmark' }],
        }),
      );
    await expect(fetchBranchInfo('b-pub-3')).resolves.toEqual({
      branchId: 'b-pub-3',
      branchName: 'Latte Landmark',
      address: undefined,
      hotline: undefined,
      branchStatus: undefined,
    });
  });

  it('falls back to FALLBACK_SLUGS when both endpoints fail or omit branchId, and returns null for unknown id', async () => {
    const { fetchBranchInfo } = await import('@/lib/api/branch.api');

    fetchMock
      .mockResolvedValueOnce(mockResponse({}, false, 500))
      .mockResolvedValueOnce(mockResponse({}));

    await expect(fetchBranchInfo('branch-cantavil')).resolves.toEqual({
      branchId: 'branch-cantavil',
      branchName: 'Latte Cinema Cantavil',
      address: 'Tầng 7, Cantavil Premier, An Phú, TP. Thủ Đức',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Cached slug hit
    await expect(fetchBranchInfo('branch-cantavil')).resolves.toMatchObject({
      branchId: 'branch-cantavil',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Public throws network error -> returns null for unknown slug
    fetchMock
      .mockResolvedValueOnce(mockResponse({}, false, 404))
      .mockRejectedValueOnce(new Error('network down'));
    await expect(fetchBranchInfo('unknown-branch')).resolves.toBeNull();

    // Public returns !ok -> returns null for unknown slug
    fetchMock
      .mockResolvedValueOnce(mockResponse({}, false, 404))
      .mockResolvedValueOnce(mockResponse({}, false, 500));
    await expect(fetchBranchInfo('unknown-branch-2')).resolves.toBeNull();
  });
});

describe('lib/api/profile.api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses cinema_access_token or access_token and calls primary endpoints', async () => {
    const profile = {
      id: 'u-1',
      email: 'u@latte.vn',
      firstName: 'An',
      lastName: 'Nguyễn',
      role: 'CUSTOMER',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    fetchMock.mockResolvedValue(mockResponse(profile));

    // No token
    await expect(profileApi.getProfile()).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/api/v1/auth/profile`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    // access_token fallback
    localStorage.setItem('access_token', 'acc-tok');
    await profileApi.updateProfile({ firstName: 'Bình', lastName: 'Trần' });
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/api/v1/auth/profile`, {
      method: 'PATCH',
      body: JSON.stringify({ firstName: 'Bình', lastName: 'Trần' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer acc-tok',
      },
    });

    // cinema_access_token priority
    localStorage.setItem('cinema_access_token', 'cin-tok');
    fetchMock.mockResolvedValueOnce(mockResponse({ message: 'Đổi mật khẩu thành công' }));
    await expect(
      profileApi.changePassword({ currentPassword: 'old', newPassword: 'newpassword1' }),
    ).resolves.toEqual({ message: 'Đổi mật khẩu thành công' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/api/v1/auth/change-password`,
      {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: 'old',
          newPassword: 'newpassword1',
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer cin-tok',
        },
      },
    );

    // SSR no window
    vi.stubGlobal('window', undefined);
    fetchMock.mockResolvedValueOnce(mockResponse(profile));
    await profileApi.getProfile();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/api/v1/auth/profile`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('retries fallback endpoint when primary returns 404', async () => {
    const profile = { id: 'u-1', email: 'a@b.com' };
    fetchMock
      .mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, false, 404))
      .mockResolvedValueOnce(mockResponse(profile, true, 200));

    await expect(profileApi.getProfile()).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${BASE_URL}/api/v1/auth/profile`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${BASE_URL}/auth/profile`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('keeps original 404 response if fallback also returns 404 or throws network error', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, false, 404))
      .mockResolvedValueOnce(mockResponse({ message: 'Fallback 404' }, false, 404));

    await expect(profileApi.getProfile()).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Không tìm thấy dữ liệu yêu cầu.',
    });

    fetchMock
      .mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, false, 404))
      .mockRejectedValueOnce(new Error('fallback network err'));

    await expect(profileApi.getProfile()).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy dữ liệu yêu cầu.',
    });
  });

  it('handles non-404 errors (JSON string, JSON array, non-object JSON, invalid JSON) and primary network failures', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ message: 'Mật khẩu cũ không đúng' }, false, 400),
    );
    await expect(
      profileApi.changePassword({ currentPassword: 'bad', newPassword: 'newpassword' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Mật khẩu cũ không đúng',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(
      mockResponse({ message: ['Họ không hợp lệ', 'Tên trống'] }, false, 422),
    );
    await expect(
      profileApi.updateProfile({ firstName: '', lastName: '' }),
    ).rejects.toMatchObject({
      status: 422,
      message: 'Họ không hợp lệ, Tên trống',
    });

    fetchMock.mockResolvedValueOnce(
      mockResponse({ message: "I'm a teapot" }, false, 418),
    );
    await expect(profileApi.getProfile()).rejects.toMatchObject({
      status: 418,
      message: 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.',
    });

    fetchMock.mockResolvedValueOnce(
      mockResponse({ message: 12345 }, false, 400),
    );
    await expect(profileApi.getProfile()).rejects.toMatchObject({
      status: 400,
      message: 'Yêu cầu không thành công',
    });

    fetchMock.mockResolvedValueOnce(mockResponse('raw string', false, 418));
    await expect(profileApi.getProfile()).rejects.toMatchObject({
      status: 418,
      message: 'Yêu cầu không thành công',
      data: null,
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('bad json')),
    } as unknown as Response);
    await expect(profileApi.getProfile()).rejects.toMatchObject({
      status: 500,
      message: 'Yêu cầu không thành công',
    });

    fetchMock.mockRejectedValueOnce(new Error('DNS lookup failed'));
    await expect(profileApi.getProfile()).rejects.toBeInstanceOf(ApiError);

    fetchMock.mockRejectedValueOnce('unknown');
    await expect(profileApi.getProfile()).rejects.toMatchObject({
      message: 'Lỗi kết nối máy chủ',
    });
  });
});
