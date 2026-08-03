import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembersTable } from './MembersTable';

vi.mock('../lib/membershipsApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/membershipsApi')>('../lib/membershipsApi');
  return {
    ...actual,
    membershipsApi: { update: vi.fn(), list: vi.fn(), invite: vi.fn(), resetPassword: vi.fn() },
  };
});

const membership = {
  id: 'mem-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'member' as const,
  seatId: null,
  isActive: true,
  getsIt: null,
  wantsIt: null,
  hasCapacity: null,
  user: { id: 'user-1', fullName: 'Ana Sales', email: 'ana@tasvalor.com', avatarUrl: null },
  seat: null,
};

const ownerMembership = {
  ...membership,
  id: 'mem-2',
  userId: 'user-2',
  role: 'owner' as const,
  user: { id: 'user-2', fullName: 'Luis Owner', email: 'luis@tasvalor.com', avatarUrl: null },
};

const seats = [
  { id: 'seat-1', tenantId: 'tenant-1', name: 'Ventas', parentSeatId: null, rolesAndResponsibilities: [], occupants: [] },
];

describe('MembersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('changing the role select calls membershipsApi.update with the new role', async () => {
    const { membershipsApi } = await import('../lib/membershipsApi');
    vi.mocked(membershipsApi.update).mockResolvedValue({} as never);
    const onChanged = vi.fn();

    render(<MembersTable memberships={[membership]} seats={seats} canManage canResetOwner onChanged={onChanged} />);

    const [roleSelect] = screen.getAllByRole('combobox');
    await userEvent.click(roleSelect);
    await userEvent.click(await screen.findByText('Admin'));

    await waitFor(() => expect(membershipsApi.update).toHaveBeenCalledWith('mem-1', { role: 'admin' }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('toggling the active switch calls membershipsApi.update with isActive:false', async () => {
    const { membershipsApi } = await import('../lib/membershipsApi');
    vi.mocked(membershipsApi.update).mockResolvedValue({} as never);

    render(<MembersTable memberships={[membership]} seats={seats} canManage canResetOwner onChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(membershipsApi.update).toHaveBeenCalledWith('mem-1', { isActive: false }));
  });

  it('disables the controls when the viewer cannot manage members', () => {
    render(<MembersTable memberships={[membership]} seats={seats} canManage={false} canResetOwner={false} onChanged={vi.fn()} />);

    const [roleSelect] = screen.getAllByRole('combobox');
    expect(roleSelect.closest('.ant-select')).toHaveClass('ant-select-disabled');
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('button', { name: /resetear/i })).toBeDisabled();
  });

  it('disables the reset button for an owner when the caller cannot reset owners', () => {
    render(<MembersTable memberships={[ownerMembership]} seats={seats} canManage canResetOwner={false} onChanged={vi.fn()} />);

    expect(screen.getByRole('button', { name: /resetear/i })).toBeDisabled();
  });

  it('enables the reset button for an owner when the caller is an owner', () => {
    render(<MembersTable memberships={[ownerMembership]} seats={seats} canManage canResetOwner onChanged={vi.fn()} />);

    expect(screen.getByRole('button', { name: /resetear/i })).toBeEnabled();
  });

  it('resets a member password and shows the temporary password', async () => {
    const { membershipsApi } = await import('../lib/membershipsApi');
    vi.mocked(membershipsApi.resetPassword).mockResolvedValue({
      userId: 'user-1',
      email: 'ana@tasvalor.com',
      fullName: 'Ana Sales',
      temporaryPassword: 'Tmp123456789',
      mustChangePassword: true,
    } as never);
    const onChanged = vi.fn();

    render(<MembersTable memberships={[membership]} seats={seats} canManage canResetOwner onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: /resetear/i }));

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText((content) => content.includes('¿Seguro que quieres resetear la contraseña de'))
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Ana Sales')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Resetear' }));

    await waitFor(() => expect(membershipsApi.resetPassword).toHaveBeenCalledWith('mem-1'));
    expect(onChanged).toHaveBeenCalled();

    const resultDialog = screen.getByRole('dialog');
    expect(within(resultDialog).getByText('Tmp123456789')).toBeInTheDocument();
  });
});
