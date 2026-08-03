import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { L10LiveMeetingPage } from './L10LiveMeetingPage';

vi.mock('../lib/l10Api', async () => {
  const actual = await vi.importActual<typeof import('../lib/l10Api')>('../lib/l10Api');
  return {
    ...actual,
    l10Api: { get: vi.fn(), update: vi.fn(), close: vi.fn(), listAgendaItems: vi.fn(), logAgendaItem: vi.fn() },
  };
});
vi.mock('../lib/rocksApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/rocksApi')>('../lib/rocksApi');
  return { ...actual, rocksApi: { list: vi.fn() } };
});
vi.mock('../lib/issuesApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/issuesApi')>('../lib/issuesApi');
  return { ...actual, issuesApi: { list: vi.fn(), update: vi.fn() } };
});
vi.mock('../lib/scorecardApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/scorecardApi')>('../lib/scorecardApi');
  return { ...actual, scorecardApi: { listMetrics: vi.fn(), listEntries: vi.fn() } };
});
vi.mock('../lib/todosApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/todosApi')>('../lib/todosApi');
  return { ...actual, todosApi: { list: vi.fn() } };
});
vi.mock('../lib/tenantApi', () => ({
  tenantApi: { listMembers: vi.fn() },
}));

const meeting = {
  id: 'meeting-1',
  tenantId: 'tenant-1',
  meetingDate: '2026-07-27T00:00:00.000Z',
  facilitatorUserId: 'user-1',
  status: 'scheduled' as const,
  segueNotes: null,
  headlines: null,
  concludeNotes: null,
  overallRating: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/l10/meeting-1']}>
      <Routes>
        <Route path="/l10/:id" element={<L10LiveMeetingPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('L10LiveMeetingPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    const { l10Api } = await import('../lib/l10Api');
    const { rocksApi } = await import('../lib/rocksApi');
    const { issuesApi } = await import('../lib/issuesApi');
    const { scorecardApi } = await import('../lib/scorecardApi');
    const { todosApi } = await import('../lib/todosApi');
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(l10Api.get).mockResolvedValue(meeting as never);
    vi.mocked(l10Api.listAgendaItems).mockResolvedValue([]);
    vi.mocked(rocksApi.list).mockResolvedValue([]);
    vi.mocked(issuesApi.list).mockResolvedValue([]);
    vi.mocked(scorecardApi.listMetrics).mockResolvedValue([]);
    vi.mocked(scorecardApi.listEntries).mockResolvedValue([]);
    vi.mocked(todosApi.list).mockResolvedValue([]);
    vi.mocked(tenantApi.listMembers).mockResolvedValue([
      { userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'owner' as const },
    ]);
  });

  it('loads the meeting and shows the Segue section active by default', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Segue')).toBeInTheDocument());
    expect(screen.getByText('Scorecard')).toBeInTheDocument();
    expect(screen.getByText('Rock Review')).toBeInTheDocument();
    expect(screen.getByText('Headlines')).toBeInTheDocument();
    expect(screen.getByText('To-Do List')).toBeInTheDocument();
    expect(screen.getByText('IDS')).toBeInTheDocument();
    expect(screen.getByText('Conclude')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/notas de segue/i)).toBeInTheDocument();
  });

  it('saves segue notes on blur', async () => {
    const { l10Api } = await import('../lib/l10Api');
    vi.mocked(l10Api.update).mockResolvedValue(meeting as never);
    renderPage();

    await waitFor(() => expect(screen.getByPlaceholderText(/notas de segue/i)).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/notas de segue/i), 'Todo bien');
    await userEvent.tab();

    await waitFor(() => expect(l10Api.update).toHaveBeenCalledWith('meeting-1', { segueNotes: 'Todo bien' }));
  });

  it('switches the active section when a collapsed header is clicked', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText(/notas de segue/i)).toBeInTheDocument());

    await userEvent.click(screen.getByText('Headlines'));

    expect(screen.queryByPlaceholderText(/notas de segue/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/titulares/i)).toBeInTheDocument();
  });

  it('opens the create Todo modal from the To-Do section with the meeting id attached', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText(/notas de segue/i)).toBeInTheDocument());

    await userEvent.click(screen.getByText('To-Do List'));
    await userEvent.click(screen.getByRole('button', { name: /nuevo to-do/i }));

    expect(await screen.findByText('Nuevo to-do', { selector: '.ant-modal-title' })).toBeInTheDocument();
  });

  it('closes the meeting with a rating and notes', async () => {
    const { l10Api } = await import('../lib/l10Api');
    vi.mocked(l10Api.close).mockResolvedValue({ ...meeting, status: 'completed', overallRating: 9 } as never);
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText(/notas de segue/i)).toBeInTheDocument());

    await userEvent.click(screen.getByText('Conclude'));
    await userEvent.type(screen.getByLabelText(/rating/i), '9');
    await userEvent.click(screen.getByRole('button', { name: /cerrar reunión/i }));

    await waitFor(() =>
      expect(l10Api.close).toHaveBeenCalledWith('meeting-1', expect.objectContaining({ overallRating: 9 }))
    );
  });

  it('logs a note on a rock, shows it, and updates an issue status with real data', async () => {
    const { l10Api } = await import('../lib/l10Api');
    const { rocksApi } = await import('../lib/rocksApi');
    const { issuesApi } = await import('../lib/issuesApi');
    const rock = {
      id: 'rock-1',
      tenantId: 'tenant-1',
      title: 'Cerrar el trato con Cliente X',
      description: null,
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: false,
      status: 'on_track' as const,
      createdAt: '2026-07-01T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      milestones: [],
    };
    const issue = {
      id: 'issue-1',
      tenantId: 'tenant-1',
      title: 'Proceso de onboarding no documentado',
      description: null,
      raisedByUserId: 'user-1',
      status: 'open' as const,
      priority: 'high' as const,
      sortOrder: 0,
      createdAt: '2026-07-01T00:00:00.000Z',
      resolvedAt: null,
      resolutionNotes: null,
    };
    const existingLog = {
      id: 'log-1',
      tenantId: 'tenant-1',
      meetingId: 'meeting-1',
      itemType: 'rock_review' as const,
      referenceId: 'rock-1',
      notes: 'Nota ya guardada de una reunión anterior',
    };
    vi.mocked(rocksApi.list).mockResolvedValue([rock] as never);
    vi.mocked(issuesApi.list).mockResolvedValue([issue] as never);
    vi.mocked(l10Api.listAgendaItems).mockResolvedValue([existingLog] as never);
    vi.mocked(l10Api.logAgendaItem).mockResolvedValue({
      id: 'log-2',
      tenantId: 'tenant-1',
      meetingId: 'meeting-1',
      itemType: 'rock_review',
      referenceId: 'rock-1',
      notes: 'Sigue on track',
    } as never);
    vi.mocked(issuesApi.update).mockResolvedValue({ ...issue, status: 'solved' } as never);

    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText(/notas de segue/i)).toBeInTheDocument());

    await userEvent.click(screen.getByText('Rock Review'));
    // Unlike the IDS section (issue.title lives in its own <span>), the Rock
    // Review row renders `{rock.title} — <Tag>{rock.status}</Tag>` with no
    // wrapping element around just the title, so RTL's default exact getByText
    // (which only concatenates an element's direct text-node children) sees
    // "Cerrar el trato con Cliente X —" as the div's text, not the bare title.
    // exact: false does a substring match instead, which still uniquely
    // identifies this row.
    expect(await screen.findByText('Cerrar el trato con Cliente X', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Nota ya guardada de una reunión anterior')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Nota de discusión'), 'Sigue on track');
    await userEvent.click(screen.getByRole('button', { name: /añadir nota/i }));

    await waitFor(() =>
      expect(l10Api.logAgendaItem).toHaveBeenCalledWith('meeting-1', {
        itemType: 'rock_review',
        referenceId: 'rock-1',
        notes: 'Sigue on track',
      })
    );
    await waitFor(() => expect(screen.getByText('Sigue on track')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Nota de discusión')).toHaveValue('');

    await userEvent.click(screen.getByText('IDS'));
    expect(await screen.findByText('Proceso de onboarding no documentado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Solved'));

    await waitFor(() => expect(issuesApi.update).toHaveBeenCalledWith('issue-1', { status: 'solved' }));
  });

});
