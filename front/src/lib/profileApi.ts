import { apiFetch } from './apiClient';
import type { AuthUser, TenantMembershipView } from '../store/authStore';

export interface ProfileUpdatePayload {
  fullName?: string;
}

export interface ProfileUpdateResponse {
  user: AuthUser;
  memberships: TenantMembershipView[];
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export const profileApi = {
  getMe: () => apiFetch<ProfileUpdateResponse>('/auth/me'),

  updateProfile: (payload: ProfileUpdatePayload) =>
    apiFetch<ProfileUpdateResponse>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: ChangePasswordPayload) =>
    apiFetch<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
