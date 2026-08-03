import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueFormModal } from './IssueFormModal';

vi.mock('../lib/issuesApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/issuesApi')>('../lib/issuesApi');
  return {
    ...actual,
    issuesApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  };
});

const members = [{ userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'member' as const }];

const existingIssue = {
  id: 'issue-1',
  tenantId: 'tenant-1',
  title: 'Onboarding lento',
  description: null,
  raisedByUserId: 'user-1',
  status: 'open' as const,
  priority: 'high' as const,
  sortOrder: 0,
  createdAt: '2026-07-01T00:00:00.000Z',
  resolvedAt: null,
  resolutionNotes: null,
};

describe('IssueFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an issue with the entered fields', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    vi.mocked(issuesApi.create).mockResolvedValue(existingIssue as never);
    const onSaved = vi.fn();

    render(<IssueFormModal open members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/título/i), 'Nuevo issue');
    await userEvent.click(screen.getByLabelText(/owner/i));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(issuesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Nuevo issue', raisedByUserId: 'user-1' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('pre-fills the form when editing and shows the status field', async () => {
    render(<IssueFormModal open issue={existingIssue} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/título/i)).toHaveValue('Onboarding lento');
    expect(screen.getByLabelText(/estado actual/i)).toBeInTheDocument();
  });

  it('updates status on save when editing', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    vi.mocked(issuesApi.update).mockResolvedValue(existingIssue as never);

    render(<IssueFormModal open issue={existingIssue} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByLabelText(/estado actual/i));
    await userEvent.click(await screen.findByText(/Resuelto/i));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(issuesApi.update).toHaveBeenCalledWith('issue-1', expect.objectContaining({ status: 'solved' }))
    );
  });

  it('deletes the issue after confirming', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    vi.mocked(issuesApi.remove).mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<IssueFormModal open issue={existingIssue} members={members} onClose={onClose} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole('button', { name: /borrar/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));

    await waitFor(() => expect(issuesApi.remove).toHaveBeenCalledWith('issue-1'));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not show the delete button in create mode', () => {
    render(<IssueFormModal open members={members} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /borrar/i })).not.toBeInTheDocument();
  });
});
