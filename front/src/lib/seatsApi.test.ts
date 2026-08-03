import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('seatsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list calls GET /seats', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { seatsApi } = await import('./seatsApi');
    await seatsApi.list();

    expect(apiFetch).toHaveBeenCalledWith('/seats');
  });

  it('create POSTs the payload as JSON', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'seat-1' });

    const { seatsApi } = await import('./seatsApi');
    await seatsApi.create({ name: 'Ventas' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/seats',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Ventas' }) })
    );
  });

  it('update PATCHes only the given fields', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'seat-1' });

    const { seatsApi } = await import('./seatsApi');
    await seatsApi.update('seat-1', { parentSeatId: 'seat-2' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/seats/seat-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ parentSeatId: 'seat-2' }) })
    );
  });

  it('remove DELETEs the seat', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);

    const { seatsApi } = await import('./seatsApi');
    await seatsApi.remove('seat-1');

    expect(apiFetch).toHaveBeenCalledWith('/seats/seat-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
