import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { DashboardPage } from './DashboardPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/rocksApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/rocksApi')>('../lib/rocksApi');
  return { ...actual, rocksApi: { list: vi.fn() } };
});
vi.mock('../lib/issuesApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/issuesApi')>('../lib/issuesApi');
  return { ...actual, issuesApi: { list: vi.fn() } };
});
vi.mock('../lib/todosApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/todosApi')>('../lib/todosApi');
  return { ...actual, todosApi: { list: vi.fn() } };
});
vi.mock('../lib/l10Api', async () => {
  const actual = await vi.importActual<typeof import('../lib/l10Api')>('../lib/l10Api');
  return { ...actual, l10Api: { list: vi.fn() } };
});

const rocks = [
  { id: 'rock-1', tenantId: 'tenant-1', title: 'A', description: null, ownerUserId: 'user-1', quarter: '2026-Q3', isCompanyRock: true, status: 'on_track', createdAt: '2026-07-01T00:00:00.000Z', dueDate: '2026-09-30T00:00:00.000Z', milestones: [] },
  { id: 'rock-2', tenantId: 'tenant-1', title: 'B', description: null, ownerUserId: 'user-1', quarter: '2026-Q3', isCompanyRock: false, status: 'on_track', createdAt: '2026-07-01T00:00:00.000Z', dueDate: '2026-09-30T00:00:00.000Z', milestones: [] },
  { id: 'rock-3', tenantId: 'tenant-1', title: 'C', description: null, ownerUserId: 'user-1', quarter: '2026-Q3', isCompanyRock: false, status: 'off_track', createdAt: '2026-07-01T00:00:00.000Z', dueDate: '2026-09-30T00:00:00.000Z', milestones: [] },
  { id: 'rock-4', tenantId: 'tenant-1', title: 'D', description: null, ownerUserId: 'user-1', quarter: '2026-Q3', isCompanyRock: false, status: 'done', createdAt: '2026-07-01T00:00:00.000Z', dueDate: '2026-09-30T00:00:00.000Z', milestones: [] },
];
const issues = [
  { id: 'issue-1', tenantId: 'tenant-1', title: 'x', description: null, raisedByUserId: 'user-1', status: 'open', priority: 'high', sortOrder: 0, createdAt: '2026-07-01T00:00:00.000Z', resolvedAt: null, resolutionNotes: null },
  { id: 'issue-2', tenantId: 'tenant-1', title: 'y', description: null, raisedByUserId: 'user-1', status: 'open', priority: 'medium', sortOrder: 1, createdAt: '2026-07-01T00:00:00.000Z', resolvedAt: null, resolutionNotes: null },
  { id: 'issue-3', tenantId: 'tenant-1', title: 'z', description: null, raisedByUserId: 'user-1', status: 'open', priority: 'low', sortOrder: 2, createdAt: '2026-07-01T00:00:00.000Z', resolvedAt: null, resolutionNotes: null },
];
const todos = [
  { id: 'todo-1', tenantId: 'tenant-1', title: 'a', ownerUserId: 'user-1', dueDate: null, status: 'open', originatingMeetingId: null },
  { id: 'todo-2', tenantId: 'tenant-1', title: 'b', ownerUserId: 'user-1', dueDate: null, status: 'open', originatingMeetingId: null },
  { id: 'todo-3', tenantId: 'tenant-1', title: 'c', ownerUserId: 'user-1', dueDate: null, status: 'open', originatingMeetingId: null },
  { id: 'todo-4', tenantId: 'tenant-1', title: 'd', ownerUserId: 'user-1', dueDate: null, status: 'open', originatingMeetingId: null },
  { id: 'todo-5', tenantId: 'tenant-1', title: 'e', ownerUserId: 'user-1', dueDate: null, status: 'open', originatingMeetingId: null },
];
const meetings = [
  { id: 'meeting-1', tenantId: 'tenant-1', meetingDate: '2099-01-01T00:00:00.000Z', facilitatorUserId: 'user-1', status: 'scheduled' as const, segueNotes: null, headlines: null, concludeNotes: null, overallRating: null },
];

function setMocks() {
  return Promise.all([
    import('../lib/rocksApi').then(({ rocksApi }) => vi.mocked(rocksApi.list).mockResolvedValue(rocks as never)),
    import('../lib/issuesApi').then(({ issuesApi }) => vi.mocked(issuesApi.list).mockResolvedValue(issues as never)),
    import('../lib/todosApi').then(({ todosApi }) => vi.mocked(todosApi.list).mockResolvedValue(todos as never)),
    import('../lib/l10Api').then(({ l10Api }) => vi.mocked(l10Api.list).mockResolvedValue(meetings as never)),
  ]);
}

describe('DashboardPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    await setMocks();
  });

  it('loads and shows counts for rocks, issues, todos and the next meeting date', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Rocks On Track')).toBeInTheDocument());
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getAllByText('3')[0]).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1/1/2099')).toBeInTheDocument();

    // Check Company Rocks and Individual Rocks sections
    expect(screen.getByText(/Rocks de Compañía/)).toBeInTheDocument();
    expect(screen.getByText('1 rocks')).toBeInTheDocument();
    expect(screen.getByText(/Rocks Individuales/)).toBeInTheDocument();
    expect(screen.getByText('3 rocks')).toBeInTheDocument();

    // Check To Dos and Issues sections
    expect(screen.getByText('To Dos del periodo')).toBeInTheDocument();
    expect(screen.getByText('5 to dos')).toBeInTheDocument();
    expect(screen.getByText('Issues del periodo')).toBeInTheDocument();
    expect(screen.getByText('3 issues')).toBeInTheDocument();
  });

  it('navigates to /rocks when the Rocks card is clicked', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Rocks On Track')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Rocks On Track'));

    expect(mockNavigate).toHaveBeenCalledWith('/rocks');
  });

  it('navigates to the meeting when the L10 card is clicked', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Próxima L10')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Próxima L10'));

    expect(mockNavigate).toHaveBeenCalledWith('/l10/meeting-1');
  });

  it('shows "N/A" and does not navigate when there are no meetings', async () => {
    const { l10Api } = await import('../lib/l10Api');
    vi.mocked(l10Api.list).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('N/A')).toBeInTheDocument());

    await userEvent.click(screen.getByText('N/A'));

    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringMatching(/^\/l10\//));
  });
});
