import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({ apiFetch: vi.fn() }));

describe('todosApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list with no filters calls the bare endpoint', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { todosApi } = await import('./todosApi');

    await todosApi.list();

    expect(apiFetch).toHaveBeenCalledWith('/todos');
  });

  it('list with filters builds the query string', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { todosApi } = await import('./todosApi');

    await todosApi.list({ status: 'open', ownerUserId: 'user-1' });

    expect(apiFetch).toHaveBeenCalledWith('/todos?status=open&ownerUserId=user-1');
  });

  it('create POSTs the payload as JSON', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'todo-1' });
    const { todosApi } = await import('./todosApi');

    await todosApi.create({ title: 'x', ownerUserId: 'user-1', originatingMeetingId: 'meeting-1' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/todos',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'x', ownerUserId: 'user-1', originatingMeetingId: 'meeting-1' }),
      })
    );
  });

  it('update PATCHes only the given fields', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'todo-1' });
    const { todosApi } = await import('./todosApi');

    await todosApi.update('todo-1', { status: 'done' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/todos/todo-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
    );
  });

  it('remove DELETEs the todo', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    const { todosApi } = await import('./todosApi');

    await todosApi.remove('todo-1');

    expect(apiFetch).toHaveBeenCalledWith('/todos/todo-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
