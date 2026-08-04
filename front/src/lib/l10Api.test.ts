import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({ apiFetch: vi.fn() }));

describe('l10Api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list with no filters calls the bare endpoint', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { l10Api } = await import('./l10Api');

    await l10Api.list();

    expect(apiFetch).toHaveBeenCalledWith('/l10');
  });

  it('list with a status filter builds the query string', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { l10Api } = await import('./l10Api');

    await l10Api.list({ status: 'completed' });

    expect(apiFetch).toHaveBeenCalledWith('/l10?status=completed');
  });

  it('create POSTs the payload as JSON', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'meeting-1' });
    const { l10Api } = await import('./l10Api');

    await l10Api.create({ quarter: '2026-Q3', meetingDate: '2026-08-03T00:00:00.000Z', facilitatorUserId: 'user-1' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/l10',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ quarter: '2026-Q3', meetingDate: '2026-08-03T00:00:00.000Z', facilitatorUserId: 'user-1' }),
      })
    );
  });

  it('get GETs a single meeting', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'meeting-1' });
    const { l10Api } = await import('./l10Api');

    await l10Api.get('meeting-1');

    expect(apiFetch).toHaveBeenCalledWith('/l10/meeting-1');
  });

  it('update PATCHes only the given fields', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'meeting-1' });
    const { l10Api } = await import('./l10Api');

    await l10Api.update('meeting-1', { segueNotes: 'Todo bien' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/l10/meeting-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ segueNotes: 'Todo bien' }) })
    );
  });

  it('remove DELETEs the meeting', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    const { l10Api } = await import('./l10Api');

    await l10Api.remove('meeting-1');

    expect(apiFetch).toHaveBeenCalledWith('/l10/meeting-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('close POSTs the rating and notes', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'meeting-1' });
    const { l10Api } = await import('./l10Api');

    await l10Api.close('meeting-1', { concludeNotes: 'Buena reunión' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/l10/meeting-1/close',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ overallRating: 8, concludeNotes: 'Buena reunión' }),
      })
    );
  });

  it('listAgendaItems GETs the log list for a meeting', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { l10Api } = await import('./l10Api');

    await l10Api.listAgendaItems('meeting-1');

    expect(apiFetch).toHaveBeenCalledWith('/l10/meeting-1/agenda-items');
  });

  it('logAgendaItem POSTs the item log', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'log-1' });
    const { l10Api } = await import('./l10Api');

    await l10Api.logAgendaItem('meeting-1', { itemType: 'rock_review', referenceId: 'rock-1', notes: 'x' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/l10/meeting-1/agenda-items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ itemType: 'rock_review', referenceId: 'rock-1', notes: 'x' }),
      })
    );
  });

  it('submitRating POSTs the individual rating', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'rating-1' });
    const { l10Api } = await import('./l10Api');

    await l10Api.submitRating('meeting-1', { rating: 9 });

    expect(apiFetch).toHaveBeenCalledWith(
      '/l10/meeting-1/ratings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rating: 9 }),
      })
    );
  });
});
