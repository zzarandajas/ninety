import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('rocksApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list builds the query string only from provided filters', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.list({ quarter: '2026-Q3' });

    expect(apiFetch).toHaveBeenCalledWith('/rocks?quarter=2026-Q3');
  });

  it('list with no filters calls the bare endpoint', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.list();

    expect(apiFetch).toHaveBeenCalledWith('/rocks');
  });

  it('create POSTs the payload as JSON', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'rock-1' });

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.create({
      title: 'Rock 1',
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: false,
      dueDate: '2026-09-30',
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/rocks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Rock 1',
          ownerUserId: 'user-1',
          quarter: '2026-Q3',
          isCompanyRock: false,
          dueDate: '2026-09-30',
        }),
      })
    );
  });

  it('toggleMilestone PATCHes { completed }', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'milestone-1' });

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.toggleMilestone('rock-1', 'milestone-1', true);

    expect(apiFetch).toHaveBeenCalledWith(
      '/rocks/rock-1/milestones/milestone-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ completed: true }) })
    );
  });

  it('remove DELETEs the rock', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.remove('rock-1');

    expect(apiFetch).toHaveBeenCalledWith('/rocks/rock-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
