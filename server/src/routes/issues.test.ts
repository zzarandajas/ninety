import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../repositories/IssueRepository.js', () => ({
  IssueRepository: vi.fn(),
}));
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string; user?: { userId: string } }) => {
      request.user = { userId: 'user-1' };
      request.tenantId = 'tenant-a';
    },
  ],
}));

import { buildApp } from '../app.js';
import { IssueRepository } from '../repositories/IssueRepository.js';

const mockIssue = {
  id: 'issue-1',
  tenantId: 'tenant-a',
  title: 'Slow onboarding',
  description: null,
  raisedByUserId: 'user-1',
  status: 'open',
  priority: 'medium',
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  resolvedAt: null,
  resolutionNotes: null,
};

describe('routes/issues', () => {
  let app: FastifyInstance;
  let repoMock: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    repoMock = {
      findAll: vi.fn().mockResolvedValue([mockIssue]),
      findById: vi.fn().mockResolvedValue(mockIssue),
      create: vi.fn().mockResolvedValue(mockIssue),
      update: vi.fn().mockResolvedValue(mockIssue),
      delete: vi.fn().mockResolvedValue(true),
      reorder: vi.fn().mockResolvedValue([mockIssue]),
    };
    vi.mocked(IssueRepository).mockImplementation(() => repoMock as never);
    app = await buildApp();
  });

  it('GET /issues lists issues for the tenant', async () => {
    const res = await app.inject({ method: 'GET', url: '/issues' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([mockIssue]);
  });

  it('GET /issues?status=open passes the filter through', async () => {
    await app.inject({ method: 'GET', url: '/issues?status=open' });
    expect(repoMock.findAll).toHaveBeenCalledWith({ status: 'open' });
  });

  it('GET /issues?status=bogus is rejected with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/issues?status=bogus' });
    expect(res.statusCode).toBe(400);
  });

  it('POST /issues creates an issue and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/issues',
      payload: { title: 'Slow onboarding', raisedByUserId: 'user-1', priority: 'medium' },
    });
    expect(res.statusCode).toBe(201);
    expect(repoMock.create).toHaveBeenCalledWith(
      { title: 'Slow onboarding', raisedByUserId: 'user-1', priority: 'medium' },
      'user-1'
    );
  });

  it('POST /issues defaults priority to medium when omitted', async () => {
    await app.inject({ method: 'POST', url: '/issues', payload: { title: 'x', raisedByUserId: 'user-1' } });
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'medium' }), 'user-1');
  });

  it('POST /issues sets createdByUserId from the JWT, ignoring any value in the body', async () => {
    await app.inject({
      method: 'POST',
      url: '/issues',
      payload: { title: 'x', raisedByUserId: 'user-1', priority: 'medium', createdByUserId: 'attacker-id' },
    });
    expect(repoMock.create).toHaveBeenCalledWith(
      { title: 'x', raisedByUserId: 'user-1', priority: 'medium' },
      'user-1'
    );
  });

  it('PATCH /issues/:id updates and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/issues/issue-1', payload: { status: 'discussing' } });
    expect(res.statusCode).toBe(200);
    expect(repoMock.update).toHaveBeenCalledWith('issue-1', { status: 'discussing' }, 'user-1');
  });

  it('PATCH /issues/:id returns 404 when the repo returns null', async () => {
    repoMock.update.mockResolvedValue(null);
    const res = await app.inject({ method: 'PATCH', url: '/issues/missing', payload: { title: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /issues/:id returns 204 on success', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/issues/issue-1' });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /issues/:id returns 404 when nothing was deleted', async () => {
    repoMock.delete.mockResolvedValue(false);
    const res = await app.inject({ method: 'DELETE', url: '/issues/missing' });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /issues/reorder reorders and returns the list', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/issues/reorder',
      payload: { orderedIds: ['issue-2', 'issue-1'] },
    });
    expect(res.statusCode).toBe(200);
    expect(repoMock.reorder).toHaveBeenCalledWith(['issue-2', 'issue-1']);
    expect(res.json()).toEqual([mockIssue]);
  });

  it('PATCH /issues/reorder rejects an empty array with 400', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/issues/reorder', payload: { orderedIds: [] } });
    expect(res.statusCode).toBe(400);
  });
});
