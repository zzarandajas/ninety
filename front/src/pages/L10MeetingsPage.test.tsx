import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { L10MeetingsPage } from './L10MeetingsPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/l10Api', async () => {
  const actual = await vi.importActual<typeof import('../lib/l10Api')>('../lib/l10Api');
  return {
    ...actual,
    l10Api: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
  };
});

vi.mock('../lib/tenantApi', () => ({
  tenantApi: { listMembers: vi.fn() },
}));

const meetings = [
  {
    id: 'meeting-1',
    tenantId: 'tenant-1',
    meetingDate: '2026-07-27T00:00:00.000Z',
    facilitatorUserId: 'user-1',
    status: 'completed' as const,
    segueNotes: null,
    headlines: null,
    concludeNotes: null,
    overallRating: 8,
  },
];

describe('L10MeetingsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    const { l10Api } = await import('../lib/l10Api');
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(l10Api.list).mockResolvedValue(meetings as never);
    vi.mocked(tenantApi.listMembers).mockResolvedValue([
      { userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'member' as const },
    ]);
  });

  it('lists past meetings with their status and rating', async () => {
    render(
      <MemoryRouter>
        <L10MeetingsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('27/07/2026')).toBeInTheDocument());
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
  });

  it('navigates to the meeting when a row is clicked', async () => {
    render(
      <MemoryRouter>
        <L10MeetingsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('27/07/2026')).toBeInTheDocument());
    await userEvent.click(screen.getByText('27/07/2026'));

    expect(mockNavigate).toHaveBeenCalledWith('/l10/meeting-1');
  });

  it('creates a new meeting and navigates to it', async () => {
    const { l10Api } = await import('../lib/l10Api');
    vi.mocked(l10Api.create).mockResolvedValue({ id: 'meeting-2' } as never);

    render(
      <MemoryRouter>
        <L10MeetingsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('27/07/2026')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /nueva reunión/i }));
    expect(await screen.findByText('Nueva reunión L10')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() =>
      expect(l10Api.create).toHaveBeenCalledWith(expect.objectContaining({ facilitatorUserId: 'user-1' }))
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/l10/meeting-2'));
  });

});
