import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './apiClient';
import { useAuthStore } from '../store/authStore';

describe('apiFetch', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'test-token', activeTenantId: 'tenant-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().logout();
  });

  it('returns undefined for a 204 No Content response without parsing a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('should not be called on 204')),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/rocks/rock-1', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });

  it('parses JSON for a normal 200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'rock-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ id: string }>('/rocks/rock-1');

    expect(result).toEqual({ id: 'rock-1' });
  });

  it('throws ApiError with the server message on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Rock not found' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/rocks/missing')).rejects.toThrow(ApiError);
  });

  it('logs out and redirects to /login on a 401 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const assignMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, pathname: '/dashboard', assign: assignMock },
    });

    await expect(apiFetch('/rocks')).rejects.toThrow(ApiError);
    expect(useAuthStore.getState().token).toBeNull();
    expect(assignMock).toHaveBeenCalledWith('/login');

    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation });
  });

  it('does not redirect for a 401 on the login endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const assignMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, pathname: '/login', assign: assignMock },
    });

    await expect(apiFetch('/auth/login', { method: 'POST', body: '{}' })).rejects.toThrow(ApiError);
    expect(useAuthStore.getState().token).not.toBeNull();
    expect(assignMock).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation });
  });
});
