import { useAuthStore } from '../store/authStore';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { token, activeTenantId } = useAuthStore.getState();

  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (activeTenantId) headers.set('X-Tenant-Id', activeTenantId);

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      useAuthStore.getState().handleSessionExpired();
      if (!useAuthStore.getState().token && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    throw new ApiError(response.status, body.error ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
