import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RockFormModal } from './RockFormModal';

vi.mock('../lib/rocksApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/rocksApi')>('../lib/rocksApi');
  return {
    ...actual,
    rocksApi: {
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      addMilestone: vi.fn(),
      toggleMilestone: vi.fn(),
      removeMilestone: vi.fn(),
    },
  };
});

const members = [{ userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'member' as const }];

describe('RockFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new rock with the entered fields', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(rocksApi.create).mockResolvedValue({ id: 'rock-1' } as never);
    const onSaved = vi.fn();

    render(<RockFormModal open rock={undefined} members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/título/i), 'Lanzar módulo de Scorecard');
    // ownerUserId is required with no default — quarter/dueDate get sensible
    // defaults on mount (current quarter, end of quarter) so the form is
    // submittable without touching the DatePicker in this test.
    await userEvent.click(screen.getByRole('combobox', { name: /owner/i }));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(rocksApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Lanzar módulo de Scorecard', ownerUserId: 'user-1' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows the milestones list and adds a new one when editing an existing rock', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(rocksApi.addMilestone).mockResolvedValue({
      id: 'milestone-1',
      rockId: 'rock-1',
      description: 'Diseñar el schema',
      dueDate: '2026-08-15T00:00:00.000Z',
      completedAt: null,
    } as never);

    const rock = {
      id: 'rock-1',
      tenantId: 'tenant-1',
      title: 'Lanzar módulo de Scorecard',
      description: null,
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: true,
      status: 'on_track' as const,
      createdAt: '2026-07-01T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      milestones: [],
    };

    render(<RockFormModal open rock={rock} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText(/milestones/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/descripción del milestone/i), 'Diseñar el schema');
    await userEvent.click(screen.getByRole('button', { name: /añadir milestone/i }));

    await waitFor(() =>
      expect(rocksApi.addMilestone).toHaveBeenCalledWith(
        'rock-1',
        expect.objectContaining({ description: 'Diseñar el schema' })
      )
    );
  });

  it('updates an existing rock with the edited fields', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(rocksApi.update).mockResolvedValue({ id: 'rock-1' } as never);
    const onSaved = vi.fn();

    const rock = {
      id: 'rock-1',
      tenantId: 'tenant-1',
      title: 'Lanzar módulo de Scorecard',
      description: null,
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: true,
      status: 'on_track' as const,
      createdAt: '2026-07-01T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      milestones: [],
    };

    render(<RockFormModal open rock={rock} members={members} onClose={vi.fn()} onSaved={onSaved} />);

    const titleInput = screen.getByLabelText(/título/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Lanzar módulo de Scorecard v2');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(rocksApi.update).toHaveBeenCalledWith(
        'rock-1',
        expect.objectContaining({ title: 'Lanzar módulo de Scorecard v2', status: 'on_track' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('toggles a milestone as completed and removes a milestone', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    const existingMilestone = {
      id: 'milestone-1',
      rockId: 'rock-1',
      description: 'Diseñar el schema',
      dueDate: '2026-08-15T00:00:00.000Z',
      completedAt: null,
    };
    vi.mocked(rocksApi.toggleMilestone).mockResolvedValue({
      ...existingMilestone,
      completedAt: '2026-08-16T00:00:00.000Z',
    } as never);
    vi.mocked(rocksApi.removeMilestone).mockResolvedValue(undefined as never);

    const rock = {
      id: 'rock-1',
      tenantId: 'tenant-1',
      title: 'Lanzar módulo de Scorecard',
      description: null,
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: true,
      status: 'on_track' as const,
      createdAt: '2026-07-01T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      milestones: [existingMilestone],
    };

    render(<RockFormModal open rock={rock} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(rocksApi.toggleMilestone).toHaveBeenCalledWith('rock-1', 'milestone-1', true));

    await userEvent.click(screen.getByRole('button', { name: /^borrar$/i }));
    await waitFor(() => expect(rocksApi.removeMilestone).toHaveBeenCalledWith('rock-1', 'milestone-1'));
  });

  it('deletes the rock after confirming and refreshes the board', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(rocksApi.remove).mockResolvedValue(undefined as never);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    const rock = {
      id: 'rock-1',
      tenantId: 'tenant-1',
      title: 'Lanzar módulo de Scorecard',
      description: null,
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: true,
      status: 'on_track' as const,
      createdAt: '2026-07-01T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      milestones: [],
    };

    render(<RockFormModal open rock={rock} members={members} onClose={onClose} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole('button', { name: /borrar rock/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^borrar$/i }));

    await waitFor(() => expect(rocksApi.remove).toHaveBeenCalledWith('rock-1'));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error message when saving fails', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(rocksApi.create).mockRejectedValue(new Error('Request failed'));

    render(<RockFormModal open rock={undefined} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/título/i), 'Lanzar módulo de Scorecard');
    await userEvent.click(screen.getByRole('combobox', { name: /owner/i }));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Request failed')).toBeInTheDocument();
  });
});
