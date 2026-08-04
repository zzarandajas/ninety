import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoFormModal } from './TodoFormModal';

vi.mock('../lib/todosApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/todosApi')>('../lib/todosApi');
  return {
    ...actual,
    todosApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  };
});

const members = [{ userId: 'user-1', fullName: 'Pablo', email: 'me@example.com', role: 'member' as const }];

const existingTodo = {
  id: 'todo-1',
  tenantId: 'tenant-1',
  quarter: '2026-Q3',
  title: 'Enviar propuesta a cliente X',
  ownerUserId: 'user-1',
  dueDate: null,
  status: 'open' as const,
  originatingMeetingId: null,
};

describe('TodoFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a todo with the entered fields', async () => {
    const { todosApi } = await import('../lib/todosApi');
    vi.mocked(todosApi.create).mockResolvedValue(existingTodo as never);
    const onSaved = vi.fn();

    render(<TodoFormModal open members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/título/i), 'Nuevo todo');
    await userEvent.click(screen.getByLabelText('Owner'));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(todosApi.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nuevo todo', ownerUserId: 'user-1' }))
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('includes meetingId as originatingMeetingId when creating from a meeting', async () => {
    const { todosApi } = await import('../lib/todosApi');
    vi.mocked(todosApi.create).mockResolvedValue(existingTodo as never);

    render(<TodoFormModal open members={members} meetingId="meeting-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/título/i), 'Todo de la reunión');
    await userEvent.click(screen.getByLabelText('Owner'));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(todosApi.create).toHaveBeenCalledWith(expect.objectContaining({ originatingMeetingId: 'meeting-1' }))
    );
  });

  it('pre-fills the form when editing and shows the status field', async () => {
    render(<TodoFormModal open todo={existingTodo} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/título/i)).toHaveValue('Enviar propuesta a cliente X');
    expect(screen.getByText('Estado')).toBeInTheDocument();
  });

  it('updates the todo on save when editing, without sending originatingMeetingId', async () => {
    const { todosApi } = await import('../lib/todosApi');
    vi.mocked(todosApi.update).mockResolvedValue(existingTodo as never);

    render(<TodoFormModal open todo={existingTodo} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('Estado'));
    await userEvent.click(await screen.findByText('Done'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(todosApi.update).toHaveBeenCalledWith('todo-1', expect.objectContaining({ status: 'done' })));
    const [, payload] = vi.mocked(todosApi.update).mock.calls[0];
    expect(payload).not.toHaveProperty('originatingMeetingId');
  });

  it('deletes the todo after confirming', async () => {
    const { todosApi } = await import('../lib/todosApi');
    vi.mocked(todosApi.remove).mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<TodoFormModal open todo={existingTodo} members={members} onClose={onClose} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole('button', { name: /borrar to-do/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));

    await waitFor(() => expect(todosApi.remove).toHaveBeenCalledWith('todo-1'));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
