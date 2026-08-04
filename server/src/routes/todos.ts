import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { TodoRepository } from '../repositories/TodoRepository.js';
import { publishTenantEvent } from '../lib/redis.js';

const quarterSchema = z.string().regex(/^\d{4}-Q[1-4]$/, 'Formato de trimestre inválido, usa YYYY-Qn');

const statusEnum = z.enum(['open', 'done']);

const createTodoSchema = z.object({
  title: z.string().min(1),
  ownerUserId: z.string().min(1),
  quarter: quarterSchema,
  dueDate: z.coerce.date().optional(),
  originatingMeetingId: z.string().optional(),
});

const updateTodoSchema = z.object({
  title: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
  quarter: quarterSchema.optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: statusEnum.optional(),
});

const listTodosQuerySchema = z.object({
  status: statusEnum.optional(),
  ownerUserId: z.string().optional(),
  quarter: quarterSchema.optional(),
});

export default async function todoRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: requireTenant(app) }, async (request) => {
    const query = listTodosQuerySchema.parse(request.query);
    const repo = new TodoRepository(request.tenantId as string);
    return repo.findAll(query);
  });

  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createTodoSchema.parse(request.body);
    const repo = new TodoRepository(request.tenantId as string);
    const todo = await repo.create(body, request.user.userId);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'todo',
      action: 'create',
      id: todo.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send(todo);
  });

  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTodoSchema.parse(request.body);
    const repo = new TodoRepository(request.tenantId as string);
    const todo = await repo.update(id, body, request.user.userId);
    if (!todo) return reply.code(404).send({ error: 'Todo not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'todo',
      action: 'update',
      id: todo.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return todo;
  });

  app.delete('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new TodoRepository(request.tenantId as string);
    const deleted = await repo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Todo not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'todo',
      action: 'delete',
      id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(204).send();
  });
}
