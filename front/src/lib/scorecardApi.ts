import { apiFetch } from './apiClient';

export type MetricComparison = 'gte' | 'lte' | 'eq';
export type MetricFrequency = 'weekly' | 'monthly';

export interface ScorecardMetric {
  id: string;
  tenantId: string;
  code?: string | null;
  name: string;
  description: string | null;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive: boolean;
}

export interface ScorecardEntry {
  id: string;
  tenantId: string;
  metricId: string;
  periodStart: string;
  actualValue: number;
  enteredByUserId: string;
  enteredAt: string;
}

export interface CreateMetricPayload {
  code?: string | null;
  name: string;
  description?: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive?: boolean;
}

export type UpdateMetricPayload = Partial<Omit<CreateMetricPayload, 'description'>> & { description?: string | null };

export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const scorecardApi = {
  listMetrics: (filters: { isActive?: boolean } = {}) =>
    apiFetch<ScorecardMetric[]>(`/scorecard/metrics${buildQuery(filters)}`),

  createMetric: (payload: CreateMetricPayload) =>
    apiFetch<ScorecardMetric>('/scorecard/metrics', { method: 'POST', body: JSON.stringify(payload) }),

  updateMetric: (id: string, payload: UpdateMetricPayload) =>
    apiFetch<ScorecardMetric>(`/scorecard/metrics/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteMetric: (id: string) => apiFetch<void>(`/scorecard/metrics/${id}`, { method: 'DELETE' }),

  importMetrics: (csv: string) =>
    apiFetch<{ created: number }>('/scorecard/metrics/import', { method: 'POST', body: JSON.stringify({ csv }) }),

  importEntries: (csv: string) =>
    apiFetch<{ upserted: number }>('/scorecard/entries/import', { method: 'POST', body: JSON.stringify({ csv }) }),

  listEntries: (weeks?: number) => apiFetch<ScorecardEntry[]>(`/scorecard/entries${buildQuery({ weeks })}`),

  upsertEntry: (metricId: string, periodStart: Date, actualValue: number) =>
    apiFetch<ScorecardEntry>('/scorecard/entries', {
      method: 'PUT',
      body: JSON.stringify({ metricId, periodStart: periodStart.toISOString(), actualValue }),
    }),
};
