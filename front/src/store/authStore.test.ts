import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

const loginPayload = {
  token: 'jwt-token',
  user: {
    id: 'user-1',
    email: 'me@example.com',
    fullName: 'Me',
    mustChangePassword: true,
    avatarUrl: null,
  },
  memberships: [
    { tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' },
    { tenantId: 'tenant-2', tenantName: 'Cionet', tenantSlug: 'cionet', role: 'owner' },
  ],
};

const impersonatePayload = {
  token: 'imp-token',
  user: {
    id: 'user-2',
    email: 'ana@tasvalor.com',
    fullName: 'Ana Sales',
    mustChangePassword: false,
    avatarUrl: null,
  },
  memberships: [
    { tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'member' },
  ],
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts logged out', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.tenants).toEqual([]);
  });

  it('login stores token, user, tenants, and defaults activeTenantId to the first tenant', () => {
    useAuthStore.getState().login(loginPayload);
    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token');
    expect(state.user).toEqual(loginPayload.user);
    expect(state.tenants).toEqual(loginPayload.memberships);
    expect(state.activeTenantId).toBe('tenant-1');
  });

  it('setActiveTenant switches the active tenant', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().setActiveTenant('tenant-2');
    expect(useAuthStore.getState().activeTenantId).toBe('tenant-2');
  });

  it('updateUser merges a partial patch into the current user', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().updateUser({ mustChangePassword: false, avatarUrl: '/uploads/avatars/user-1.png' });
    const state = useAuthStore.getState();
    expect(state.user).toEqual({
      ...loginPayload.user,
      mustChangePassword: false,
      avatarUrl: '/uploads/avatars/user-1.png',
    });
  });

  it('logout clears everything', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.tenants).toEqual([]);
    expect(state.activeTenantId).toBeNull();
  });

  it('impersonate saves the original session and switches to the simulated user', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().impersonate(impersonatePayload);
    const state = useAuthStore.getState();
    expect(state.token).toBe('imp-token');
    expect(state.user).toEqual(impersonatePayload.user);
    expect(state.tenants).toEqual(impersonatePayload.memberships);
    expect(state.activeTenantId).toBe('tenant-1');
    expect(state.impersonation).toEqual({
      token: 'jwt-token',
      user: loginPayload.user,
      tenants: loginPayload.memberships,
      activeTenantId: 'tenant-1',
    });
  });

  it('impersonate does nothing when a simulation is already active', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().impersonate(impersonatePayload);
    useAuthStore.getState().impersonate({
      ...impersonatePayload,
      token: 'imp-token-2',
      user: { ...impersonatePayload.user, fullName: 'Otra Persona' },
    });
    const state = useAuthStore.getState();
    expect(state.token).toBe('imp-token');
    expect(state.user?.fullName).toBe('Ana Sales');
    expect(state.impersonation?.token).toBe('jwt-token');
  });

  it('stopImpersonation restores the original session', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().impersonate(impersonatePayload);
    useAuthStore.getState().stopImpersonation();
    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token');
    expect(state.user).toEqual(loginPayload.user);
    expect(state.tenants).toEqual(loginPayload.memberships);
    expect(state.activeTenantId).toBe('tenant-1');
    expect(state.impersonation).toBeNull();
  });

  it('handleSessionExpired restores the original session while impersonating', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().impersonate(impersonatePayload);
    useAuthStore.getState().handleSessionExpired();
    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token');
    expect(state.user).toEqual(loginPayload.user);
    expect(state.impersonation).toBeNull();
  });

  it('handleSessionExpired logs out when not impersonating', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().handleSessionExpired();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.impersonation).toBeNull();
  });

  it('logout while impersonating clears the simulation snapshot too', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().impersonate(impersonatePayload);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.impersonation).toBeNull();
  });
});
