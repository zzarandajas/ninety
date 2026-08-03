import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AdminPage } from './AdminPage';

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      activeTenantId: 't-1',
      tenants: [
        { tenantId: 't-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' },
      ],
    }),
}));

vi.mock('../lib/membershipsApi', () => ({
  membershipsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../lib/seatsApi', () => ({
  seatsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../lib/adminApi', () => ({
  adminApi: {
    listTenants: vi.fn().mockResolvedValue([
      { id: 't-1', name: 'Tasvalor', slug: 'tasvalor', timezone: 'Europe/Madrid', _count: { memberships: 3 } },
    ]),
    listUsers: vi.fn().mockResolvedValue([]),
  },
}));

describe('AdminPage', () => {
  it('renders admin panel tabs', async () => {
    render(
      <BrowserRouter>
        <AdminPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Membresía Actual')).toBeInTheDocument();
    expect(screen.getByText('Empresas / Tenants')).toBeInTheDocument();
    expect(screen.getByText('Todos los Usuarios')).toBeInTheDocument();
  });
});
