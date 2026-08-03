import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TenantMembershipView {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
  logoUrl?: string | null;
  isotypeUrl?: string | null;
  bgColor?: string | null;
  accentColor?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  avatarUrl: string | null;
}

interface LoginPayload {
  token: string;
  user: AuthUser;
  memberships: TenantMembershipView[];
}

interface ImpersonationSnapshot {
  token: string;
  user: AuthUser;
  tenants: TenantMembershipView[];
  activeTenantId: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  tenants: TenantMembershipView[];
  activeTenantId: string | null;
  impersonation: ImpersonationSnapshot | null;
  login: (payload: LoginPayload) => void;
  logout: () => void;
  setActiveTenant: (tenantId: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  updateActiveTenantBranding: (patch: {
    name?: string;
    logoUrl?: string | null;
    isotypeUrl?: string | null;
    bgColor?: string | null;
    accentColor?: string | null;
  }) => void;
  impersonate: (payload: LoginPayload) => void;
  stopImpersonation: () => void;
  handleSessionExpired: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenants: [],
      activeTenantId: null,
      impersonation: null,
      login: ({ token, user, memberships }) =>
        set({
          token,
          user,
          tenants: memberships,
          activeTenantId: memberships[0]?.tenantId ?? null,
          impersonation: null,
        }),
      logout: () =>
        set({ token: null, user: null, tenants: [], activeTenantId: null, impersonation: null }),
      setActiveTenant: (tenantId) => set({ activeTenantId: tenantId }),
      impersonate: (payload) =>
        set((state) => {
          if (state.impersonation || !state.token || !state.user) return state;
          return {
            impersonation: {
              token: state.token,
              user: state.user,
              tenants: state.tenants,
              activeTenantId: state.activeTenantId,
            },
            token: payload.token,
            user: payload.user,
            tenants: payload.memberships,
            activeTenantId: payload.memberships[0]?.tenantId ?? null,
          };
        }),
      stopImpersonation: () =>
        set((state) => {
          if (!state.impersonation) return state;
          const { token, user, tenants, activeTenantId } = state.impersonation;
          return { token, user, tenants, activeTenantId, impersonation: null };
        }),
      handleSessionExpired: () => {
        const state = useAuthStore.getState();
        if (state.impersonation) state.stopImpersonation();
        else state.logout();
      },
      updateUser: (patch) =>
        set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),
      updateActiveTenantBranding: (patch) =>
        set((state) => ({
          tenants: state.tenants.map((t) =>
            t.tenantId === state.activeTenantId
              ? {
                  ...t,
                  ...(patch.name ? { tenantName: patch.name } : {}),
                  ...(patch.logoUrl !== undefined ? { logoUrl: patch.logoUrl } : {}),
                  ...(patch.isotypeUrl !== undefined ? { isotypeUrl: patch.isotypeUrl } : {}),
                  ...(patch.bgColor !== undefined ? { bgColor: patch.bgColor } : {}),
                  ...(patch.accentColor !== undefined ? { accentColor: patch.accentColor } : {}),
                }
              : t
          ),
        })),
    }),
    { name: 'traction-tool-auth' }
  )
);
