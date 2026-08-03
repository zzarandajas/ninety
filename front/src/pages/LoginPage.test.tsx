import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LoginPage } from './LoginPage';

vi.mock('../lib/apiClient', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message);
    }
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    vi.clearAllMocks();
  });

  it('shows a validation error when submitting an empty form', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText(/introduce tu email/i)).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight, then logs in', async () => {
    const { apiFetch } = await import('../lib/apiClient');
    let resolveLogin: (value: unknown) => void = () => {};
    vi.mocked(apiFetch).mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'me@example.com');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'supersecret123');
    const submitButton = screen.getByRole('button', { name: /entrar/i });
    await userEvent.click(submitButton);

    expect(submitButton).toBeDisabled();

    resolveLogin({
      token: 'jwt-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Me', mustChangePassword: false, avatarUrl: null },
      memberships: [{ tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });

    await vi.waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-token'));
  });

  it('shows a human-readable error on invalid credentials', async () => {
    const { apiFetch } = await import('../lib/apiClient');
    const { ApiError } = await import('../lib/apiClient');
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(401, 'Invalid email or password'));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'me@example.com');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/email o contraseña incorrectos/i)).toBeInTheDocument();
  });
});
