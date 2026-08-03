import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({ apiFetch: vi.fn() }));

describe('issuesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list with no filters calls the bare endpoint', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.list();

    expect(apiFetch).toHaveBeenCalledWith('/issues');
  });

  it('list with a status filter builds the query string', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.list({ status: 'open' });

    expect(apiFetch).toHaveBeenCalledWith('/issues?status=open');
  });

  it('create POSTs the payload as JSON', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'issue-1' });
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.create({ title: 'x', raisedByUserId: 'user-1', priority: 'high' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/issues',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'x', raisedByUserId: 'user-1', priority: 'high' }),
      })
    );
  });

  it('update PATCHes only the given fields', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'issue-1' });
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.update('issue-1', { status: 'solved' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/issues/issue-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'solved' }) })
    );
  });

  it('remove DELETEs the issue', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.remove('issue-1');

    expect(apiFetch).toHaveBeenCalledWith('/issues/issue-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('reorder PATCHes the ordered id list', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.reorder(['issue-2', 'issue-1']);

    expect(apiFetch).toHaveBeenCalledWith(
      '/issues/reorder',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ orderedIds: ['issue-2', 'issue-1'] }) })
    );
  });
});
