import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('scorecardApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listMetrics builds the query string only from provided filters', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.listMetrics({ isActive: true });

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/metrics?isActive=true');
  });

  it('listMetrics serializes isActive:false as the literal string "false"', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.listMetrics({ isActive: false });

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/metrics?isActive=false');
  });

  it('listMetrics with no filters calls the bare endpoint', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.listMetrics();

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/metrics');
  });

  it('listEntries includes the weeks query param when provided', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.listEntries(12);

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/entries?weeks=12');
  });

  it('upsertEntry PUTs the payload as JSON with an ISO periodStart', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'entry-1' });

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.upsertEntry('metric-1', new Date('2026-07-13T00:00:00.000Z'), 12);

    expect(apiFetch).toHaveBeenCalledWith(
      '/scorecard/entries',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ metricId: 'metric-1', periodStart: '2026-07-13T00:00:00.000Z', actualValue: 12 }),
      })
    );
  });

  it('deleteMetric DELETEs the metric', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.deleteMetric('metric-1');

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/metrics/metric-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
