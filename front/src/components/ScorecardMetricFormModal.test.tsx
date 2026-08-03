import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScorecardMetricFormModal } from './ScorecardMetricFormModal';

vi.mock('../lib/scorecardApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/scorecardApi')>('../lib/scorecardApi');
  return {
    ...actual,
    scorecardApi: { createMetric: vi.fn(), updateMetric: vi.fn(), deleteMetric: vi.fn() },
  };
});

const members = [{ userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'member' as const }];

describe('ScorecardMetricFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new metric with the entered fields', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.createMetric).mockResolvedValue({ id: 'metric-1' } as never);
    const onSaved = vi.fn();

    render(<ScorecardMetricFormModal open metric={undefined} members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Nº leads cualificados/semana');
    await userEvent.click(screen.getByRole('combobox', { name: /owner/i }));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.type(screen.getByLabelText(/objetivo/i), '10');
    await userEvent.type(screen.getByLabelText(/unidad/i), '#');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(scorecardApi.createMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nº leads cualificados/semana', ownerUserId: 'user-1', goalValue: 10, unit: '#' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('pre-fills all fields including the isActive switch when editing', async () => {
    const metric = {
      id: 'metric-1',
      tenantId: 'tenant-1',
      name: 'Nº leads cualificados/semana',
      ownerUserId: 'user-1',
      goalValue: 10,
      comparison: 'gte' as const,
      frequency: 'weekly' as const,
      unit: '#',
      isActive: true,
    };

    render(<ScorecardMetricFormModal open metric={metric} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByLabelText(/nombre/i)).toHaveValue('Nº leads cualificados/semana');
    expect(screen.getByLabelText(/objetivo/i)).toHaveValue('10');
    expect(screen.getByLabelText(/unidad/i)).toHaveValue('#');
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('updates an existing metric with the edited fields', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.updateMetric).mockResolvedValue({ id: 'metric-1' } as never);
    const onSaved = vi.fn();

    const metric = {
      id: 'metric-1',
      tenantId: 'tenant-1',
      name: 'Nº leads cualificados/semana',
      ownerUserId: 'user-1',
      goalValue: 10,
      comparison: 'gte' as const,
      frequency: 'weekly' as const,
      unit: '#',
      isActive: true,
    };

    render(<ScorecardMetricFormModal open metric={metric} members={members} onClose={vi.fn()} onSaved={onSaved} />);

    const nameInput = await screen.findByLabelText(/nombre/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Nº leads cualificados/semana v2');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(scorecardApi.updateMetric).toHaveBeenCalledWith(
        'metric-1',
        expect.objectContaining({ name: 'Nº leads cualificados/semana v2' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('does not show a delete button when creating a new metric', () => {
    render(<ScorecardMetricFormModal open metric={undefined} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /borrar métrica/i })).not.toBeInTheDocument();
  });

  it('shows a delete button only when editing, and deletes on confirm', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.deleteMetric).mockResolvedValue(undefined);
    const onSaved = vi.fn();

    const metric = {
      id: 'metric-1',
      tenantId: 'tenant-1',
      name: 'Nº leads cualificados/semana',
      ownerUserId: 'user-1',
      goalValue: 10,
      comparison: 'gte' as const,
      frequency: 'weekly' as const,
      unit: '#',
      isActive: true,
    };

    render(<ScorecardMetricFormModal open metric={metric} members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole('button', { name: /borrar métrica/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^borrar$/i }));

    await waitFor(() => expect(scorecardApi.deleteMetric).toHaveBeenCalledWith('metric-1'));
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows an error message when saving fails', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.createMetric).mockRejectedValue(new Error('Request failed'));

    render(<ScorecardMetricFormModal open metric={undefined} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Nº leads cualificados/semana');
    await userEvent.click(screen.getByRole('combobox', { name: /owner/i }));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.type(screen.getByLabelText(/objetivo/i), '10');
    await userEvent.type(screen.getByLabelText(/unidad/i), '#');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Request failed')).toBeInTheDocument();
  });
});
