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
    l10Api: {
      get: vi.fn(),
      update: vi.fn(),
      close: vi.fn(),
      submitRating: vi.fn(),
      listAgendaItems: vi.fn(),
      logAgendaItem: vi.fn(),
    },
  };
});
vi.mock('../lib/rocksApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/rocksApi')>('../lib/rocksApi');
  return { ...actual, rocksApi: { list: vi.fn() } };
});
vi.mock('../lib/issuesApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/issuesApi')>('../lib/issuesApi');
  return { ...actual, issuesApi: { list: vi.fn(), update: vi.fn(), create: vi.fn() } };
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
    // changeSection() (switching the active tab) persists via l10Api.update on every
    // click — default it so section-switching tests don't get stuck on the loading
    // state because the mock resolves to undefined. Tests that assert on the actual
    // update payload still override this with a more specific mock.
    vi.mocked(l10Api.update).mockResolvedValue(meeting as never);
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

    // "Segue" renders twice while active: once in the sidebar nav, once as the
    // active AgendaSection's own header title.
    await waitFor(() => expect(screen.getAllByText('Segue').length).toBeGreaterThan(0));
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

    expect(await screen.findByText('Nuevo To-Do (Compromiso a 7 días)')).toBeInTheDocument();
  });

  it('opens the create Issue modal from Headlines instead of auto-creating from the whole text', async () => {
    const { l10Api } = await import('../lib/l10Api');
    const { issuesApi } = await import('../lib/issuesApi');
    const meetingWithHeadlines = {
      ...meeting,
      headlines: '<p>Cliente contento con el soporte, pero se queja de los tiempos de entrega</p>',
    };
    vi.mocked(l10Api.get).mockResolvedValue(meetingWithHeadlines as never);
    vi.mocked(l10Api.update).mockResolvedValue(meetingWithHeadlines as never);

    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText(/notas de segue/i)).toBeInTheDocument());

    await userEvent.click(screen.getByText('Headlines'));
    await userEvent.click(await screen.findByRole('button', { name: /convertir titular en issue/i }));

    expect(await screen.findByText('Nuevo Issue (IDS)')).toBeInTheDocument();
    expect(issuesApi.create).not.toHaveBeenCalled();
  });

  it('submits the current user\'s own rating and closes the meeting with notes', async () => {
    const { l10Api } = await import('../lib/l10Api');
    // Rating is per-member now: InputNumber onBlur -> submitRating -> refetch via get().
    // Closing the meeting (separate action, behind a confirm modal) only carries
    // concludeNotes — overallRating is derived server-side from submitted ratings.
    vi.mocked(l10Api.submitRating).mockResolvedValue({
      id: 'rating-1',
      meetingId: 'meeting-1',
      userId: 'user-1',
      rating: 9,
    } as never);
    vi.mocked(l10Api.close).mockResolvedValue({ ...meeting, status: 'completed' } as never);
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText(/notas de segue/i)).toBeInTheDocument());

    await userEvent.click(screen.getByText('Conclude'));
    await userEvent.type(screen.getByPlaceholderText('-'), '9');
    await userEvent.tab();

    await waitFor(() =>
      expect(l10Api.submitRating).toHaveBeenCalledWith('meeting-1', { rating: 9, targetUserId: 'user-1' })
    );

    // "Cerrar reunión L10" opens a confirmation modal; the modal's own button
    // ("Confirmar y cerrar reunión") triggers the actual close.
    await userEvent.click(screen.getByRole('button', { name: /cerrar reunión l10/i }));
    await userEvent.click(await screen.findByRole('button', { name: /confirmar y cerrar reunión/i }));

    await waitFor(() => expect(l10Api.close).toHaveBeenCalledWith('meeting-1', expect.anything()));
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
    // The note row renders as "• {notes}" (bullet + text as sibling text nodes),
    // so match on the substring rather than the exact full text.
    expect(screen.getByText(/Nota ya guardada de una reunión anterior/)).toBeInTheDocument();

    // The "add note" button is icon-only (no accessible name), so press Enter
    // in the input instead — onPressEnter wires to the same logRockNote call.
    await userEvent.type(screen.getByPlaceholderText('Añadir nota...'), 'Sigue on track{enter}');

    await waitFor(() =>
      expect(l10Api.logAgendaItem).toHaveBeenCalledWith('meeting-1', {
        itemType: 'rock_review',
        referenceId: 'rock-1',
        notes: 'Sigue on track',
      })
    );
    await waitFor(() => expect(screen.getByText(/Sigue on track/)).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Añadir nota...')).toHaveValue('');

    await userEvent.click(screen.getByText('IDS'));
    expect(await screen.findByText('Proceso de onboarding no documentado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Solved'));

    await waitFor(() => expect(issuesApi.update).toHaveBeenCalledWith('issue-1', { status: 'solved' }));
  });

});
