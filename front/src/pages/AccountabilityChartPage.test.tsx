import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { AccountabilityChartPage } from './AccountabilityChartPage';

vi.mock('../lib/seatsApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/seatsApi')>('../lib/seatsApi');
  return { ...actual, seatsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
});
vi.mock('../lib/membershipsApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/membershipsApi')>('../lib/membershipsApi');
  return { ...actual, membershipsApi: { list: vi.fn(), invite: vi.fn(), update: vi.fn() } };
});

const seats = [
  { id: 'seat-ceo', tenantId: 'tenant-1', name: 'CEO', parentSeatId: null, rolesAndResponsibilities: [], occupants: [] },
];

const memberships = [
  {
    id: 'mem-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'owner' as const,
    seatId: 'seat-ceo',
    isActive: true,
    user: { id: 'user-1', fullName: 'Pablo', email: 'pablo@tasvalor.com', avatarUrl: null },
    seat: { id: 'seat-ceo', name: 'CEO' },
  },
];

function setAuth(role: 'owner' | 'admin' | 'member') {
  useAuthStore.setState({
    token: 'test-token',
    user: { id: 'user-1', email: 'pablo@tasvalor.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
    tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role }],
    activeTenantId: 'tenant-1',
  });
}

describe('AccountabilityChartPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { seatsApi } = await import('../lib/seatsApi');
    const { membershipsApi } = await import('../lib/membershipsApi');
    vi.mocked(seatsApi.list).mockResolvedValue(seats as never);
    vi.mocked(membershipsApi.list).mockResolvedValue(memberships as never);
  });

  it('loads seats and members and shows the org chart tab by default', async () => {
    setAuth('owner');
    render(
      <MemoryRouter>
        <AccountabilityChartPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('CEO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo seat/i })).toBeInTheDocument();
  });

  it('switches to the members tab and lists the tenant members', async () => {
    setAuth('owner');
    render(
      <MemoryRouter>
        <AccountabilityChartPage />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText('CEO'));
    await userEvent.click(screen.getByRole('tab', { name: /usuarios/i }));

    // 'Pablo' also appears in the AppLayout header (logged-in user's name), so
    // assert on the email instead, which only the members table row renders.
    expect(await screen.findByText('pablo@tasvalor.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invitar usuario/i })).toBeInTheDocument();
  });

  it('hides management actions for a plain member', async () => {
    setAuth('member');
    render(
      <MemoryRouter>
        <AccountabilityChartPage />
      </MemoryRouter>
    );

    await screen.findByText('CEO');
    expect(screen.queryByRole('button', { name: /nuevo seat/i })).not.toBeInTheDocument();
  });
});
