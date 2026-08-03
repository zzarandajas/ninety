import { apiFetch } from './apiClient';

export type TenantRole = 'owner' | 'admin' | 'member';

export interface Membership {
  id: string;
  userId: string;
  tenantId: string;
  role: TenantRole;
  seatId: string | null;
  isActive: boolean;
  getsIt: boolean | null;
  wantsIt: boolean | null;
  hasCapacity: boolean | null;
  user: { id: string; fullName: string; email: string; avatarUrl: string | null };
  seat: { id: string; name: string } | null;
}

export interface InviteMemberPayload {
  email: string;
  fullName: string;
  role: TenantRole;
}

export interface InviteMemberResult {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  role: TenantRole;
  temporaryPassword: string | null;
}

export interface MembershipPatchPayload {
  role?: TenantRole;
  seatId?: string | null;
  isActive?: boolean;
  getsIt?: boolean | null;
  wantsIt?: boolean | null;
  hasCapacity?: boolean | null;
}

export interface ResetPasswordResult {
  userId: string;
  email: string;
  fullName: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
}

export const membershipsApi = {
  list: () => apiFetch<Membership[]>('/members'),

  invite: (payload: InviteMemberPayload) =>
    apiFetch<InviteMemberResult>('/members/invite', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: MembershipPatchPayload) =>
    apiFetch<Membership>(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  resetPassword: (id: string) =>
    apiFetch<ResetPasswordResult>(`/members/${id}/reset-password`, { method: 'POST' }),
};
