import { apiFetch } from './apiClient';

export interface Quarter {
  id: string;
  tenantId: string;
  label: string;
  startDate: string;
  endDate: string;
  theme: string | null;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
  rockCount: number;
  openRockCount: number;
}

export interface CreateQuarterPayload {
  label: string;
  startDate: string;
  endDate: string;
  theme?: string | null;
  rolloverFromLabel?: string;
}

export interface CreatedQuarter extends Quarter {
  movedRockCount: number;
}

export const quartersApi = {
  list: () => apiFetch<Quarter[]>('/quarters'),

  create: (payload: CreateQuarterPayload) =>
    apiFetch<CreatedQuarter>('/quarters', { method: 'POST', body: JSON.stringify(payload) }),

  update: (
    id: string,
    payload: Partial<Pick<Quarter, 'theme' | 'startDate' | 'endDate' | 'isOpen'>>
  ) => apiFetch<Quarter>(`/quarters/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
};
