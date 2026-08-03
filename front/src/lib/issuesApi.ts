import { apiFetch } from './apiClient';

export type IssueStatus = 'open' | 'discussing' | 'solved' | 'dropped';
export type IssuePriority = 'low' | 'medium' | 'high';

export interface Issue {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  raisedByUserId: string;
  status: IssueStatus;
  priority: IssuePriority;
  sortOrder: number;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

export interface IssueFilters {
  status?: IssueStatus;
}

export interface CreateIssuePayload {
  title: string;
  description?: string;
  raisedByUserId: string;
  priority: IssuePriority;
}

export type UpdateIssuePayload = Partial<CreateIssuePayload> & {
  status?: IssueStatus;
  resolutionNotes?: string | null;
};

function buildQuery(filters: IssueFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const issuesApi = {
  list: (filters: IssueFilters = {}) => apiFetch<Issue[]>(`/issues${buildQuery(filters)}`),

  create: (payload: CreateIssuePayload) =>
    apiFetch<Issue>('/issues', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: UpdateIssuePayload) =>
    apiFetch<Issue>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  remove: (id: string) => apiFetch<void>(`/issues/${id}`, { method: 'DELETE' }),

  reorder: (orderedIds: string[]) =>
    apiFetch<Issue[]>('/issues/reorder', { method: 'PATCH', body: JSON.stringify({ orderedIds }) }),
};
