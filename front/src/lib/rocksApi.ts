import { apiFetch } from './apiClient';

export type RockStatus = 'on_track' | 'off_track' | 'done';

export interface Milestone {
  id: string;
  rockId: string;
  description: string;
  dueDate: string;
  completedAt: string | null;
}

export interface Rock {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  quarter: string;
  isCompanyRock: boolean;
  status: RockStatus;
  createdAt: string;
  dueDate: string;
  milestones: Milestone[];
}

export interface RockFilters {
  quarter?: string;
  ownerUserId?: string;
}

export interface CreateRockPayload {
  title: string;
  description?: string;
  ownerUserId: string;
  quarter: string;
  isCompanyRock: boolean;
  dueDate: string;
}

export type UpdateRockPayload = Partial<CreateRockPayload> & { status?: RockStatus };

function buildQuery(filters: RockFilters): string {
  const params = new URLSearchParams();
  if (filters.quarter) params.set('quarter', filters.quarter);
  if (filters.ownerUserId) params.set('ownerUserId', filters.ownerUserId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const rocksApi = {
  list: (filters: RockFilters = {}) => apiFetch<Rock[]>(`/rocks${buildQuery(filters)}`),

  create: (payload: CreateRockPayload) =>
    apiFetch<Rock>('/rocks', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: UpdateRockPayload) =>
    apiFetch<Rock>(`/rocks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  remove: (id: string) => apiFetch<void>(`/rocks/${id}`, { method: 'DELETE' }),

  addMilestone: (rockId: string, payload: { description: string; dueDate: string }) =>
    apiFetch<Milestone>(`/rocks/${rockId}/milestones`, { method: 'POST', body: JSON.stringify(payload) }),

  toggleMilestone: (rockId: string, milestoneId: string, completed: boolean) =>
    apiFetch<Milestone>(`/rocks/${rockId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  removeMilestone: (rockId: string, milestoneId: string) =>
    apiFetch<void>(`/rocks/${rockId}/milestones/${milestoneId}`, { method: 'DELETE' }),
};
