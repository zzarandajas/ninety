import { apiFetch } from './apiClient';
import type { InviteMemberPayload, InviteMemberResult, Membership, MembershipPatchPayload } from './membershipsApi';

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  fiscalYearStartMonth: number;
  logoUrl?: string | null;
  isotypeUrl?: string | null;
  bgColor?: string | null;
  accentColor?: string | null;
  createdAt: string;
  _count?: {
    memberships: number;
  };
}

export interface CreateTenantPayload {
  name: string;
  slug?: string;
  timezone?: string;
  fiscalYearStartMonth?: number;
  bgColor?: string | null;
  accentColor?: string | null;
}

export interface AdminUserMembership {
  id: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'member';
  isActive: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  memberships: AdminUserMembership[];
}

export const adminApi = {
  listTenants: () => apiFetch<AdminTenant[]>('/admin/tenants'),

  createTenant: (payload: CreateTenantPayload) =>
    apiFetch<AdminTenant>('/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTenant: (tenantId: string, payload: Partial<CreateTenantPayload>) =>
    apiFetch<AdminTenant>(`/admin/tenants/${tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  uploadTenantLogo: (tenantId: string, file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return apiFetch<{ logoUrl: string }>(`/admin/tenants/${tenantId}/logo`, {
      method: 'POST',
      body: formData,
    });
  },

  uploadTenantIsotype: (tenantId: string, file: File) => {
    const formData = new FormData();
    formData.append('isotype', file);
    return apiFetch<{ isotypeUrl: string }>(`/admin/tenants/${tenantId}/isotype`, {
      method: 'POST',
      body: formData,
    });
  },

  listTenantMembers: (tenantId: string) =>
    apiFetch<Membership[]>(`/admin/tenants/${tenantId}/members`),

  addTenantMember: (tenantId: string, payload: InviteMemberPayload) =>
    apiFetch<InviteMemberResult>(`/admin/tenants/${tenantId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMembership: (membershipId: string, payload: MembershipPatchPayload) =>
    apiFetch<Membership>(`/admin/memberships/${membershipId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listUsers: () => apiFetch<AdminUser[]>('/admin/users'),
};
