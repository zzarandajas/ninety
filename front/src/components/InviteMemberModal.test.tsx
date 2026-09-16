import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteMemberModal } from './InviteMemberModal';

vi.mock('../lib/membershipsApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/membershipsApi')>('../lib/membershipsApi');
  return {
    ...actual,
    membershipsApi: { invite: vi.fn(), list: vi.fn(), update: vi.fn() },
  };
});

describe('InviteMemberModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the temporary password after inviting a brand-new user', async () => {
    const { membershipsApi } = await import('../lib/membershipsApi');
    vi.mocked(membershipsApi.invite).mockResolvedValue({
      membershipId: 'mem-1',
      userId: 'user-1',
      email: 'nuevo@tasvalor.com',
      fullName: 'Nuevo',
      role: 'member',
      temporaryPassword: 'Xk1234567890',
    });
    const onInvited = vi.fn();

    render(<InviteMemberModal open canGrantOwner={false} onClose={vi.fn()} onInvited={onInvited} />);

    await userEvent.type(screen.getByLabelText(/correo/i), 'nuevo@tasvalor.com');
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Nuevo');
    await userEvent.click(screen.getByRole('button', { name: /invitar/i }));

    expect(await screen.findByText('Xk1234567890')).toBeInTheDocument();
    expect(membershipsApi.invite).toHaveBeenCalledWith({
      email: 'nuevo@tasvalor.com',
      fullName: 'Nuevo',
      role: 'member',
    });
    expect(onInvited).toHaveBeenCalled();
  });

  it('does not show a password when the invited email already had an account', async () => {
    const { membershipsApi } = await import('../lib/membershipsApi');
    vi.mocked(membershipsApi.invite).mockResolvedValue({
      membershipId: 'mem-2',
      userId: 'user-existing',
      email: 'existing@tasvalor.com',
      fullName: 'Existing',
      role: 'member',
      temporaryPassword: null,
    });

    render(<InviteMemberModal open canGrantOwner={false} onClose={vi.fn()} onInvited={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/correo/i), 'existing@tasvalor.com');
    await userEvent.type(screen.getByLabelText(/nombre completo/i), 'Existing');
    await userEvent.click(screen.getByRole('button', { name: /invitar/i }));

    expect(await screen.findByText(/ya dispone de cuenta previa/i)).toBeInTheDocument();
  });

  it('disables the owner role option when the viewer cannot grant it', async () => {
    render(<InviteMemberModal open canGrantOwner={false} onClose={vi.fn()} onInvited={vi.fn()} />);

    const [roleSelect] = screen.getAllByRole('combobox');
    await userEvent.click(roleSelect);

    // rc-select's accessible "option" role mirror omits disabled entries entirely;
    // the real (visible) item only exposes disabled state via this class.
    const ownerOption = await screen.findByTitle('Propietario / Owner');
    expect(ownerOption).toHaveClass('ant-select-item-option-disabled');
  });
});
