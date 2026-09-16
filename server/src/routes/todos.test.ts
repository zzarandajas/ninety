import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../repositories/TodoRepository.js', () => ({ TodoRepository: vi.fn() }));
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string; user?: { userId: string } }) => {
      request.user = { userId: 'user-1' };
      request.tenantId = 'tenant-a';
    },
  ],
}));

import { buildApp } from '../app.js';
import { TodoRepository } from '../repositories/TodoRepository.js';

const mockTodo = {
  id: 'todo-1',
  tenantId: 'tenant-a',
  quarter: '2026-Q3',
  title: 'Enviar propuesta a cliente X',
  description: null,
  ownerUserId: 'user-1',
  dueDate: null,
  status: 'open',
  originatingMeetingId: null,
};

describe('routes/todos', () => {
  let app: FastifyInstance;
  let repoMock: {
    findAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    repoMock = {
      findAll: vi.fn().mockResolvedValue([mockTodo]),
      create: vi.fn().mockResolvedValue(mockTodo),
      update: vi.fn().mockResolvedValue(mockTodo),
      delete: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(TodoRepository).mockImplementation(() => repoMock as never);
    app = await buildApp();
  });

  it('GET /todos lists todos for the tenant', async () => {
    const res = await app.inject({ method: 'GET', url: '/todos' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([mockTodo]);
  });

  it('GET /todos?status=open&ownerUserId=user-1 passes both filters through', async () => {
    await app.inject({ method: 'GET', url: '/todos?status=open&ownerUserId=user-1' });
    expect(repoMock.findAll).toHaveBeenCalledWith({ status: 'open', ownerUserId: 'user-1' });
  });

  it('POST /todos creates a todo and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: { title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1', quarter: '2026-Q3' },
    });
    expect(res.statusCode).toBe(201);
    expect(repoMock.create).toHaveBeenCalledWith(
      { title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1', quarter: '2026-Q3' },
      'user-1'
    );
  });

  it('POST /todos accepts an optional description', async () => {
    await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'x',
        description: '<p>Contexto</p>',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
      },
    });
    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: '<p>Contexto</p>' }),
      'user-1'
    );
  });

  it('POST /todos accepts an optional originatingMeetingId', async () => {
    await app.inject({
      method: 'POST',
      url: '/todos',
      payload: { title: 'x', ownerUserId: 'user-1', quarter: '2026-Q3', originatingMeetingId: 'meeting-1' },
    });
    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ originatingMeetingId: 'meeting-1' }),
      'user-1'
    );
  });

  it('PATCH /todos/:id updates and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/todos/todo-1', payload: { status: 'done' } });
    expect(res.statusCode).toBe(200);
    expect(repoMock.update).toHaveBeenCalledWith('todo-1', { status: 'done' }, 'user-1');
  });

  it('PATCH /todos/:id returns 404 when the repo returns null', async () => {
    repoMock.update.mockResolvedValue(null);
    const res = await app.inject({ method: 'PATCH', url: '/todos/missing', payload: { title: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /todos/:id returns 204 on success', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/todos/todo-1' });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /todos/:id returns 404 when nothing was deleted', async () => {
    repoMock.delete.mockResolvedValue(false);
    const res = await app.inject({ method: 'DELETE', url: '/todos/missing' });
    expect(res.statusCode).toBe(404);
  });
});
