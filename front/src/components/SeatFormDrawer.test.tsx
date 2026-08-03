import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeatFormDrawer } from './SeatFormDrawer';

vi.mock('../lib/seatsApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/seatsApi')>('../lib/seatsApi');
  return { ...actual, seatsApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn(), list: vi.fn() } };
});
vi.mock('../lib/membershipsApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/membershipsApi')>('../lib/membershipsApi');
  return { ...actual, membershipsApi: { update: vi.fn(), list: vi.fn(), invite: vi.fn() } };
});

const ceoSeat = {
  id: 'seat-ceo',
  tenantId: 'tenant-1',
  name: 'CEO',
  parentSeatId: null,
  rolesAndResponsibilities: ['Visión'],
  occupants: [
    {
      id: 'mem-1',
      role: 'owner' as const,
      seatId: 'seat-ceo',
      getsIt: null,
      wantsIt: null,
      hasCapacity: null,
      user: { id: 'user-1', fullName: 'Pablo', email: 'pablo@tasvalor.com', avatarUrl: null },
    },
  ],
};

const vacantSeat = {
  id: 'seat-sales',
  tenantId: 'tenant-1',
  name: 'Ventas',
  parentSeatId: 'seat-ceo',
  rolesAndResponsibilities: [],
  occupants: [],
};

const availableMembership = {
  id: 'mem-2',
  userId: 'user-2',
  tenantId: 'tenant-1',
  role: 'member' as const,
  seatId: null,
  isActive: true,
  getsIt: null,
  wantsIt: null,
  hasCapacity: null,
  user: { id: 'user-2', fullName: 'Ana', email: 'ana@tasvalor.com', avatarUrl: null },
  seat: null,
};

describe('SeatFormDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new seat with the entered name', async () => {
    const { seatsApi } = await import('../lib/seatsApi');
    vi.mocked(seatsApi.create).mockResolvedValue({} as never);
    const onSaved = vi.fn();

    render(
      <SeatFormDrawer
        open
        seat="new"
        seats={[ceoSeat]}
        memberships={[availableMembership]}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Operaciones');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(seatsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Operaciones', parentSeatId: null })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('assigns an available member to a vacant seat', async () => {
    const { membershipsApi } = await import('../lib/membershipsApi');
    vi.mocked(membershipsApi.update).mockResolvedValue({} as never);
    const onSaved = vi.fn();

    render(
      <SeatFormDrawer
        open
        seat={vacantSeat}
        seats={[ceoSeat, vacantSeat]}
        memberships={[availableMembership]}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    const assignSelect = screen.getByRole('combobox', { name: /asignar persona/i });
    await userEvent.click(assignSelect);
    await userEvent.click(await screen.findByText('Ana'));
    await userEvent.click(screen.getByRole('button', { name: /asignar a este seat/i }));

    await waitFor(() => expect(membershipsApi.update).toHaveBeenCalledWith('mem-2', { seatId: 'seat-sales' }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('unassigns the current occupant', async () => {
    const { membershipsApi } = await import('../lib/membershipsApi');
    vi.mocked(membershipsApi.update).mockResolvedValue({} as never);

    render(
      <SeatFormDrawer
        open
        seat={ceoSeat}
        seats={[ceoSeat]}
        memberships={[availableMembership]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /desasignar/i }));

    await waitFor(() => expect(membershipsApi.update).toHaveBeenCalledWith('mem-1', { seatId: null }));
  });

  it('deletes the seat after confirming', async () => {
    const { seatsApi } = await import('../lib/seatsApi');
    vi.mocked(seatsApi.remove).mockResolvedValue(undefined as never);
    const onClose = vi.fn();
    const onSaved = vi.fn();

    render(
      <SeatFormDrawer
        open
        seat={vacantSeat}
        seats={[ceoSeat, vacantSeat]}
        memberships={[]}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /borrar este seat/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^borrar$/i }));

    await waitFor(() => expect(seatsApi.remove).toHaveBeenCalledWith('seat-sales'));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error message when the delete is blocked by the backend', async () => {
    const { seatsApi } = await import('../lib/seatsApi');
    vi.mocked(seatsApi.remove).mockRejectedValue(new Error('Reassign the occupant before deleting this seat'));

    render(
      <SeatFormDrawer open seat={ceoSeat} seats={[ceoSeat]} memberships={[]} onClose={vi.fn()} onSaved={vi.fn()} />
    );

    await userEvent.click(screen.getByRole('button', { name: /borrar este seat/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^borrar$/i }));

    expect(await screen.findByText('Reassign the occupant before deleting this seat')).toBeInTheDocument();
  });
});
