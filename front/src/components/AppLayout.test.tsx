import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { AppLayout } from './AppLayout';

vi.mock('../lib/impersonateApi', () => ({
  impersonateApi: {
    listUsers: vi.fn().mockResolvedValue([]),
    impersonate: vi.fn(),
  },
}));

const ownerUser = {
  id: 'user-1',
  email: 'me@example.com',
  fullName: 'Pablo',
  mustChangePassword: false,
  avatarUrl: null,
};

const memberUser = {
  id: 'user-2',
  email: 'ana@tasvalor.com',
  fullName: 'Ana Sales',
  mustChangePassword: false,
  avatarUrl: null,
};

function renderLayout(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/change-password" element={<div>change password page</div>} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<div>contenido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'test-token',
      user: ownerUser,
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
      impersonation: null,
    });
  });

  it('renders the active tenant name, the nav links and the routed content without admin in sidebar', () => {
    renderLayout();

    expect(screen.getByText('Tasvalor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rocks/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /administración/i })).not.toBeInTheDocument();
    expect(screen.getByText('Pablo')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('redirects to /login when there is no token', () => {
    useAuthStore.setState({ token: null });
    renderLayout();

    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });

  it('redirects to /change-password when mustChangePassword is true', () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: true, avatarUrl: null },
    });
    renderLayout();

    expect(screen.getByText('change password page')).toBeInTheDocument();
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });

  it('does not crash and unmounts the routed content when the user logs out while mounted', async () => {
    renderLayout();
    expect(screen.getByText('contenido')).toBeInTheDocument();

    expect(() => {
      useAuthStore.getState().logout();
    }).not.toThrow();

    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });

  it('shows the red banner while impersonating and exits the simulation on click', async () => {
    useAuthStore.getState().login({
      token: 'owner-token',
      user: ownerUser,
      memberships: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });
    useAuthStore.getState().impersonate({
      token: 'imp-token',
      user: memberUser,
      memberships: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'member' }],
    });

    renderLayout();

    expect(screen.getByText(/Modo dios activo/)).toBeInTheDocument();
    const banner = screen.getByRole('status');
    expect(within(banner).getByText(/Ana Sales/)).toBeInTheDocument();
    const exitButton = screen.getByRole('button', { name: /salir de la simulación/i });
    expect(exitButton).toBeInTheDocument();

    await userEvent.click(exitButton);

    expect(useAuthStore.getState().token).toBe('owner-token');
    expect(useAuthStore.getState().user?.fullName).toBe('Pablo');
    expect(useAuthStore.getState().impersonation).toBeNull();
    expect(screen.queryByText(/Modo dios activo/)).not.toBeInTheDocument();
  });

  it('hides the god mode selector when the active role is not owner', () => {
    useAuthStore.setState({
      user: memberUser,
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'member' }],
    });
    renderLayout();

    expect(screen.queryByText('Modo dios')).not.toBeInTheDocument();
  });

  it('shows the god mode selector for the owner', async () => {
    renderLayout();

    expect(await screen.findByText('Modo dios')).toBeInTheDocument();
  });
});
