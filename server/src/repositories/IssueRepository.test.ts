import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '@prisma/client';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    issue: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma.js';
import { IssueRepository } from './IssueRepository.js';

const TENANT_A = 'tenant-a';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    tenantId: TENANT_A,
    title: 'Slow onboarding',
    description: null,
    raisedByUserId: 'user-1',
    status: 'open',
    priority: 'medium',
    sortOrder: 0,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    createdByUserId: null,
    updatedByUserId: null,
    resolvedAt: null,
    resolutionNotes: null,
    ...overrides,
  };
}

describe('IssueRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('scopes to tenantId and orders by sortOrder ascending', async () => {
      vi.mocked(prisma.issue.findMany).mockResolvedValue([makeIssue()]);
      const repo = new IssueRepository(TENANT_A);

      await repo.findAll();

      expect(prisma.issue.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('adds a status filter when provided', async () => {
      vi.mocked(prisma.issue.findMany).mockResolvedValue([]);
      const repo = new IssueRepository(TENANT_A);

      await repo.findAll({ status: 'open' });

      expect(prisma.issue.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, status: 'open' },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('scopes to tenantId', async () => {
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue());
      const repo = new IssueRepository(TENANT_A);

      await repo.findById('issue-1');

      expect(prisma.issue.findFirst).toHaveBeenCalledWith({
        where: { id: 'issue-1', tenantId: TENANT_A },
      });
    });
  });

  describe('create', () => {
    it('assigns sortOrder = max(sortOrder for tenant) + 1', async () => {
      vi.mocked(prisma.issue.aggregate).mockResolvedValue({ _max: { sortOrder: 4 } } as never);
      vi.mocked(prisma.issue.create).mockResolvedValue(makeIssue({ sortOrder: 5 }));
      const repo = new IssueRepository(TENANT_A);

      await repo.create({ title: 'New issue', raisedByUserId: 'user-1', priority: 'high' }, 'user-1');

      expect(prisma.issue.aggregate).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
        _max: { sortOrder: true },
      });
      expect(prisma.issue.create).toHaveBeenCalledWith({
        data: {
          title: 'New issue',
          raisedByUserId: 'user-1',
          priority: 'high',
          tenantId: TENANT_A,
          sortOrder: 5,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      });
    });

    it('assigns sortOrder 0 when the tenant has no issues yet', async () => {
      vi.mocked(prisma.issue.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
      vi.mocked(prisma.issue.create).mockResolvedValue(makeIssue({ sortOrder: 0 }));
      const repo = new IssueRepository(TENANT_A);

      await repo.create({ title: 'First issue', raisedByUserId: 'user-1', priority: 'low' }, 'user-1');

      expect(prisma.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 0 }) })
      );
    });

    it('sets createdByUserId and updatedByUserId to the same value', async () => {
      vi.mocked(prisma.issue.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
      vi.mocked(prisma.issue.create).mockResolvedValue(makeIssue());
      const repo = new IssueRepository(TENANT_A);

      await repo.create({ title: 'New issue', raisedByUserId: 'user-1', priority: 'high' }, 'user-3');

      expect(prisma.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdByUserId: 'user-3', updatedByUserId: 'user-3' }),
        })
      );
    });
  });

  describe('update', () => {
    it('returns null when no row matches id+tenantId', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 0 });
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.update('missing', { title: 'x' }, 'user-1');

      expect(result).toBeNull();
    });

    it('sets resolvedAt when status moves to solved', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue({ status: 'open' }));
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { status: 'solved' }, 'user-1');

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'issue-1', tenantId: TENANT_A });
      expect(call.data.status).toBe('solved');
      expect(call.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('sets resolvedAt when status moves to dropped', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue({ status: 'open' }));
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { status: 'dropped' }, 'user-1');

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('clears resolvedAt when status moves back to open', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue({ status: 'solved', resolvedAt: new Date() }));
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { status: 'open' }, 'user-1');

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data.resolvedAt).toBeNull();
    });

    it('leaves resolvedAt untouched when status is not part of the update', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue());
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { title: 'Renamed' }, 'user-1');

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data).not.toHaveProperty('resolvedAt');
    });

    it('does not touch resolvedAt when status is included but unchanged from current', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue({ status: 'solved' }));
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { status: 'solved', title: 'Renamed while already solved' }, 'user-1');

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data).not.toHaveProperty('resolvedAt');
    });

    it('returns null without calling updateMany when status is provided but the issue does not exist', async () => {
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(null);
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.update('missing', { status: 'solved' }, 'user-1');

      expect(result).toBeNull();
      expect(prisma.issue.updateMany).not.toHaveBeenCalled();
    });

    it('sets updatedByUserId on every update, alongside any resolvedAt logic', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue());
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { title: 'Renamed' }, 'user-2');

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data.updatedByUserId).toBe('user-2');
    });
  });

  describe('delete', () => {
    it('returns true when a row was deleted, scoped to tenantId', async () => {
      vi.mocked(prisma.issue.deleteMany).mockResolvedValue({ count: 1 });
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.delete('issue-1');

      expect(prisma.issue.deleteMany).toHaveBeenCalledWith({ where: { id: 'issue-1', tenantId: TENANT_A } });
      expect(result).toBe(true);
    });

    it('returns false when nothing matched', async () => {
      vi.mocked(prisma.issue.deleteMany).mockResolvedValue({ count: 0 });
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.delete('missing');

      expect(result).toBe(false);
    });
  });

  describe('reorder', () => {
    it('runs one updateMany per id, scoped to tenantId, with sortOrder = array index', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }, { count: 1 }, { count: 1 }]);
      vi.mocked(prisma.issue.findMany).mockResolvedValue([]);
      const repo = new IssueRepository(TENANT_A);

      await repo.reorder(['issue-3', 'issue-1', 'issue-2']);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = vi.mocked(prisma.$transaction).mock.calls[0][0] as unknown as unknown[];
      expect(ops).toHaveLength(3);
      expect(prisma.issue.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'issue-3', tenantId: TENANT_A },
        data: { sortOrder: 0 },
      });
      expect(prisma.issue.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'issue-1', tenantId: TENANT_A },
        data: { sortOrder: 1 },
      });
      expect(prisma.issue.updateMany).toHaveBeenNthCalledWith(3, {
        where: { id: 'issue-2', tenantId: TENANT_A },
        data: { sortOrder: 2 },
      });
    });

    it('returns the reordered list via findAll', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }]);
      const reordered = [makeIssue({ id: 'issue-2', sortOrder: 0 }), makeIssue({ id: 'issue-1', sortOrder: 1 })];
      vi.mocked(prisma.issue.findMany).mockResolvedValue(reordered);
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.reorder(['issue-2', 'issue-1']);

      expect(result).toBe(reordered);
    });
  });
});
