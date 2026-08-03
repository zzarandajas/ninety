import { apiFetch } from './apiClient';
import type { AuthUser, TenantMembershipView } from '../store/authStore';

export interface ImpersonatableUserMembership {
  tenantId: string;
  tenantName: string;
  role: 'owner' | 'admin' | 'member';
}

export interface ImpersonatableUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  memberships: ImpersonatableUserMembership[];
}

export interface ImpersonateResult {
  token: string;
  user: AuthUser;
  memberships: TenantMembershipView[];
}

export const impersonateApi = {
  listUsers: () => apiFetch<ImpersonatableUser[]>('/admin/impersonate/users'),

  impersonate: (userId: string) =>
    apiFetch<ImpersonateResult>('/admin/impersonate', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};
