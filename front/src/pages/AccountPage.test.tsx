import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AccountPage } from './AccountPage';

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        id: 'user-1',
        email: 'pablo@tasvalor.com',
        fullName: 'Pablo Test',
        mustChangePassword: false,
        avatarUrl: null,
      },
      tenants: [
        { tenantId: 't-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' },
      ],
      updateUser: vi.fn(),
    }),
}));

describe('AccountPage', () => {
  it('renders personal profile data and password change section', () => {
    render(
      <BrowserRouter>
        <AccountPage />
      </BrowserRouter>
    );

    // expect(screen.getByText('Mi Cuenta')).toBeInTheDocument(); // Rendered by AppLayout via context
    expect(screen.getByText('Datos Personales')).toBeInTheDocument();
    expect(screen.getByDisplayValue('pablo@tasvalor.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pablo Test')).toBeInTheDocument();
    expect(screen.getByText('Mis Empresas')).toBeInTheDocument();
    expect(screen.getByText('Tasvalor')).toBeInTheDocument();
    expect(screen.getByText('Seguridad')).toBeInTheDocument();
  });
});
