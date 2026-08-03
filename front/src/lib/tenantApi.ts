import { apiFetch } from './apiClient';

export interface TenantMember {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role: 'owner' | 'admin' | 'member';
}

export interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  fiscalYearStartMonth: number;
  logoUrl: string | null;
  isotypeUrl: string | null;
  bgColor: string | null;
  accentColor: string | null;
}

export const tenantApi = {
  listMembers: () => apiFetch<TenantMember[]>('/tenant/members'),
  getSettings: () => apiFetch<TenantSettings>('/tenant/settings'),
  updateSettings: (patch: {
    name?: string;
    bgColor?: string | null;
    accentColor?: string | null;
    timezone?: string;
    fiscalYearStartMonth?: number;
  }) =>
    apiFetch<TenantSettings>('/tenant/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return apiFetch<{ logoUrl: string }>('/tenant/logo', {
      method: 'POST',
      body: formData,
    });
  },
  uploadIsotype: (file: File) => {
    const formData = new FormData();
    formData.append('isotype', file);
    return apiFetch<{ isotypeUrl: string }>('/tenant/isotype', {
      method: 'POST',
      body: formData,
    });
  },
};
