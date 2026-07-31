import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('vtoApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get calls GET /vto', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'vto-1' });

    const { vtoApi } = await import('./vtoApi');
    await vtoApi.get();

    expect(apiFetch).toHaveBeenCalledWith('/vto');
  });

  it('update PUTs the partial payload as JSON', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'vto-1' });

    const { vtoApi } = await import('./vtoApi');
    await vtoApi.update({ coreFocusPurpose: 'Ayudar a pymes' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/vto',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ coreFocusPurpose: 'Ayudar a pymes' }) })
    );
  });
});
