import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('membershipsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list calls GET /members', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { membershipsApi } = await import('./membershipsApi');
    await membershipsApi.list();

    expect(apiFetch).toHaveBeenCalledWith('/members');
  });

  it('invite POSTs to /members/invite', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ temporaryPassword: 'x' });

    const { membershipsApi } = await import('./membershipsApi');
    await membershipsApi.invite({ email: 'a@b.com', fullName: 'A B', role: 'member' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/members/invite',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', fullName: 'A B', role: 'member' }),
      })
    );
  });

  it('update PATCHes the membership', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'mem-1' });

    const { membershipsApi } = await import('./membershipsApi');
    await membershipsApi.update('mem-1', { seatId: null });

    expect(apiFetch).toHaveBeenCalledWith(
      '/members/mem-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ seatId: null }) })
    );
  });
});
