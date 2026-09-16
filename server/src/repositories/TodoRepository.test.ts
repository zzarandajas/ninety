import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Todo } from '@prisma/client';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    todo: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma.js';
import { TodoRepository } from './TodoRepository.js';

const TENANT_A = 'tenant-a';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    tenantId: TENANT_A,
    title: 'Enviar propuesta a cliente X',
    ownerUserId: 'user-1',
    quarter: '2026-Q3',
    description: null,
    dueDate: null,
    status: 'open',
    originatingMeetingId: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    createdByUserId: null,
    updatedByUserId: null,
    ...overrides,
  };
}

describe('TodoRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('scopes to tenantId with no filters', async () => {
      vi.mocked(prisma.todo.findMany).mockResolvedValue([makeTodo()]);
      const repo = new TodoRepository(TENANT_A);

      await repo.findAll();

      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
        orderBy: { dueDate: 'asc' },
      });
    });

    it('adds status and ownerUserId filters when provided', async () => {
      vi.mocked(prisma.todo.findMany).mockResolvedValue([]);
      const repo = new TodoRepository(TENANT_A);

      await repo.findAll({ status: 'open', ownerUserId: 'user-1' });

      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, status: 'open', ownerUserId: 'user-1' },
        orderBy: { dueDate: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('scopes to tenantId', async () => {
      vi.mocked(prisma.todo.findFirst).mockResolvedValue(makeTodo());
      const repo = new TodoRepository(TENANT_A);

      await repo.findById('todo-1');

      expect(prisma.todo.findFirst).toHaveBeenCalledWith({ where: { id: 'todo-1', tenantId: TENANT_A } });
    });
  });

  describe('create', () => {
    it('injects tenantId', async () => {
      vi.mocked(prisma.todo.create).mockResolvedValue(makeTodo());
      const repo = new TodoRepository(TENANT_A);

      await repo.create(
        { title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1', quarter: '2026-Q3' },
        'user-1'
      );

      expect(prisma.todo.create).toHaveBeenCalledWith({
        data: {
          title: 'Enviar propuesta a cliente X',
          ownerUserId: 'user-1',
          quarter: '2026-Q3',
          tenantId: TENANT_A,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      });
    });

    it('passes through dueDate and originatingMeetingId when provided', async () => {
      vi.mocked(prisma.todo.create).mockResolvedValue(makeTodo());
      const repo = new TodoRepository(TENANT_A);
      const dueDate = new Date('2026-08-01T00:00:00.000Z');

      await repo.create(
        { title: 'x', ownerUserId: 'user-1', quarter: '2026-Q3', dueDate, originatingMeetingId: 'meeting-1' },
        'user-1'
      );

      expect(prisma.todo.create).toHaveBeenCalledWith({
        data: {
          title: 'x',
          ownerUserId: 'user-1',
          quarter: '2026-Q3',
          dueDate,
          originatingMeetingId: 'meeting-1',
          tenantId: TENANT_A,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      });
    });
  });

  describe('update', () => {
    it('returns null when no row matches id+tenantId', async () => {
      vi.mocked(prisma.todo.updateMany).mockResolvedValue({ count: 0 });
      const repo = new TodoRepository(TENANT_A);

      const result = await repo.update('missing', { status: 'done' }, 'user-1');

      expect(result).toBeNull();
    });

    it('updates the matching row scoped to tenantId', async () => {
      vi.mocked(prisma.todo.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.todo.findFirst).mockResolvedValue(makeTodo({ status: 'done' }));
      const repo = new TodoRepository(TENANT_A);

      await repo.update('todo-1', { status: 'done' }, 'user-1');

      expect(prisma.todo.updateMany).toHaveBeenCalledWith({
        where: { id: 'todo-1', tenantId: TENANT_A },
        data: { status: 'done', updatedByUserId: 'user-1' },
      });
    });
  });

  describe('delete', () => {
    it('returns true when a row was deleted, scoped to tenantId', async () => {
      vi.mocked(prisma.todo.deleteMany).mockResolvedValue({ count: 1 });
      const repo = new TodoRepository(TENANT_A);

      const result = await repo.delete('todo-1');

      expect(prisma.todo.deleteMany).toHaveBeenCalledWith({ where: { id: 'todo-1', tenantId: TENANT_A } });
      expect(result).toBe(true);
    });

    it('returns false when nothing matched', async () => {
      vi.mocked(prisma.todo.deleteMany).mockResolvedValue({ count: 0 });
      const repo = new TodoRepository(TENANT_A);

      expect(await repo.delete('missing')).toBe(false);
    });
  });
});
