import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { RocksBoard } from './RocksBoard';

vi.mock('../lib/rocksApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/rocksApi')>('../lib/rocksApi');
  return { ...actual, rocksApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
});

vi.mock('../lib/tenantApi', () => ({
  tenantApi: { listMembers: vi.fn() },
}));

const rocks = [
  {
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
    milestones: [
      {
        id: 'milestone-1',
        rockId: 'rock-1',
        description: 'Diseñar el schema',
        dueDate: '2026-08-01T00:00:00.000Z',
        completedAt: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 'milestone-2',
        rockId: 'rock-1',
        description: 'Implementar API',
        dueDate: '2026-08-10T00:00:00.000Z',
        completedAt: null,
      },
    ],
  },
  {
    id: 'rock-2',
    tenantId: 'tenant-1',
    title: 'Cerrar 3 nuevos clientes',
    description: null,
    ownerUserId: 'user-1',
    quarter: '2026-Q3',
    isCompanyRock: false,
    status: 'off_track' as const,
    createdAt: '2026-07-01T00:00:00.000Z',
    dueDate: '2026-09-30T00:00:00.000Z',
    milestones: [],
  },
];

describe('RocksBoard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    const { rocksApi } = await import('../lib/rocksApi');
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(rocksApi.list).mockResolvedValue(rocks as never);
    vi.mocked(tenantApi.listMembers).mockResolvedValue([
      { userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'member' as const },
    ]);
  });

  it('lists all rocks in a single table with their status', async () => {
    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Lanzar módulo de Scorecard')).toBeInTheDocument());
    expect(screen.getByText('Cerrar 3 nuevos clientes')).toBeInTheDocument();
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.getByText('Off track')).toBeInTheDocument();
  });

  it('orders company rocks first, then personal rocks alphabetically by owner', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(tenantApi.listMembers).mockResolvedValue([
      { userId: 'user-ana', fullName: 'Ana', email: 'ana@example.com', role: 'member' as const },
      { userId: 'user-bruno', fullName: 'Bruno', email: 'bruno@example.com', role: 'member' as const },
      { userId: 'user-zoe', fullName: 'Zoe', email: 'zoe@example.com', role: 'member' as const },
    ]);
    const mixedRocks = [
      { ...rocks[1], id: 'r-pzoe', title: 'Rock personal Zoe', ownerUserId: 'user-zoe' },
      { ...rocks[0], id: 'r-company', title: 'Rock de empresa Bruno', ownerUserId: 'user-bruno' },
      { ...rocks[1], id: 'r-pana', title: 'Rock personal Ana', ownerUserId: 'user-ana', status: 'done' as const },
    ];
    vi.mocked(rocksApi.list).mockResolvedValue(mixedRocks as never);

    const { container } = render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Rock de empresa Bruno')).toBeInTheDocument());
    const rows = container.querySelectorAll('tbody .ant-table-row');
    expect(rows[0]).toHaveTextContent('Rock de empresa Bruno');
    expect(rows[1]).toHaveTextContent('Rock personal Ana');
    expect(rows[2]).toHaveTextContent('Rock personal Zoe');
  });

  it('refetches with the selected quarter filter', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );
    await waitFor(() => expect(rocksApi.list).toHaveBeenCalledWith({}));

    await userEvent.click(screen.getByRole('combobox', { name: /trimestre/i }));
    const dropdownOption = await waitFor(() => {
      const el = document.querySelector('.ant-select-item-option-content');
      if (!el || el.textContent !== '2026-Q3') throw new Error('dropdown option not rendered yet');
      return el;
    });
    await userEvent.click(dropdownOption);

    await waitFor(() =>
      expect(rocksApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ quarter: '2026-Q3' }))
    );
  });

  it('shows the owner, due date and milestone progress on each row', async () => {
    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Lanzar módulo de Scorecard')).toBeInTheDocument());
    expect(screen.getAllByText('Pablo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('30/09/2026').length).toBe(2);
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // rock-2 has no milestones, so no progress indicator should render for it.
    expect(screen.queryAllByText(/^\d+\/\d+$/)).toHaveLength(1);
  });

  it('refetches rocks and members when the active tenant changes', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    const { tenantApi } = await import('../lib/tenantApi');

    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );
    await waitFor(() => expect(rocksApi.list).toHaveBeenCalledTimes(1));
    expect(tenantApi.listMembers).toHaveBeenCalledTimes(1);

    useAuthStore.setState({ activeTenantId: 'tenant-2' });

    await waitFor(() => expect(rocksApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(tenantApi.listMembers).toHaveBeenCalledTimes(2));
  });

  it('opens the modal in edit mode with the clicked rock data when a row is clicked', async () => {
    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Lanzar módulo de Scorecard')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Lanzar módulo de Scorecard'));

    expect(await screen.findByText('Editar Rock Trimestral')).toBeInTheDocument();
    expect(screen.getByLabelText(/título/i)).toHaveValue('Lanzar módulo de Scorecard');
  });

  it('refetches the rock list when the modal is closed without saving', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );

    await waitFor(() => expect(rocksApi.list).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByText('Lanzar módulo de Scorecard'));
    expect(await screen.findByText('Editar Rock Trimestral')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(rocksApi.list).toHaveBeenCalledTimes(2));
  });

  it('shows an error message when loading rocks fails', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(rocksApi.list).mockRejectedValueOnce(new Error('Network down'));

    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );

    expect(await screen.findByText('Network down')).toBeInTheDocument();
  });
});
