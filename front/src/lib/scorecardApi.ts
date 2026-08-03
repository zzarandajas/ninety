import { apiFetch } from './apiClient';

export type MetricComparison = 'gte' | 'lte' | 'eq';
export type MetricFrequency = 'weekly' | 'monthly';

export interface ScorecardMetric {
  id: string;
  tenantId: string;
  name: string;
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
  name: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive?: boolean;
}

export type UpdateMetricPayload = Partial<CreateMetricPayload>;

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

  listEntries: (weeks?: number) => apiFetch<ScorecardEntry[]>(`/scorecard/entries${buildQuery({ weeks })}`),

  upsertEntry: (metricId: string, periodStart: Date, actualValue: number) =>
    apiFetch<ScorecardEntry>('/scorecard/entries', {
      method: 'PUT',
      body: JSON.stringify({ metricId, periodStart: periodStart.toISOString(), actualValue }),
    }),
};
