import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ChangePasswordPage } from './ChangePasswordPage';

vi.mock('../lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const baseUser = {
  id: 'user-1',
  email: 'me@example.com',
  fullName: 'Me',
  mustChangePassword: true,
  avatarUrl: null,
};

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().login({
      token: 'jwt-token',
      user: baseUser,
      memberships: [{ tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });
    vi.clearAllMocks();
  });

  it('submits current and new password, then clears mustChangePassword on success', async () => {
    const { apiFetch } = await import('../lib/apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <ChangePasswordPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/contraseña actual/i), 'changeme123');
    await userEvent.type(screen.getByLabelText(/^nueva contraseña$/i), 'NewSecret123');
    await userEvent.type(screen.getByLabelText(/confirma la nueva contraseña/i), 'NewSecret123');
    await userEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    await vi.waitFor(() => expect(useAuthStore.getState().user?.mustChangePassword).toBe(false));
  });

  it('shows an error if the new password and confirmation do not match', async () => {
    render(
      <MemoryRouter>
        <ChangePasswordPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/contraseña actual/i), 'changeme123');
    await userEvent.type(screen.getByLabelText(/^nueva contraseña$/i), 'NewSecret123');
    await userEvent.type(screen.getByLabelText(/confirma la nueva contraseña/i), 'Different123');
    await userEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
  });
});
