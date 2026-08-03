import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenantMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

function makeReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply;
}

describe('resolveTenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if the middleware runs without an authenticated user', async () => {
    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const request = { headers: { 'x-tenant-id': 'tenant-1' } } as unknown as FastifyRequest;
    const reply = makeReply();

    await resolveTenantContext(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);

    const { prisma } = await import('../lib/prisma.js');
    expect(prisma.tenantMembership.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 if X-Tenant-Id header is missing', async () => {
    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const request = { headers: {}, user: { userId: 'user-1' } } as unknown as FastifyRequest;
    const reply = makeReply();

    await resolveTenantContext(request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);

    const { prisma } = await import('../lib/prisma.js');
    expect(prisma.tenantMembership.findUnique).not.toHaveBeenCalled();
  });

  it('returns 403 if no membership exists for the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(null);

    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const request = {
      headers: { 'x-tenant-id': 'tenant-2' },
      user: { userId: 'user-1' },
    } as unknown as FastifyRequest;
    const reply = makeReply();

    await resolveTenantContext(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(prisma.tenantMembership.findUnique).toHaveBeenCalledWith({
      where: { userId_tenantId: { userId: 'user-1', tenantId: 'tenant-2' } },
    });
  });

  it('returns 403 if the membership was deactivated (user removed from tenant)', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'member',
      seatId: null,
      isActive: false,
    } as never);

    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const request = {
      headers: { 'x-tenant-id': 'tenant-1' },
      user: { userId: 'user-1' },
    } as unknown as FastifyRequest;
    const reply = makeReply();

    await resolveTenantContext(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(request.tenantId).toBeUndefined();
  });

  it('sets request.tenantId and request.userRole on a valid membership', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
      seatId: null,
      isActive: true,
    } as never);

    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const request = {
      headers: { 'x-tenant-id': 'tenant-1' },
      user: { userId: 'user-1' },
    } as unknown as FastifyRequest;
    const reply = makeReply();

    await resolveTenantContext(request, reply);

    expect(request.tenantId).toBe('tenant-1');
    expect(request.userRole).toBe('admin');
    expect(reply.code).not.toHaveBeenCalled();
    expect(prisma.tenantMembership.findUnique).toHaveBeenCalledWith({
      where: { userId_tenantId: { userId: 'user-1', tenantId: 'tenant-1' } },
    });
  });

  // Integración real: la cadena `requireTenant(app)` montada sobre una app Fastify
  // construida de verdad (no un request de mentira), que es donde vive el invariante
  // de aislamiento entre tenants.
  it('enforces the tenant chain end-to-end through a real Fastify app', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockImplementation((async (args: {
      where: { userId_tenantId: { userId: string; tenantId: string } };
    }) => {
      const { userId, tenantId } = args.where.userId_tenantId;
      if (userId === 'user-1' && tenantId === 'tenant-1') {
        return { id: 'mem-1', userId, tenantId, role: 'owner', seatId: null, isActive: true };
      }
      return null;
    }) as never);

    const { requireTenant } = await import('./resolveTenantContext.js');
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    app.get('/__test/tenant-check', { preHandler: requireTenant(app) }, async (request) => ({
      tenantId: request.tenantId,
    }));

    const token = app.jwt.sign({ userId: 'user-1' });
    const authHeader = { authorization: `Bearer ${token}` };

    const allowed = await app.inject({
      method: 'GET',
      url: '/__test/tenant-check',
      headers: { ...authHeader, 'x-tenant-id': 'tenant-1' },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({ tenantId: 'tenant-1' });

    const foreignTenant = await app.inject({
      method: 'GET',
      url: '/__test/tenant-check',
      headers: { ...authHeader, 'x-tenant-id': 'tenant-2' },
    });
    expect(foreignTenant.statusCode).toBe(403);

    const noTenantHeader = await app.inject({
      method: 'GET',
      url: '/__test/tenant-check',
      headers: authHeader,
    });
    expect(noTenantHeader.statusCode).toBe(400);

    const noToken = await app.inject({
      method: 'GET',
      url: '/__test/tenant-check',
      headers: { 'x-tenant-id': 'tenant-1' },
    });
    expect(noToken.statusCode).toBe(401);

    await app.close();
  });
});
