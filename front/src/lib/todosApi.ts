import { apiFetch } from './apiClient';

export type TodoStatus = 'open' | 'done';

export interface Todo {
  id: string;
  tenantId: string;
  quarter: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  dueDate: string | null;
  status: TodoStatus;
  originatingMeetingId: string | null;
}

export interface TodoFilters {
  status?: TodoStatus;
  ownerUserId?: string;
  quarter?: string;
}

export interface CreateTodoPayload {
  title: string;
  description?: string;
  ownerUserId: string;
  quarter: string;
  dueDate?: string;
  originatingMeetingId?: string;
}

export type UpdateTodoPayload = Partial<{
  title: string;
  description: string | null;
  ownerUserId: string;
  quarter: string;
  dueDate: string | null;
  status: TodoStatus;
}>;

function buildQuery(filters: TodoFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.ownerUserId) params.set('ownerUserId', filters.ownerUserId);
  if (filters.quarter) params.set('quarter', filters.quarter);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const todosApi = {
  list: (filters: TodoFilters = {}) => apiFetch<Todo[]>(`/todos${buildQuery(filters)}`),

  create: (payload: CreateTodoPayload) => apiFetch<Todo>('/todos', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: UpdateTodoPayload) =>
    apiFetch<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  remove: (id: string) => apiFetch<void>(`/todos/${id}`, { method: 'DELETE' }),
};
