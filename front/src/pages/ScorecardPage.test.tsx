import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScorecardEntry } from '../lib/scorecardApi';
import { lastNMondays } from '../lib/weeks';
import { useAuthStore } from '../store/authStore';
import { ScorecardPage } from './ScorecardPage';

vi.mock('../lib/scorecardApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/scorecardApi')>('../lib/scorecardApi');
  return {
    ...actual,
    scorecardApi: {
      listMetrics: vi.fn(),
      listEntries: vi.fn(),
      upsertEntry: vi.fn(),
      createMetric: vi.fn(),
      updateMetric: vi.fn(),
      deleteMetric: vi.fn(),
    },
  };
});

vi.mock('../lib/tenantApi', () => ({
  tenantApi: { listMembers: vi.fn() },
}));

const metrics = [
  {
    id: 'metric-1',
    tenantId: 'tenant-1',
    name: 'Nº leads cualificados/semana',
    ownerUserId: 'user-1',
    goalValue: 10,
    comparison: 'gte' as const,
    frequency: 'weekly' as const,
    unit: '#',
    isActive: true,
  },
];

describe('ScorecardPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    const { scorecardApi } = await import('../lib/scorecardApi');
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(scorecardApi.listMetrics).mockResolvedValue(metrics as never);
    vi.mocked(scorecardApi.listEntries).mockResolvedValue([]);
    vi.mocked(tenantApi.listMembers).mockResolvedValue([
      { userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'member' as const },
    ]);
  });

  it('renders one row per active metric with the last 12 week columns', async () => {
    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());
    expect(screen.getAllByRole('spinbutton')).toHaveLength(12);
  });

  it('saves a cell value on blur and refetches entries', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.upsertEntry).mockResolvedValue({
      id: 'entry-1',
      tenantId: 'tenant-1',
      metricId: 'metric-1',
      periodStart: '2026-07-13T00:00:00.000Z',
      actualValue: 12,
      enteredByUserId: 'user-1',
      enteredAt: '2026-07-13T10:00:00.000Z',
    } as never);

    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());

    const cells = screen.getAllByRole('spinbutton');
    await userEvent.type(cells[cells.length - 1], '12');
    await userEvent.tab();

    await waitFor(() => expect(scorecardApi.upsertEntry).toHaveBeenCalledWith('metric-1', expect.any(Date), 12));
  });

  it('renders a saved value in its cell even when entries resolve after metrics have already mounted the grid', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');

    let resolveEntries!: (value: ScorecardEntry[]) => void;
    vi.mocked(scorecardApi.listEntries).mockImplementation(
      () =>
        new Promise<ScorecardEntry[]>((resolve) => {
          resolveEntries = resolve;
        })
    );

    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    // Metrics resolve and the table mounts its rows/cells before entries do.
    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());

    const weekIndex = lastNMondays(12).findIndex((week) => week.toISOString() === '2026-07-13T00:00:00.000Z');
    expect(weekIndex).toBeGreaterThanOrEqual(0);

    // Entries resolve only now, after the cells already mounted with entry === undefined.
    resolveEntries([
      {
        id: 'entry-1',
        tenantId: 'tenant-1',
        metricId: 'metric-1',
        periodStart: '2026-07-13T00:00:00.000Z',
        actualValue: 12,
        enteredByUserId: 'user-1',
        enteredAt: '2026-07-13T10:00:00.000Z',
      },
    ]);

    await waitFor(() => {
      const cells = screen.getAllByRole('spinbutton');
      expect(cells[weekIndex]).toHaveValue('12');
    });
  });

  it('renders a trend sparkline column for each metric', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.listEntries).mockResolvedValue([
      {
        id: 'entry-1',
        tenantId: 'tenant-1',
        metricId: 'metric-1',
        periodStart: '2026-07-13T00:00:00.000Z',
        actualValue: 12,
        enteredByUserId: 'user-1',
        enteredAt: '2026-07-13T10:00:00.000Z',
      },
    ] as never);

    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());
    expect(screen.getByTestId('trend-metric-1')).toBeInTheDocument();
  });

  it('opens the modal in edit mode with the clicked metric data when its name is clicked', async () => {
    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Nº leads cualificados/semana'));

    expect(await screen.findByText('Editar Métrica Scorecard')).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Nº leads cualificados/semana');
  });

  it('refetches the metric list when the modal reports a save', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(scorecardApi.listMetrics).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByText('Nº leads cualificados/semana'));
    expect(await screen.findByText('Editar Métrica Scorecard')).toBeInTheDocument();

    vi.mocked(scorecardApi.updateMetric).mockResolvedValue({ id: 'metric-1' } as never);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(scorecardApi.listMetrics).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Editar Métrica Scorecard')).not.toBeInTheDocument());
  });

  it('opens the modal in create mode when "Nueva métrica" is clicked', async () => {
    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /nueva métrica/i }));

    expect(await screen.findByText('Nueva Métrica Scorecard')).toBeInTheDocument();
  });

  it('refetches members when the active tenant changes', async () => {
    const { tenantApi } = await import('../lib/tenantApi');

    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(tenantApi.listMembers).toHaveBeenCalledTimes(1));

    useAuthStore.setState({ activeTenantId: 'tenant-2' });

    await waitFor(() => expect(tenantApi.listMembers).toHaveBeenCalledTimes(2));
  });

  it('lists metrics with no isActive filter when "Mostrar inactivas" is toggled on', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');

    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(scorecardApi.listMetrics).toHaveBeenCalledTimes(1));
    expect(scorecardApi.listMetrics).toHaveBeenLastCalledWith({ isActive: true });

    await userEvent.click(screen.getByRole('switch', { name: /mostrar inactivas/i }));

    await waitFor(() => expect(scorecardApi.listMetrics).toHaveBeenCalledTimes(2));
    expect(scorecardApi.listMetrics).toHaveBeenLastCalledWith({});
  });
});
