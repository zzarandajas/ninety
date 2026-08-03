import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { IssueRepository } from '../repositories/IssueRepository.js';
import { publishTenantEvent } from '../lib/redis.js';

const statusEnum = z.enum(['open', 'discussing', 'solved', 'dropped']);
const priorityEnum = z.enum(['low', 'medium', 'high']);

const createIssueSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  raisedByUserId: z.string().min(1),
  priority: priorityEnum.default('medium'),
});

const updateIssueSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  raisedByUserId: z.string().min(1).optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  resolutionNotes: z.string().nullable().optional(),
});

const listIssuesQuerySchema = z.object({
  status: statusEnum.optional(),
});

const reorderIssuesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export default async function issueRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: requireTenant(app) }, async (request) => {
    const query = listIssuesQuerySchema.parse(request.query);
    const repo = new IssueRepository(request.tenantId as string);
    return repo.findAll(query);
  });

  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createIssueSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const issue = await repo.create(body, request.user.userId);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'issue',
      action: 'create',
      id: issue.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send(issue);
  });

  app.patch('/reorder', { preHandler: requireTenant(app) }, async (request) => {
    const { orderedIds } = reorderIssuesSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const result = await repo.reorder(orderedIds);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'issue',
      action: 'reorder',
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return result;
  });

  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateIssueSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const issue = await repo.update(id, body, request.user.userId);
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'issue',
      action: 'update',
      id: issue.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return issue;
  });

  app.delete('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new IssueRepository(request.tenantId as string);
    const deleted = await repo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Issue not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'issue',
      action: 'delete',
      id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(204).send();
  });
}
